const cases = [
  ["O Senhor dos Anéis", "J. R. R. Tolkien"],
  ["Dom Casmurro", "Machado de Assis"],
  ["Memórias Póstumas de Brás Cubas", "Machado de Assis"],
  ["Grande Sertão: Veredas", "João Guimarães Rosa"],
  ["A Hora da Estrela", "Clarice Lispector"],
  ["O Alquimista", "Paulo Coelho"],
  ["Ensaio sobre a Cegueira", "José Saramago"],
  ["Cem Anos de Solidão", "Gabriel García Márquez"],
  ["1984", "George Orwell"],
  ["Admirável Mundo Novo", "Aldous Huxley"],
  ["O Pequeno Príncipe", "Antoine de Saint-Exupéry"],
  ["Harry Potter e a Pedra Filosofal", "J. K. Rowling"],
  ["O Hobbit", "J. R. R. Tolkien"],
  ["Duna", "Frank Herbert"],
  ["Fundação", "Isaac Asimov"],
  ["Neuromancer", "William Gibson"],
  ["Sapiens", "Yuval Noah Harari"],
  ["Homo Deus", "Yuval Noah Harari"],
  ["Rápido e Devagar", "Daniel Kahneman"],
  ["O Poder do Hábito", "Charles Duhigg"],
  ["Hábitos Atômicos", "James Clear"],
  ["O Homem em Busca de Sentido", "Viktor Frankl"],
  ["Crime e Castigo", "Fiódor Dostoiévski"],
  ["Orgulho e Preconceito", "Jane Austen"],
  ["Frankenstein", "Mary Shelley"],
  ["Drácula", "Bram Stoker"],
  ["Sherlock Holmes", "Arthur Conan Doyle"],
  ["A Bela e a Fera", "Gabrielle-Suzanne de Villeneuve"],
  ["A Revolução dos Bichos", "George Orwell"],
  ["O Nome do Vento", "Patrick Rothfuss"],
];

const normalize = (value) => value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const credible = (wanted, candidate) => {
  const compact = (value) => normalize(value).replace(/\s+/g, "");
  const wantedTitle = compact(wanted);
  const candidateTitle = compact(candidate);
  if (!wantedTitle || !candidateTitle) return false;
  const exact = wantedTitle === candidateTitle;
  const containmentRatio = Math.min(wantedTitle.length, candidateTitle.length) / Math.max(wantedTitle.length, candidateTitle.length);
  const contained = (candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle)) && containmentRatio >= .55;
  const wantedWords = normalize(wanted).split(" ").filter((word) => word.length > 2);
  const candidateWords = normalize(candidate).split(" ").filter((word) => word.length > 2);
  const shared = wantedWords.filter((word) => candidateWords.includes(word)).length;
  const ordered = candidateTitle.startsWith(wantedTitle) || candidateTitle.endsWith(wantedTitle);
  return exact || contained || ordered || (wantedWords.length >= 3 && shared / wantedWords.length >= .66 && shared / candidateWords.length >= .5);
};

async function json(url, timeout = 10_000, retries = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  } catch (reason) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return json(url, timeout, retries - 1);
    }
    throw reason;
  } finally { clearTimeout(timer); }
}

async function text(url, timeout = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "text/html" } });
    if (!response.ok) throw new Error(String(response.status));
    return response.text();
  } finally { clearTimeout(timer); }
}

async function apple(title, author) {
  const query = new URLSearchParams({ term: `${title} ${author}`, entity: "ebook", limit: "12", country: "br", lang: "pt_br" });
  const payload = await json(`https://itunes.apple.com/search?${query}`, 9_000, 2);
  const books = (payload.results ?? []).map((book) => ({ source: "Apple Books", title: book.trackName ?? "", author: book.artistName ?? "", cover: book.artworkUrl100 ?? "", pages: 0, detailsUrl: book.trackViewUrl ?? "" }));
  return books.find((book) => credible(title, book.title));
}

async function appleDetails(book) {
  if (!book?.detailsUrl) return book;
  const html = await text(book.detailsUrl, 10_000);
  const raw = html.match(/<script[^>]+(?:name="schema:book"|type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/i)?.[1]?.trim();
  if (!raw) return book;
  const schema = JSON.parse(raw);
  return schema["@type"] === "Book" ? { ...book, pages: Number(schema.numberOfPages ?? 0), isbn: schema.isbn ?? "" } : book;
}

async function gutendex(title, author) {
  const query = new URLSearchParams({ search: `${title} ${author}` });
  const payload = await json(`https://gutendex.com/books/?${query}`, 9_000);
  const books = (payload.results ?? []).map((book) => ({ source: "Gutendex", title: book.title ?? "", author: book.authors?.[0]?.name ?? "", cover: book.formats?.["image/jpeg"] ?? "" }));
  return books.find((book) => credible(title, book.title));
}

async function openLibrary(title, author) {
  const query = new URLSearchParams({ title, limit: "10" });
  if (author) query.set("author", author);
  const payload = await json(`https://openlibrary.org/search.json?${query}`, 9_000, 1);
  const books = (payload.docs ?? []).map((book) => ({
    source: "Open Library",
    title: book.title ?? "",
    author: book.author_name?.[0] ?? "Autor não informado",
    cover: book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg` : "",
    pages: Number(book.number_of_pages_median ?? 0),
  }));
  return books.find((book) => credible(title, book.title));
}

async function googleBooks(title, author) {
  const search = `intitle:"${title}"${author ? ` inauthor:"${author}"` : ""}`;
  const query = new URLSearchParams({ q: search, maxResults: "10", printType: "books", projection: "full" });
  const payload = await json(`https://www.googleapis.com/books/v1/volumes?${query}`, 9_000, 1);
  const books = (payload.items ?? []).map((book) => {
    const info = book.volumeInfo ?? {};
    return {
      source: "Google Books",
      title: info.title ?? "",
      author: info.authors?.[0] ?? "Autor não informado",
      cover: info.imageLinks?.extraLarge || info.imageLinks?.large || info.imageLinks?.medium || info.imageLinks?.thumbnail || "",
      pages: Number(info.pageCount ?? 0),
    };
  });
  return books.find((book) => credible(title, book.title));
}

function wikipediaAuthor(extract) {
  const patterns = [
    /(?:da|do|de)\s+(?:escritora|escritor|autora|autor)(?:\s+(?:brasileira|brasileiro|portuguesa|português|britânica|britânico|americana|americano|russa|russo|francesa|francês))*\s+([^.,;\n]+)/iu,
    /(?:romance|livro|obra)[^.\n]{0,90}(?:\sde|\spor)\s+([^.,;\n]+)/iu,
  ];
  for (const pattern of patterns) {
    const candidate = extract.match(pattern)?.[1]?.replace(/\s+/g, " ").trim();
    if (candidate && candidate.length <= 80) return candidate;
  }
  return "";
}

async function wikipedia(title, author) {
  const query = new URLSearchParams({ action: "query", generator: "search", gsrsearch: `${title} ${author} livro`.trim(), gsrnamespace: "0", gsrlimit: "8", prop: "pageimages|extracts", piprop: "thumbnail|original", pithumbsize: "700", exintro: "1", explaintext: "1", format: "json", origin: "*" });
  const payload = await json(`https://pt.wikipedia.org/w/api.php?${query}`, 9_000, 1);
  const pages = Object.values(payload.query?.pages ?? {}).filter((page) => /\b(livro|romance|novela|obra literária|conto|ficção|literário|literária)\b/i.test(page.extract ?? ""));
  const books = pages.map((page) => ({ source: "Wikipédia", title: (page.title ?? "").replace(/\s*\([^)]*(?:livro|romance)[^)]*\)\s*$/i, ""), author: author || wikipediaAuthor(page.extract ?? "") || "Autor não informado", cover: page.original?.source || page.thumbnail?.source || "" }));
  return books.find((book) => credible(title, book.title));
}

async function verify([title, expectedAuthor], mode) {
  const author = mode === "título + autor" ? expectedAuthor : "";
  const safely = async (request) => {
    try {
      const book = await request;
      return book?.title && book.author ? book : undefined;
    } catch { return undefined; }
  };
  try {
    const [appleBase, googleBook] = await Promise.all([
      safely(apple(title, author)),
      safely(googleBooks(title, author)),
    ]);
    const appleBook = appleBase ? await safely(appleDetails(appleBase)) : undefined;
    const openBook = googleBook?.pages ? undefined : await safely(openLibrary(title, author));
    const wiki = appleBook || openBook || googleBook ? undefined : await safely(wikipedia(title, author));
    const book = appleBook
      || openBook
      || googleBook
      || (wiki?.cover ? wiki : undefined)
      || await safely(gutendex(title, author))
      || wiki;
    if (!book) throw new Error("sem resultado compatível");
    const pages = Number(book.pages || openBook?.pages || googleBook?.pages || 0);
    return { query: title, mode, ok: true, ...book, pages };
  }
  catch { return { query: title, mode, ok: false, source: "—", title: "—", author: "—", cover: "" }; }
}

const results = [];
const planned = cases.map((item, index) => ({
  item,
  // O primeiro caso reproduz exatamente a captura do usuário; os demais validam obras distintas com autor.
  mode: index === 0 ? "somente título" : "título + autor",
}));
for (let index = 0; index < planned.length; index += 5) {
  const batch = planned.slice(index, index + 5);
  results.push(...await Promise.all(batch.map((test) => verify(test.item, test.mode))));
  // Mantém lotes pequenos para exercitar todas as fontes sem criar rajadas excessivas.
  await new Promise((resolve) => setTimeout(resolve, 500));
}

console.table(results.map((result, index) => ({ n: index + 1, modo: result.mode, busca: result.query, status: result.ok ? "OK" : "FALHA", fonte: result.source, resultado: result.title, capa: result.cover ? "sim" : "não", paginas: result.pages || "—" })));
const passed = results.filter((result) => result.ok).length;
const covers = results.filter((result) => result.ok && result.cover).length;
const withPages = results.filter((result) => result.ok && result.pages > 0).length;
console.log(JSON.stringify({ total: results.length, passed, failed: results.length - passed, covers, withPages }, null, 2));
if (passed !== planned.length) process.exitCode = 1;
