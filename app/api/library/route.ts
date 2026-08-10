import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { activity, books } from "../../../db/schema";

export async function GET() {
  try {
    const rows = await getDb().select().from(books).orderBy(desc(books.updatedAt)).limit(500);
    return Response.json({ books: rows });
  } catch {
    return Response.json({ books: [], offline: true });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as {
    id?: string;
    title?: string;
    author?: string;
    coverUrl?: string;
    pages?: number;
    status?: "reading" | "read" | "paused" | "abandoned" | "want";
    description?: string;
    metadata?: Record<string, unknown>;
  };
  const title = payload.title?.trim() ?? "";
  const author = payload.author?.trim() ?? "";
  if (!title || !author) {
    return Response.json({ error: "Título e autor são obrigatórios." }, { status: 400 });
  }

  try {
    const id = payload.id ?? crypto.randomUUID();
    const db = getDb();
    const [book] = await db
      .insert(books)
      .values({
        id,
        title,
        author,
        coverUrl: payload.coverUrl ?? "",
        pages: Math.max(0, payload.pages ?? 0),
        status: payload.status ?? "want",
        description: payload.description ?? "",
        metadataJson: JSON.stringify(payload.metadata ?? {}),
      })
      .onConflictDoNothing()
      .returning();
    if (!book) {
      return Response.json({ error: "Este livro já está na biblioteca." }, { status: 409 });
    }
    await db.insert(activity).values({
      id: crypto.randomUUID(),
      bookId: id,
      type: "book_added",
      message: `${title} foi adicionado à biblioteca`,
    });
    return Response.json({ book }, { status: 201 });
  } catch {
    return Response.json(
      { error: "O livro ficou salvo neste dispositivo e será sincronizado depois." },
      { status: 503 },
    );
  }
}
