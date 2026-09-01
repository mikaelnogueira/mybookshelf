import { NextResponse } from "next/server";

function readBookSchema(html: string) {
  const raw = html.match(/<script[^>]+(?:name="schema:book"|type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/i)?.[1]?.trim();
  if (!raw) throw new Error("Metadados estruturados não encontrados");
  const schema = JSON.parse(raw) as { "@type"?: string; numberOfPages?: number; isbn?: string; publisher?: string | { name?: string }; inLanguage?: string };
  if (schema["@type"] !== "Book") throw new Error("Resposta não corresponde a um livro");
  return {
    pages: Number(schema.numberOfPages ?? 0),
    isbn: String(schema.isbn ?? ""),
    publisher: typeof schema.publisher === "string" ? schema.publisher : schema.publisher?.name ?? "",
    language: String(schema.inLanguage ?? "").toUpperCase(),
  };
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("url") ?? "";
  let target: URL;
  try { target = new URL(requested); }
  catch { return NextResponse.json({ error: "Endereço inválido" }, { status: 400 }); }
  if (target.protocol !== "https:" || target.hostname !== "books.apple.com" || !target.pathname.includes("/book/")) return NextResponse.json({ error: "Fonte não permitida" }, { status: 400 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(target, { signal: controller.signal, headers: { Accept: "text/html", "User-Agent": "MyBookshelf/2.2.8 metadata" } });
    if (!response.ok) return NextResponse.json({ error: "Apple Books indisponível" }, { status: 502 });
    return NextResponse.json(readBookSchema(await response.text()));
  } catch {
    return NextResponse.json({ error: "Não foi possível completar os dados do livro" }, { status: 502 });
  } finally { clearTimeout(timer); }
}
