import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { activity, books, readingSessions } from "../../../../db/schema";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const payload = (await request.json()) as {
    currentPage?: number;
    status?: "reading" | "read" | "paused" | "abandoned" | "want";
    rating?: number;
    favorite?: boolean;
    session?: { startPage: number; endPage: number; readAt: string };
  };

  try {
    const db = getDb();
    const [existing] = await db.select().from(books).where(eq(books.id, id)).limit(1);
    if (!existing) return Response.json({ error: "Livro não encontrado." }, { status: 404 });

    if (payload.session) {
      const { startPage, endPage, readAt } = payload.session;
      if (startPage < 1 || endPage < startPage || (existing.pages > 0 && endPage > existing.pages)) {
        return Response.json({ error: "Intervalo de páginas inválido." }, { status: 400 });
      }
      const sessions = await db
        .select()
        .from(readingSessions)
        .where(eq(readingSessions.bookId, id));
      const overlaps = sessions.some(
        (item) => startPage <= item.endPage && endPage >= item.startPage,
      );
      if (overlaps) {
        return Response.json({ error: "Esse intervalo já foi registrado." }, { status: 409 });
      }
      await db.insert(readingSessions).values({
        id: crypto.randomUUID(),
        bookId: id,
        startPage,
        endPage,
        readAt,
      });
    }

    const nextPage = Math.max(0, Math.min(payload.currentPage ?? existing.currentPage, existing.pages || Infinity));
    const [book] = await db
      .update(books)
      .set({
        currentPage: nextPage,
        status: payload.status ?? (existing.pages > 0 && nextPage >= existing.pages ? "read" : existing.status),
        rating: payload.rating ?? existing.rating,
        favorite: payload.favorite ?? existing.favorite,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(books.id, id))
      .returning();

    if (payload.session) {
      await db.insert(activity).values({
        id: crypto.randomUUID(),
        bookId: id,
        type: "progress_updated",
        message: `Leitura atualizada até a página ${payload.session.endPage}`,
      });
    }
    return Response.json({ book });
  } catch {
    return Response.json({ error: "A atualização será sincronizada quando houver conexão." }, { status: 503 });
  }
}
