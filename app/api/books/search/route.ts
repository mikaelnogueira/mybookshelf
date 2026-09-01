import { classifyBookSubjects } from "../../../../lib/bookClassification";

type OpenLibraryDoc = {
  key?: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  first_publish_year?: number;
  publisher?: string[];
  language?: string[];
  isbn?: string[];
  subject?: string[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title")?.trim() ?? "";
  const author = searchParams.get("author")?.trim() ?? "";

  if (title.length < 2) return Response.json({ books: [] });

  const query = new URLSearchParams({
    title,
    limit: "6",
    fields: "key,title,author_name,cover_i,number_of_pages_median,first_publish_year,publisher,language,isbn,subject",
  });
  if (author) query.set("author", author);

  try {
    const response = await fetch(`https://openlibrary.org/search.json?${query}`, {
      headers: { "User-Agent": "MyBookshelf/0.1 (personal-library-app)" },
      cf: { cacheTtl: 3600, cacheEverything: true },
    } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });

    if (!response.ok) throw new Error("Open Library indisponível");
    const payload = (await response.json()) as { docs?: OpenLibraryDoc[] };
    const books = (payload.docs ?? []).map((book) => {
      const classification = classifyBookSubjects(book.subject ?? []);
      return {
        sourceId: book.key ?? crypto.randomUUID(),
        title: book.title ?? "Título não informado",
        author: book.author_name?.[0] ?? "Autor não informado",
        coverUrl: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : "",
        pages: book.number_of_pages_median ?? 0,
        published: book.first_publish_year?.toString() ?? "",
        publisher: book.publisher?.[0] ?? "",
        language: book.language?.[0]?.toUpperCase() ?? "",
        isbn: book.isbn?.[0] ?? "",
        ...classification,
      };
    });

    return Response.json({ books });
  } catch {
    return Response.json({ books: [], error: "Não foi possível consultar os metadados agora." }, { status: 503 });
  }
}
