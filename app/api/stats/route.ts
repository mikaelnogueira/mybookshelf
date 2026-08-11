import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { userStats } from "../../../db/schema";

const PROFILE_ID = "default";

export async function GET() {
  try {
    const [stats] = await getDb().select().from(userStats).where(eq(userStats.id, PROFILE_ID)).limit(1);
    return Response.json({ stats: stats ?? null });
  } catch {
    return Response.json({ stats: null, offline: true });
  }
}

export async function POST() {
  try {
    const db = getDb();
    await db.insert(userStats).values({ id: PROFILE_ID }).onConflictDoNothing();
    const [stats] = await db.select().from(userStats).where(eq(userStats.id, PROFILE_ID)).limit(1);
    return Response.json({ stats, initialized: true });
  } catch {
    return Response.json({ error: "As estatísticas serão inicializadas quando a conexão retornar." }, { status: 503 });
  }
}
