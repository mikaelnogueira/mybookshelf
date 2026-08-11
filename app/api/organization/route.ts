import { and, desc, eq, ne } from "drizzle-orm";
import { getDb } from "../../../db";
import { organizationItems } from "../../../db/schema";

type OrganizationKind = "categories" | "tags" | "collections";
const validKinds = new Set<OrganizationKind>(["categories", "tags", "collections"]);

export async function GET() {
  try {
    const items = await getDb().select().from(organizationItems).orderBy(desc(organizationItems.updatedAt)).limit(300);
    return Response.json({ items: items.map((item) => ({ ...item, bookIds: JSON.parse(item.bookIdsJson) as string[] })) });
  } catch {
    return Response.json({ items: [], offline: true });
  }
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { id?: string; kind?: OrganizationKind; name?: string; bookIds?: string[] };
  const kind = payload.kind;
  const name = payload.name?.trim().replace(/\s+/g, " ") ?? "";
  if (!kind || !validKinds.has(kind) || !name) return Response.json({ error: "Nome e tipo são obrigatórios." }, { status: 400 });
  if (name.length > 60) return Response.json({ error: "Use um nome com até 60 caracteres." }, { status: 400 });
  const bookIds = [...new Set((payload.bookIds ?? []).filter((id) => typeof id === "string"))].slice(0, 500);
  try {
    const db = getDb();
    const [existing] = await db.select({ id: organizationItems.id }).from(organizationItems).where(and(eq(organizationItems.kind, kind), eq(organizationItems.name, name))).limit(1);
    if (existing) return Response.json({ error: "Este item de organização já existe." }, { status: 409 });
    const [item] = await db.insert(organizationItems).values({ id: payload.id ?? crypto.randomUUID(), kind, name, bookIdsJson: JSON.stringify(bookIds) }).returning();
    return Response.json({ item: { ...item, bookIds } }, { status: 201 });
  } catch {
    return Response.json({ error: "Não foi possível salvar este item agora." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const payload = (await request.json()) as { id?: string; kind?: OrganizationKind; name?: string; bookIds?: string[] };
  const id = payload.id?.trim() ?? "";
  const kind = payload.kind;
  const name = payload.name?.trim().replace(/\s+/g, " ") ?? "";
  if (!id || !kind || !validKinds.has(kind) || !name) return Response.json({ error: "Identificador, nome e tipo são obrigatórios." }, { status: 400 });
  if (name.length > 60) return Response.json({ error: "Use um nome com até 60 caracteres." }, { status: 400 });
  const bookIds = [...new Set((payload.bookIds ?? []).filter((bookId) => typeof bookId === "string"))].slice(0, 500);
  try {
    const db = getDb();
    const [duplicate] = await db.select({ id: organizationItems.id }).from(organizationItems).where(and(eq(organizationItems.kind, kind), eq(organizationItems.name, name), ne(organizationItems.id, id))).limit(1);
    if (duplicate) return Response.json({ error: "Este item de organização já existe." }, { status: 409 });
    const [item] = await db.update(organizationItems).set({ kind, name, bookIdsJson: JSON.stringify(bookIds), updatedAt: new Date().toISOString() }).where(eq(organizationItems.id, id)).returning();
    if (!item) return Response.json({ error: "Item de organização não encontrado." }, { status: 404 });
    return Response.json({ item: { ...item, bookIds } });
  } catch {
    return Response.json({ error: "Não foi possível atualizar este item agora." }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return Response.json({ error: "Identificador obrigatório." }, { status: 400 });
  try {
    const [item] = await getDb().delete(organizationItems).where(eq(organizationItems.id, id)).returning({ id: organizationItems.id });
    if (!item) return Response.json({ error: "Item de organização não encontrado." }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Não foi possível excluir este item agora." }, { status: 503 });
  }
}
