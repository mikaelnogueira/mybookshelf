"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { CapacitorHttp } from "@capacitor/core";
import { classifyBookSubjects } from "../lib/bookClassification";
import { extractReaderDocument, supportedReaderFormats } from "../lib/readerImport";
import { deleteReaderDocument, loadReaderDocument, prepareReaderStorage, saveReaderDocument } from "../lib/readerStorage";
import type { ReaderDocument, ReaderFileSummary, ReaderImportMode, ReadingSessionResult } from "../lib/readerTypes";
import { initializeReadingNotifications } from "../lib/nativeNotifications";
import { ReaderModule } from "./ReaderModule";

type Status = "reading" | "read" | "paused" | "abandoned" | "want";
type ViewMode = "grid" | "carousel" | "list" | "table";
type VisualStyle = "minimal" | "brutal" | "glass";
type Theme = "dark" | "light";
type AppFont = "original" | "serif" | "arial" | "courier";
type InterfaceScale = "small" | "medium" | "large";
type OrganizationKind = "categories" | "tags" | "collections";
type LibrarySort = "recent" | "oldest" | "pages-asc" | "pages-desc" | "az" | "za";
type ChartPeriod = 7 | 15 | 30 | 90;
type ChartMode = "bars" | "wave";

type Session = { date: string; start: number; end: number; pagesRead?: number; isoDate?: string; minutes?: number; wpm?: number; source?: "traditional" | "rsvp" };
type Book = {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  pages: number;
  currentPage: number;
  status: Status;
  rating: number;
  favorite: boolean;
  description: string;
  published: string;
  publisher: string;
  language: string;
  isbn: string;
  categories: string[];
  tags: string[];
  accent: string;
  sessions: Session[];
  note?: string;
  readerFile?: ReaderFileSummary;
  readingTimeMinutes?: number;
  rsvpWordsRead?: number;
  manualCover?: boolean;
};

type SearchResult = {
  sourceId: string;
  title: string;
  author: string;
  coverUrl: string;
  pages: number;
  published: string;
  publisher: string;
  language: string;
  isbn: string;
  description: string;
  categories: string[];
  tags: string[];
  detailsUrl?: string;
};

type OrganizationItem = {
  id: string;
  kind: OrganizationKind;
  name: string;
  bookIds: string[];
  createdAt?: string;
};

const seedBooks: Book[] = [
  {
    id: "dune",
    title: "Duna",
    author: "Frank Herbert",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg",
    pages: 680,
    currentPage: 412,
    status: "reading",
    rating: 0,
    favorite: true,
    description:
      "Em Arrakis, a disputa por um recurso raro transforma o destino de Paul Atreides e de todo o império.",
    published: "1965",
    publisher: "Ace Books",
    language: "PT",
    isbn: "9780441172719",
    categories: ["Ficção científica", "Clássicos"],
    tags: ["política", "deserto"],
    accent: "#d7a965",
    sessions: [
      { date: "08 ago", start: 301, end: 346 },
      { date: "09 ago", start: 347, end: 383 },
      { date: "10 ago", start: 384, end: 412 },
    ],
    note: "A ecologia como infraestrutura política — retomar este ponto na resenha.",
  },
  {
    id: "sapiens",
    title: "Sapiens",
    author: "Yuval Noah Harari",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg",
    pages: 472,
    currentPage: 472,
    status: "read",
    rating: 4,
    favorite: false,
    description: "Uma visão ampla sobre a trajetória do Homo sapiens e as ficções que organizam sociedades.",
    published: "2014",
    publisher: "Harper",
    language: "PT",
    isbn: "9780062316097",
    categories: ["História", "Antropologia"],
    tags: ["humanidade"],
    accent: "#dc4740",
    sessions: [{ date: "02 ago", start: 421, end: 472 }],
  },
  {
    id: "left-hand",
    title: "A Mão Esquerda da Escuridão",
    author: "Ursula K. Le Guin",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780441478125-L.jpg",
    pages: 304,
    currentPage: 304,
    status: "read",
    rating: 5,
    favorite: true,
    description: "Um enviado atravessa um planeta gelado e uma cultura que desafia seus pressupostos.",
    published: "1969",
    publisher: "Ace Books",
    language: "PT",
    isbn: "9780441478125",
    categories: ["Ficção científica"],
    tags: ["gênero", "sociedade"],
    accent: "#89aab7",
    sessions: [{ date: "26 jul", start: 244, end: 304 }],
  },
  {
    id: "atomic-habits",
    title: "Hábitos Atômicos",
    author: "James Clear",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg",
    pages: 320,
    currentPage: 96,
    status: "paused",
    rating: 0,
    favorite: false,
    description: "Estratégias práticas para criar bons hábitos e abandonar padrões que não ajudam.",
    published: "2018",
    publisher: "Avery",
    language: "PT",
    isbn: "9780735211292",
    categories: ["Desenvolvimento pessoal"],
    tags: ["hábitos"],
    accent: "#d9c7b6",
    sessions: [{ date: "18 jul", start: 57, end: 96 }],
  },
  {
    id: "crime-punishment",
    title: "Crime e Castigo",
    author: "Fiódor Dostoiévski",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780140449136-L.jpg",
    pages: 671,
    currentPage: 0,
    status: "want",
    rating: 0,
    favorite: false,
    description: "Um romance sobre culpa, moralidade e redenção nas ruas de São Petersburgo.",
    published: "1866",
    publisher: "Penguin Classics",
    language: "PT",
    isbn: "9780140449136",
    categories: ["Romance", "Clássicos"],
    tags: ["rússia"],
    accent: "#8e362c",
    sessions: [],
  },
  {
    id: "the-hobbit",
    title: "O Hobbit",
    author: "J. R. R. Tolkien",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg",
    pages: 310,
    currentPage: 310,
    status: "read",
    rating: 5,
    favorite: true,
    description: "Bilbo Bolseiro deixa o conforto do Condado para uma aventura inesperada.",
    published: "1937",
    publisher: "Mariner Books",
    language: "PT",
    isbn: "9780547928227",
    categories: ["Fantasia", "Clássicos"],
    tags: ["aventura"],
    accent: "#69875d",
    sessions: [{ date: "11 jun", start: 251, end: 310 }],
  },
];

const navGroups = [
  {
    label: "Principal",
    items: [
      ["dashboard", "⌂", "Início"],
      ["library", "▦", "Biblioteca"],
      ["reading", "◐", "Lendo"],
      ["read", "✓", "Lidos"],
      ["favorites", "♡", "Favoritos"],
    ],
  },
  {
    label: "Organizar",
    items: [
      ["categories", "◇", "Categorias"],
      ["tags", "#", "Tags"],
      ["collections", "▤", "Coleções"],
    ],
  },
  {
    label: "Acompanhar",
    items: [
      ["stats", "↗", "Estatísticas"],
      ["history", "↺", "Histórico"],
      ["integrations", "+", "Integrações"],
    ],
  },
];

const statusLabels: Record<Status, string> = {
  reading: "Lendo",
  read: "Lido",
  paused: "Pausado",
  abandoned: "Abandonado",
  want: "Quero ler",
};

const accentOptions = ["#c7f36b", "#b7a0ff", "#7fd6ca", "#f3a868", "#ed7c9c"];

const tutorialSteps = [
  { icon: "▥", title: "Bem-vindo ao MyBookshelf", copy: "Sua biblioteca, progresso, ideias e hábitos de leitura reunidos em uma experiência simples." },
  { icon: "▦", title: "Organize sua biblioteca", copy: "Adicione livros, use categorias, tags e coleções e encontre qualquer título com rapidez." },
  { icon: "◔", title: "Acompanhe seu progresso", copy: "Registre páginas lidas e veja o avanço de cada leitura sem perder o histórico." },
  { icon: "↗", title: "Mantenha sua ofensiva", copy: "A sequência de leitura ajuda a criar constância sem transformar a leitura em obrigação." },
  { icon: "☷", title: "Encontre a melhor visualização", copy: "Filtre por status e alterne entre grade, carrossel, lista e tabela conforme o momento." },
  { icon: "✎", title: "Guarde suas anotações", copy: "Registre reflexões e observações diretamente na página de cada livro." },
  { icon: "◈", title: "Deixe o app com a sua cara", copy: "O padrão inicial é Claro com destaque Verde. Roxo, temas, estilos e outras cores continuam disponíveis em Aparência." },
];

function progress(book: Book) {
  return book.pages ? Math.min(100, Math.round((book.currentPage / book.pages) * 100)) : 0;
}

function todayLabel(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sessionDateKey(session: Session) {
  if (session.isoDate) return session.isoDate;
  const match = session.date.toLocaleLowerCase("pt-BR").match(/(\d{1,2})\s+([a-zç]+)/);
  if (!match) return "";
  const months: Record<string, number> = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
  const month = months[match[2].slice(0, 3)];
  if (month === undefined) return "";
  const now = new Date();
  const parsed = new Date(now.getFullYear(), month, Number(match[1]), 12);
  if (parsed.getTime() > now.getTime() + 7 * 86_400_000) parsed.setFullYear(parsed.getFullYear() - 1);
  return localDateKey(parsed);
}

function pagesInSession(session: Session) {
  return session.pagesRead ?? Math.max(0, session.end - session.start + 1);
}

function averageBookWpm(book: Book) {
  const sessions = book.sessions.filter((session) => Boolean(session.wpm));
  return sessions.length ? Math.round(sessions.reduce((sum, session) => sum + (session.wpm ?? 0), 0) / sessions.length) : 0;
}

function primaryTags(books: Book[], book: Book, limit = 3) {
  const usage = new Map<string, number>();
  books.forEach((item) => item.tags.forEach((tag) => usage.set(tag, (usage.get(tag) ?? 0) + 1)));
  return [...new Set(book.tags)].filter((tag) => tag.trim().length > 0 && tag.trim().length <= 48).sort((left, right) => (usage.get(right) ?? 0) - (usage.get(left) ?? 0) || left.localeCompare(right, "pt-BR")).slice(0, limit);
}

function primaryCategories(book: Book, limit = 3) {
  return [...new Set(book.categories)].filter((category) => category.trim().length > 0 && category.trim().length <= 48).slice(0, limit);
}

function aggregateChart(days: Date[], values: number[], maxBuckets = 15) {
  const bucketSize = Math.max(1, Math.ceil(values.length / maxBuckets));
  const result: Array<{ key: string; label: string; value: number }> = [];
  for (let index = 0; index < values.length; index += bucketSize) {
    const slice = values.slice(index, index + bucketSize);
    const date = days[Math.min(days.length - 1, index + slice.length - 1)];
    result.push({ key: localDateKey(date), label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: values.length > 15 ? "2-digit" : undefined, weekday: values.length <= 15 ? "short" : undefined }).format(date).replace("-feira", "").slice(0, 5), value: slice.reduce((sum, value) => sum + value, 0) });
  }
  return result;
}

function bookFromServer(item: Record<string, unknown>): Book {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = typeof item.metadataJson === "string" ? JSON.parse(item.metadataJson) as Record<string, unknown> : {};
  } catch { /* preserve the book even if legacy metadata is malformed */ }
  const categories = Array.isArray(metadata.categories) ? metadata.categories.filter((value): value is string => typeof value === "string") : [];
  const tags = Array.isArray(metadata.tags) ? metadata.tags.filter((value): value is string => typeof value === "string") : [];
  return {
    id: String(item.id), title: String(item.title), author: String(item.author),
    coverUrl: String(item.coverUrl ?? ""), pages: Number(item.pages ?? 0),
    currentPage: Number(item.currentPage ?? 0), status: (item.status ?? "want") as Status,
    rating: Number(item.rating ?? 0), favorite: Boolean(item.favorite),
    description: String(item.description ?? ""), published: String(metadata.published ?? ""),
    publisher: String(metadata.publisher ?? ""), language: String(metadata.language ?? ""),
    isbn: String(metadata.isbn ?? ""), categories, tags, accent: String(metadata.accent ?? "#7fd6ca"),
    sessions: [],
  };
}

function uniqueBooks(items: Book[]) {
  const seen = new Set<string>();
  const unique: Book[] = [];
  items.forEach((book) => {
    if (!book?.id || seen.has(book.id)) return;
    seen.add(book.id);
    unique.push({
      ...book,
      pages: Number.isFinite(Number(book.pages)) ? Math.max(0, Number(book.pages)) : 0,
      currentPage: Number.isFinite(Number(book.currentPage)) ? Math.max(0, Number(book.currentPage)) : 0,
      sessions: Array.isArray(book.sessions) ? book.sessions : [],
      categories: Array.isArray(book.categories) ? book.categories : [],
      tags: Array.isArray(book.tags) ? book.tags : [],
    });
  });
  return unique;
}

async function initializeStats() {
  if (isNativeRuntime()) {
    const existing = await mobileStoreGet<{ initializedAt: string }>("library", "stats");
    if (!existing) {
      await mobileStorePut("library", "stats", { currentStreak: 0, bestStreak: 0, booksRead: 0, pagesRead: 0, initializedAt: new Date().toISOString() });
    }
    return;
  }
  if (localStorage.getItem("mybookshelf-stats-initialized-v1") === "true") return;
  try {
    const response = await fetch("/api/stats", { method: "POST" });
    if (response.ok) localStorage.setItem("mybookshelf-stats-initialized-v1", "true");
  } catch { /* initialization remains safely retryable */ }
}

type NativeWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean };
};

function isNativeRuntime() {
  return typeof window !== "undefined" && Boolean((window as NativeWindow).Capacitor?.isNativePlatform?.());
}

function openMobileDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("mybookshelf-mobile-v1", 4);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("library")) database.createObjectStore("library");
      if (!database.objectStoreNames.contains("covers")) database.createObjectStore("covers");
      if (!database.objectStoreNames.contains("documents")) database.createObjectStore("documents");
      if (!database.objectStoreNames.contains("readerProgress")) database.createObjectStore("readerProgress");
    };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
  });
}

async function mobileStoreGet<T>(storeName: "library" | "covers", key: string) {
  const database = await openMobileDatabase();
  return new Promise<T | undefined>((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).get(key);
    request.onsuccess = () => { database.close(); resolve(request.result as T | undefined); };
    request.onerror = () => { database.close(); reject(request.error); };
  });
}

async function mobileStorePut(storeName: "library" | "covers", key: string, value: unknown) {
  const database = await openMobileDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value, key);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

async function loadNativeCover(bookId: string, coverUrl: string) {
  const cached = await mobileStoreGet<Blob>("covers", bookId);
  if (cached) return URL.createObjectURL(cached);
  if (!coverUrl || !navigator.onLine) return coverUrl;
  const response = await fetch(coverUrl);
  if (!response.ok) return coverUrl;
  const blob = await response.blob();
  await mobileStorePut("covers", bookId, blob);
  return URL.createObjectURL(blob);
}

const METADATA_TIMEOUT_MS = 12_000;
const metadataSearchCache = new Map<string, { expiresAt: number; results: SearchResult[] }>();

async function fetchMetadataJson<T>(url: string, timeoutMs = METADATA_TIMEOUT_MS, retries = 0): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Fonte de metadados respondeu ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json") && !contentType.includes("javascript")) throw new Error("A fonte de metadados devolveu uma resposta inválida");
    return await response.json() as T;
  } catch (reason) {
    if (retries > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 450));
      return fetchMetadataJson<T>(url, timeoutMs, retries - 1);
    }
    if (reason instanceof DOMException && reason.name === "AbortError") throw new Error("A fonte de metadados excedeu o tempo de resposta");
    throw reason;
  } finally { window.clearTimeout(timer); }
}

async function searchOpenLibraryDirect(title: string, author: string, isbn = ""): Promise<SearchResult[]> {
  const request = async (byIsbn: boolean) => {
    const query = new URLSearchParams({
      limit: "12",
      fields: "key,title,author_name,cover_i,number_of_pages_median,first_publish_year,publisher,language,isbn",
    });
    if (byIsbn) query.set("q", `isbn:${isbn.replace(/[^\dX]/gi, "")}`);
    else {
      query.set("title", title.trim());
      if (author.trim() && author.trim() !== "Autor não informado") query.set("author", author.trim());
    }
    const data = await fetchMetadataJson<{ docs?: Array<Record<string, unknown>> }>(`https://openlibrary.org/search.json?${query}`);
    return data.docs ?? [];
  };
  let documents = await request(Boolean(isbn.trim()));
  if (!documents.length && isbn.trim() && title.trim()) documents = await request(false);
  return documents.map((document) => {
    const authors = document.author_name as string[] | undefined;
    const publishers = document.publisher as string[] | undefined;
    const languages = document.language as string[] | undefined;
    const isbns = document.isbn as string[] | undefined;
    const coverId = Number(document.cover_i ?? 0);
    return {
      sourceId: String(document.key ?? crypto.randomUUID()),
      title: String(document.title ?? "Título não informado"),
      author: authors?.[0] ?? "Autor não informado",
      coverUrl: coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : "",
      pages: Number(document.number_of_pages_median ?? 0),
      published: document.first_publish_year ? String(document.first_publish_year) : "",
      publisher: publishers?.[0] ?? "",
      language: languages?.[0]?.toUpperCase() ?? "",
      isbn: isbns?.[0] ?? "",
      description: "",
      categories: [],
      tags: [],
    };
  });
}

async function searchGoogleBooksDirect(title: string, author: string, isbn = ""): Promise<SearchResult[]> {
  const cleanTitle = title.trim().replace(/["“”]/g, "");
  const cleanAuthor = author.trim().replace(/["“”]/g, "");
  const queryValue = isbn.trim() ? `isbn:${isbn.replace(/[^\dX]/gi, "")}` : `intitle:"${cleanTitle}"${cleanAuthor && cleanAuthor !== "Autor não informado" ? ` inauthor:"${cleanAuthor}"` : ""}`;
  const query = new URLSearchParams({ q: queryValue, maxResults: "10", printType: "books", projection: "full" });
  const data = await fetchMetadataJson<{ items?: Array<{ id?: string; volumeInfo?: Record<string, unknown> }> }>(`https://www.googleapis.com/books/v1/volumes?${query}`);
  return (data.items ?? []).map((item) => {
    const info = item.volumeInfo ?? {};
    const authors = info.authors as string[] | undefined;
    const categories = info.categories as string[] | undefined;
    const identifiers = info.industryIdentifiers as Array<{ type?: string; identifier?: string }> | undefined;
    const imageLinks = info.imageLinks as Record<string, string> | undefined;
    const classification = classifyBookSubjects(categories ?? []);
    const cover = imageLinks?.extraLarge || imageLinks?.large || imageLinks?.medium || imageLinks?.small || imageLinks?.thumbnail || imageLinks?.smallThumbnail || "";
    const identifier = identifiers?.find((value) => value.type === "ISBN_13")?.identifier ?? identifiers?.find((value) => value.type === "ISBN_10")?.identifier ?? "";
    return {
      sourceId: `google:${item.id ?? crypto.randomUUID()}`,
      title: String(info.title ?? "Título não informado"),
      author: authors?.[0] ?? "Autor não informado",
      coverUrl: cover.replace(/^http:/, "https:").replace(/&zoom=\d/, "&zoom=3"),
      pages: Number(info.pageCount ?? 0),
      published: String(info.publishedDate ?? "").slice(0, 4),
      publisher: String(info.publisher ?? ""),
      language: String(info.language ?? "").toUpperCase(),
      isbn: identifier,
      description: String(info.description ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      ...classification,
    };
  });
}

async function searchAppleBooksDirect(title: string, author: string): Promise<SearchResult[]> {
  type AppleBook = {
    trackId?: number;
    trackName?: string;
    artistName?: string;
    artworkUrl100?: string;
    releaseDate?: string;
    sellerName?: string;
    description?: string;
    genres?: string[];
    trackViewUrl?: string;
  };
  const cleanAuthor = author.trim() === "Autor não informado" ? "" : author.trim();
  const query = new URLSearchParams({ term: `${title.trim()} ${cleanAuthor}`.trim(), entity: "ebook", limit: "12", country: "br", lang: "pt_br" });
  const data = await fetchMetadataJson<{ results?: AppleBook[] }>(`https://itunes.apple.com/search?${query}`, 8_000, 2);
  return (data.results ?? []).map((book) => {
    const classification = classifyBookSubjects(book.genres ?? []);
    return {
      sourceId: `apple:${book.trackId ?? crypto.randomUUID()}`,
      title: book.trackName?.trim() || "Título não informado",
      author: book.artistName?.trim() || "Autor não informado",
      coverUrl: (book.artworkUrl100 ?? "").replace(/^http:/, "https:").replace(/\/\d+x\d+bb\./, "/600x600bb."),
      pages: 0,
      published: (book.releaseDate ?? "").slice(0, 4),
      publisher: book.sellerName?.trim() ?? "",
      language: "",
      isbn: "",
      description: book.description?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "",
      detailsUrl: book.trackViewUrl?.replace(/^http:/, "https:") ?? "",
      ...classification,
    };
  });
}

function parseAppleBookSchema(html: string) {
  const raw = html.match(/<script[^>]+(?:name="schema:book"|type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/i)?.[1]?.trim();
  if (!raw) return undefined;
  try {
    const schema = JSON.parse(raw) as { "@type"?: string; numberOfPages?: number; isbn?: string; publisher?: string | { name?: string }; inLanguage?: string };
    if (schema["@type"] !== "Book") return undefined;
    return {
      pages: Number(schema.numberOfPages ?? 0),
      isbn: String(schema.isbn ?? ""),
      publisher: typeof schema.publisher === "string" ? schema.publisher : schema.publisher?.name ?? "",
      language: String(schema.inLanguage ?? "").toUpperCase(),
    };
  } catch { return undefined; }
}

async function enrichAppleBookResult(result: SearchResult) {
  if (!result.detailsUrl) return result;
  try {
    const details = isNativeRuntime()
      ? parseAppleBookSchema(String((await CapacitorHttp.get({ url: result.detailsUrl, responseType: "text", connectTimeout: 7_000, readTimeout: 7_000 })).data ?? ""))
      : await fetchMetadataJson<{ pages?: number; isbn?: string; publisher?: string; language?: string }>(`/api/books/apple?url=${encodeURIComponent(result.detailsUrl)}`, 9_000);
    if (!details) return result;
    return { ...result, pages: Number(details.pages ?? 0) || result.pages, isbn: details.isbn || result.isbn, publisher: details.publisher || result.publisher, language: details.language || result.language };
  } catch { return result; }
}

function wikipediaAuthor(extract: string) {
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

async function searchWikipediaDirect(title: string, author: string): Promise<SearchResult[]> {
  type WikipediaPage = { pageid?: number; title?: string; extract?: string; thumbnail?: { source?: string }; original?: { source?: string } };
  const cleanAuthor = author.trim() === "Autor não informado" ? "" : author.trim();
  const query = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: `${title.trim()} ${cleanAuthor} livro`.trim(), gsrnamespace: "0", gsrlimit: "8",
    prop: "pageimages|extracts", piprop: "thumbnail|original", pithumbsize: "700", exintro: "1", explaintext: "1", format: "json", origin: "*",
  });
  const data = await fetchMetadataJson<{ query?: { pages?: Record<string, WikipediaPage> } }>(`https://pt.wikipedia.org/w/api.php?${query}`, 8_000, 1);
  return Object.values(data.query?.pages ?? {}).filter((page) => /\b(livro|romance|novela|obra literária|conto|ficção|literário|literária)\b/i.test(page.extract ?? "")).map((page) => {
    const extract = page.extract?.replace(/\s+/g, " ").trim() ?? "";
    const publication = extract.match(/(?:publicad[oa]|lançad[oa]|escrit[oa])[^.\n]{0,60}\b((?:18|19|20)\d{2})\b/i)?.[1] ?? "";
    const classification = classifyBookSubjects([page.title ?? "", extract]);
    return {
      sourceId: `wikipedia:${page.pageid ?? crypto.randomUUID()}`,
      title: page.title?.replace(/\s*\([^)]*(?:livro|romance)[^)]*\)\s*$/i, "").trim() || title.trim(),
      author: wikipediaAuthor(extract) || "Autor não informado",
      coverUrl: (page.original?.source || page.thumbnail?.source || "").replace(/^http:/, "https:"),
      pages: 0,
      published: publication,
      publisher: "",
      language: "PT",
      isbn: "",
      description: extract,
      ...classification,
    };
  });
}

async function searchGutendexDirect(title: string, author: string): Promise<SearchResult[]> {
  type GutendexBook = {
    id?: number;
    title?: string;
    authors?: Array<{ name?: string }>;
    subjects?: string[];
    bookshelves?: string[];
    languages?: string[];
    formats?: Record<string, string>;
  };
  const cleanAuthor = author.trim() === "Autor não informado" ? "" : author.trim();
  const query = new URLSearchParams({ search: `${title.trim()} ${cleanAuthor}`.trim() });
  const data = await fetchMetadataJson<{ results?: GutendexBook[] }>(`https://gutendex.com/books/?${query}`, 8_000);
  return (data.results ?? []).slice(0, 10).map((book) => {
    const subjects = [...(book.subjects ?? []), ...(book.bookshelves ?? [])];
    const classification = classifyBookSubjects(subjects);
    return {
      sourceId: `gutendex:${book.id ?? crypto.randomUUID()}`,
      title: book.title?.trim() || "Título não informado",
      author: book.authors?.[0]?.name?.trim() || "Autor não informado",
      coverUrl: (book.formats?.["image/jpeg"] ?? "").replace(/^http:/, "https:"),
      pages: 0,
      published: "",
      publisher: "Project Gutenberg",
      language: book.languages?.[0]?.toUpperCase() ?? "",
      isbn: "",
      description: "",
      ...classification,
    };
  });
}

async function enrichOpenLibraryResult(result: SearchResult) {
  const key = result.sourceId.startsWith("/") ? result.sourceId : `/works/${result.sourceId}`;
  if (!key.startsWith("/works/")) return result;
  try {
    const work = await fetchMetadataJson<{ description?: string | { value?: string }; subjects?: string[]; covers?: number[] }>(`https://openlibrary.org${key}.json`, 7_000);
    const description = typeof work.description === "string" ? work.description : work.description?.value ?? "";
    const classification = classifyBookSubjects(work.subjects ?? []);
    const coverId = work.covers?.find((id) => id > 0);
    return { ...result, description, coverUrl: result.coverUrl || (coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : ""), categories: classification.categories.length ? classification.categories : result.categories, tags: classification.tags.length ? classification.tags : result.tags };
  } catch { return result; }
}

function normalizeMetadataText(value: string) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function metadataWords(value: string) {
  return normalizeMetadataText(value).split(" ").filter((word) => word.length > 2);
}

function isCredibleMetadata(title: string, author: string, isbn: string, item: SearchResult) {
  const compact = (value: string) => normalizeMetadataText(value).replace(/\s+/g, "");
  const wantedTitle = compact(title);
  const candidateTitle = compact(item.title);
  const wantedIsbn = isbn.replace(/[^\dX]/gi, "");
  const candidateIsbn = item.isbn.replace(/[^\dX]/gi, "");
  if (wantedIsbn && candidateIsbn === wantedIsbn) return true;
  if (!wantedTitle || !candidateTitle) return false;

  const exactTitle = candidateTitle === wantedTitle;
  const containmentRatio = Math.min(wantedTitle.length, candidateTitle.length) / Math.max(wantedTitle.length, candidateTitle.length);
  const containedTitle = (candidateTitle.includes(wantedTitle) || wantedTitle.includes(candidateTitle)) && containmentRatio >= .55;
  const wantedWords = metadataWords(title);
  const candidateWords = metadataWords(item.title);
  const shared = wantedWords.filter((word) => candidateWords.includes(word)).length;
  const coverage = wantedWords.length ? shared / wantedWords.length : 0;
  const precision = candidateWords.length ? shared / candidateWords.length : 0;
  const orderedTitle = candidateTitle.startsWith(wantedTitle) || candidateTitle.endsWith(wantedTitle);
  const matchingTitle = exactTitle || containedTitle || orderedTitle || (wantedWords.length >= 3 && coverage >= .66 && precision >= .5);
  if (!matchingTitle) return false;

  const requestedAuthor = normalizeMetadataText(author);
  if (!requestedAuthor || requestedAuthor === normalizeMetadataText("Autor não informado")) return true;
  const candidateAuthor = normalizeMetadataText(item.author);
  if (!candidateAuthor || candidateAuthor === normalizeMetadataText("Autor não informado")) return exactTitle;
  const wantedAuthorWords = metadataWords(author);
  const itemAuthorWords = metadataWords(item.author);
  const sharedAuthorWords = wantedAuthorWords.filter((word) => itemAuthorWords.includes(word)).length;
  const authorMatch = compact(item.author).includes(compact(author)) || compact(author).includes(compact(item.author))
    || (wantedAuthorWords.length > 0 && sharedAuthorWords / wantedAuthorWords.length >= .5);
  return exactTitle || authorMatch;
}

function metadataMatchScore(title: string, author: string, isbn: string, item: SearchResult) {
  const normalized = (value: string) => normalizeMetadataText(value).replace(/\s+/g, "");
  const wantedTitle = normalized(title);
  const wantedAuthor = normalized(author);
  const wantedIsbn = isbn.replace(/[^\dX]/gi, "");
  const titleWords = new Set(normalizeMetadataText(title).split(" ").filter((word) => word.length > 2));
  const itemWords = new Set(normalizeMetadataText(item.title).split(" ").filter((word) => word.length > 2));
  const sharedWords = [...titleWords].filter((word) => itemWords.has(word)).length;
  const overlap = titleWords.size ? sharedWords / titleWords.size : 0;
  return (wantedIsbn && item.isbn.replace(/[^\dX]/gi, "") === wantedIsbn ? 100 : 0)
    + (normalized(item.title) === wantedTitle ? 35 : normalized(item.title).includes(wantedTitle) || wantedTitle.includes(normalized(item.title)) ? 18 : Math.round(overlap * 14))
    + (wantedAuthor && wantedAuthor !== normalized("Autor não informado") && normalized(item.author).includes(wantedAuthor) ? 25 : 0)
    + (item.coverUrl ? 3 : 0)
    + (item.description ? 1 : 0);
}

function bestMetadataFor(title: string, author: string, isbn: string, results: SearchResult[]) {
  return results.slice().sort((left, right) => {
    return metadataMatchScore(title, author, isbn, right) - metadataMatchScore(title, author, isbn, left);
  })[0];
}

function mergeMetadataResult(primary: SearchResult, supplements: SearchResult[], requestedIsbn: string) {
  const compatible = supplements.filter((item) => item.sourceId !== primary.sourceId && isCredibleMetadata(primary.title, primary.author, requestedIsbn, item));
  const pageSource = bestMetadataFor(primary.title, primary.author, requestedIsbn, compatible.filter((item) => item.pages > 0));
  const detailSource = bestMetadataFor(primary.title, primary.author, requestedIsbn, compatible);
  const uniqueValues = (values: string[]) => values.filter((value, index) => value && values.findIndex((candidate) => candidate.localeCompare(value, "pt-BR", { sensitivity: "base" }) === 0) === index);
  return {
    ...primary,
    pages: primary.pages || pageSource?.pages || 0,
    published: primary.published || detailSource?.published || "",
    publisher: primary.publisher || detailSource?.publisher || "",
    language: primary.language || detailSource?.language || "",
    isbn: primary.isbn || detailSource?.isbn || "",
    description: primary.description || detailSource?.description || "",
    categories: uniqueValues([...(primary.categories ?? []), ...(detailSource?.categories ?? [])]),
    tags: uniqueValues([...(primary.tags ?? []), ...(detailSource?.tags ?? [])]),
  };
}

async function searchMetadataCandidates(title: string, author: string, isbn = "") {
  const cacheKey = `${title}|${author}|${isbn}`.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  const cached = metadataSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.results;
  const firstAvailable = async (requestedAuthor: string, requestedIsbn: string) => {
    const credibleResults = async (request: Promise<SearchResult[]>) => {
      try {
        const items = await request;
        return items.filter((item) => isCredibleMetadata(title, requestedAuthor, requestedIsbn, item));
      } catch { return [] as SearchResult[]; }
    };
    const [appleBase, googleBooks] = await Promise.all([
      credibleResults(searchAppleBooksDirect(title, requestedAuthor)),
      credibleResults(searchGoogleBooksDirect(title, requestedAuthor, requestedIsbn)),
    ]);
    const apple = appleBase.length ? [await enrichAppleBookResult(appleBase[0]), ...appleBase.slice(1)] : [];
    const appleWithGoogle = apple.map((item) => mergeMetadataResult(item, googleBooks, requestedIsbn));
    if (appleWithGoogle.some((item) => item.pages > 0)) return appleWithGoogle;
    if (!apple.length && googleBooks.some((item) => item.pages > 0)) return googleBooks;
    const openLibrary = await credibleResults(searchOpenLibraryDirect(title, requestedAuthor, requestedIsbn));
    const bibliographic = [...googleBooks, ...openLibrary];
    if (apple.length) return apple.map((item) => mergeMetadataResult(item, bibliographic, requestedIsbn));
    if (bibliographic.length) return bibliographic.map((item) => mergeMetadataResult(item, bibliographic, requestedIsbn));
    const wikipedia = await credibleResults(searchWikipediaDirect(title, requestedAuthor));
    if (wikipedia.some((item) => item.coverUrl)) return wikipedia;
    const gutendex = await credibleResults(searchGutendexDirect(title, requestedAuthor));
    return gutendex.length ? gutendex : wikipedia;
  };
  let results = await firstAvailable(author, isbn);
  if (!results.length && (author.trim() || isbn.trim())) results = await firstAvailable("", "");
  const unique = results.filter((item, index) => results.findIndex((candidate) => candidate.title.localeCompare(item.title, "pt-BR", { sensitivity: "base" }) === 0 && candidate.author.localeCompare(item.author, "pt-BR", { sensitivity: "base" }) === 0) === index);
  const ranked: SearchResult[] = [];
  const remaining = [...unique];
  while (remaining.length) {
    const best = bestMetadataFor(title, author, isbn, remaining);
    if (!best) break;
    ranked.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }
  if (ranked.length) metadataSearchCache.set(cacheKey, { expiresAt: Date.now() + 30 * 60_000, results: ranked });
  return ranked;
}

async function researchBookMetadata(title: string, author: string, isbn = "") {
  const results = await searchMetadataCandidates(title, author, isbn).catch(() => []);
  const match = bestMetadataFor(title, author, isbn, results);
  return match?.sourceId.startsWith("/works/") ? enrichOpenLibraryResult(match) : match;
}

function Cover({ book, size = "medium" }: { book: Book; size?: "small" | "medium" | "large" }) {
  const [brokenUrl, setBrokenUrl] = useState("");
  const [cachedCover, setCachedCover] = useState<{ source: string; url: string }>({ source: "", url: "" });
  const displayUrl = cachedCover.source === book.coverUrl ? cachedCover.url : book.coverUrl;
  useEffect(() => {
    let objectUrl = "";
    if (!isNativeRuntime() || !book.coverUrl.startsWith("http")) return;
    loadNativeCover(book.id, book.coverUrl).then((url) => {
      objectUrl = url.startsWith("blob:") ? url : "";
      setCachedCover({ source: book.coverUrl, url });
    }).catch(() => undefined);
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [book.id, book.coverUrl]);
  return (
    <div className={`book-cover book-cover--${size}`} style={{ "--cover-accent": book.accent } as React.CSSProperties}>
      {displayUrl && brokenUrl !== displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt={`Capa de ${book.title}`} onError={() => setBrokenUrl(displayUrl)} />
      ) : (
        <span>{book.title}</span>
      )}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress-track" aria-label={`${value}% concluído`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function Heatmap({ cells = Array.from({ length: 119 }, () => 0) }: { cells?: number[] }) {
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-months"><span>mai</span><span>jun</span><span>jul</span><span>ago</span></div>
      <div className="heatmap" role="img" aria-label="Mapa de intensidade de leitura dos últimos quatro meses">
        {cells.map((level, index) => (
          <span key={index} className={`heat-${level}`} title={`${level * 18} páginas`} />
        ))}
      </div>
      <div className="heatmap-legend"><span>Menos</span>{[0, 1, 2, 3, 4].map((n) => <i key={n} className={`heat-${n}`} />)}<span>Mais</span></div>
    </div>
  );
}

function AppChoice({ label, value, options, onChange, className = "" }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "";
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOutside, true);
    document.addEventListener("keydown", closeEscape);
    return () => { document.removeEventListener("pointerdown", closeOutside, true); document.removeEventListener("keydown", closeEscape); };
  }, [open]);
  return <div ref={root} className={`app-choice ${className}`}><button type="button" className="app-choice-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{selected}</span><i aria-hidden="true">⌄</i></button>{open && <div className="app-choice-options" role="listbox" aria-label={label}>{options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? "active" : ""} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}</div>}</div>;
}

export function BookshelfApp() {
  const [books, setBooks] = useState<Book[]>([]);
  const [section, setSection] = useState("dashboard");
  const [theme, setTheme] = useState<Theme>("light");
  const [style, setStyle] = useState<VisualStyle>("minimal");
  const [accent, setAccent] = useState(accentOptions[0]);
  const [appFont, setAppFont] = useState<AppFont>("original");
  const [interfaceScale, setInterfaceScale] = useState<InterfaceScale>("medium");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showReading, setShowReading] = useState(false);
  const [showReader, setShowReader] = useState(false);
  const [readerDocument, setReaderDocument] = useState<ReaderDocument | null>(null);
  const [openingReader, setOpeningReader] = useState(false);
  const [attachBook, setAttachBook] = useState<Book | null>(null);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(true);
  const [settingsReady, setSettingsReady] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [organizationFilter, setOrganizationFilter] = useState<{ label: string; bookIds: string[] } | null>(null);
  const [organizationDialog, setOrganizationDialog] = useState<{ kind: OrganizationKind; item?: OrganizationItem } | null>(null);
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null);
  const hydrated = useRef(false);
  const organizationsHydrated = useRef(false);
  const metadataAttempts = useRef(new Set<string>());
  const nativeBackState = useRef<{
    showReader: boolean;
    editingBook: Book | null;
    attachBook: Book | null;
    tutorialStep: number | null;
    organizationDialog: { kind: OrganizationKind; item?: OrganizationItem } | null;
    showReading: boolean;
    showAdd: boolean;
    showPrefs: boolean;
    mobileMenuOpen: boolean;
    selectedBook: Book | null;
    section: string;
  }>({ showReader: false, editingBook: null, attachBook: null, tutorialStep: null, organizationDialog: null, showReading: false, showAdd: false, showPrefs: false, mobileMenuOpen: false, selectedBook: null, section: "dashboard" });
  const nativeBackLockedUntil = useRef(0);

  const closeReaderToBook = useCallback(() => {
    const book = nativeBackState.current.selectedBook;
    nativeBackState.current = { ...nativeBackState.current, showReader: false, selectedBook: book };
    setShowReader(false);
    setReaderDocument(null);
    if (book) setSelectedBook((current) => current ?? book);
  }, []);

  useEffect(() => {
    const native = isNativeRuntime();
    let active = true;
    prepareReaderStorage().catch(() => undefined);
    // The browser connection state is the external source synchronized by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const initialize = async () => {
      const resetMarker = native ? "mybookshelf-native-first-user-v3" : "mybookshelf-web-first-user-v3";
      if (localStorage.getItem(resetMarker) !== "ready") {
        localStorage.setItem(resetMarker, "ready");
      }

      const settings = localStorage.getItem("mybookshelf-settings-v1");
      if (settings) {
        try {
          const parsed = JSON.parse(settings) as { theme?: Theme; style?: VisualStyle; accent?: string; appFont?: AppFont | "sans" | "accessible"; interfaceScale?: InterfaceScale };
          if (parsed.theme) setTheme(parsed.theme);
          if (parsed.style) setStyle(parsed.style);
          if (parsed.accent) setAccent(parsed.accent);
          if (parsed.appFont === "sans") setAppFont("arial");
          else if (parsed.appFont === "accessible") setAppFont("courier");
          else if (["original", "serif", "arial", "courier"].includes(parsed.appFont ?? "")) setAppFont(parsed.appFont as AppFont);
          if (["small", "medium", "large"].includes(parsed.interfaceScale ?? "")) setInterfaceScale(parsed.interfaceScale!);
        } catch { /* keep defaults */ }
      }
      if (!active) return;
      setSettingsReady(true);
      const tutorialCompleted = localStorage.getItem("mybookshelf-tutorial-v1") === "completed";
      if (!tutorialCompleted) setTutorialStep(0);
      else initializeStats().catch(() => undefined);

      if (native) {
        const [storedBooks, storedOrganizations] = await Promise.all([
          mobileStoreGet<Book[]>("library", "books").catch(() => undefined),
          mobileStoreGet<OrganizationItem[]>("library", "organizations").catch(() => undefined),
        ]);
        let mirroredBooks: Book[] | undefined;
        let mirroredOrganizations: OrganizationItem[] | undefined;
        try {
          const value = localStorage.getItem("mybookshelf-native-library-v1");
          if (value !== null) mirroredBooks = JSON.parse(value) as Book[];
        } catch { /* IndexedDB remains the primary recovery source */ }
        try {
          const value = localStorage.getItem("mybookshelf-native-organizations-v1");
          if (value !== null) mirroredOrganizations = JSON.parse(value) as OrganizationItem[];
        } catch { /* IndexedDB remains the primary recovery source */ }
        const restoredBooks = uniqueBooks(mirroredBooks ?? storedBooks ?? []);
        const restoredOrganizations = mirroredOrganizations ?? storedOrganizations ?? [];
        if (active) setBooks(restoredBooks);
        if (active) setOrganizations(restoredOrganizations);
        initializeReadingNotifications(restoredBooks).catch(() => undefined);
      } else {
        const cached = localStorage.getItem("mybookshelf-library-v1");
        const cachedOrganizations = localStorage.getItem("mybookshelf-organizations-v1");
        let localLibraryLoaded = false;
        let localOrganizationsLoaded = false;
        if (cached !== null) {
          try { setBooks(uniqueBooks(JSON.parse(cached) as Book[])); localLibraryLoaded = true; } catch { /* recover from the server once */ }
        }
        if (cachedOrganizations !== null) {
          try { setOrganizations(JSON.parse(cachedOrganizations) as OrganizationItem[]); localOrganizationsLoaded = true; } catch { /* recover from the server once */ }
        }
        const [libraryData, organizationData] = await Promise.all([
          localLibraryLoaded ? Promise.resolve({ books: [] }) : fetch("/api/library").then((response) => response.json()).catch(() => ({ books: [] })),
          localOrganizationsLoaded ? Promise.resolve({ items: [] }) : fetch("/api/organization").then((response) => response.json()).catch(() => ({ items: [] })),
        ]) as [{ books?: Array<Record<string, unknown>> }, { items?: OrganizationItem[] }];
        if (active && !localLibraryLoaded) {
          const initialBooks = uniqueBooks((libraryData.books ?? []).map(bookFromServer));
          setBooks(initialBooks);
          localStorage.setItem("mybookshelf-library-v1", JSON.stringify(initialBooks));
        }
        if (active && !localOrganizationsLoaded) {
          const initialOrganizations = organizationData.items ?? [];
          setOrganizations(initialOrganizations);
          localStorage.setItem("mybookshelf-organizations-v1", JSON.stringify(initialOrganizations));
        }
      }
      hydrated.current = true;
      organizationsHydrated.current = true;
    };
    initialize().catch(() => {
      hydrated.current = true;
      organizationsHydrated.current = true;
    });
    if (!native && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    if (isNativeRuntime()) {
      try { localStorage.setItem("mybookshelf-native-library-v1", JSON.stringify(books)); } catch { /* IndexedDB still preserves larger libraries */ }
      mobileStorePut("library", "books", books).catch(() => undefined);
    }
    else localStorage.setItem("mybookshelf-library-v1", JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    if (!settingsReady) return;
    localStorage.setItem("mybookshelf-settings-v1", JSON.stringify({ theme, style, accent, appFont, interfaceScale }));
  }, [theme, style, accent, appFont, interfaceScale, settingsReady]);

  useEffect(() => {
    if (!hydrated.current || !online) return;
    const targets = books.filter((book) => !book.manualCover && !book.coverUrl && !metadataAttempts.current.has(book.id)).slice(0, 2);
    if (!targets.length) return;
    targets.forEach((book) => metadataAttempts.current.add(book.id));
    Promise.all(targets.map(async (book) => ({ id: book.id, metadata: await researchBookMetadata(book.title, book.author, book.isbn).catch(() => undefined) }))).then((updates) => {
      setBooks((current) => current.map((book) => {
        const metadata = updates.find((update) => update.id === book.id)?.metadata;
        if (!metadata) return book;
        return { ...book, coverUrl: book.coverUrl || metadata.coverUrl, pages: book.pages || metadata.pages, description: book.description || metadata.description, published: book.published || metadata.published, publisher: book.publisher || metadata.publisher, language: book.language || metadata.language, isbn: book.isbn || metadata.isbn, categories: book.categories.length ? book.categories : metadata.categories, tags: book.tags.length ? book.tags : metadata.tags };
      }));
    });
  }, [books, online]);

  useEffect(() => {
    if (!organizationsHydrated.current) return;
    if (isNativeRuntime()) {
      try { localStorage.setItem("mybookshelf-native-organizations-v1", JSON.stringify(organizations)); } catch { /* IndexedDB remains available */ }
      mobileStorePut("library", "organizations", organizations).catch(() => undefined);
    }
    else localStorage.setItem("mybookshelf-organizations-v1", JSON.stringify(organizations));
  }, [organizations]);

  useEffect(() => {
    let tracking = false;
    let startX = 0;
    let startY = 0;
    const start = (event: TouchEvent) => {
      if (window.innerWidth > 860) return;
      const touch = event.touches[0];
      if (!mobileMenuOpen && touch.clientX > 28) return;
      tracking = true;
      startX = touch.clientX;
      startY = touch.clientY;
    };
    const end = (event: TouchEvent) => {
      if (!tracking) return;
      const touch = event.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 56) {
        if (!mobileMenuOpen && deltaX > 0) setMobileMenuOpen(true);
        if (mobileMenuOpen && deltaX < 0) setMobileMenuOpen(false);
      }
      tracking = false;
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    return () => {
      window.removeEventListener("touchstart", start);
      window.removeEventListener("touchend", end);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    nativeBackState.current = { showReader, editingBook, attachBook, tutorialStep, organizationDialog, showReading, showAdd, showPrefs, mobileMenuOpen, selectedBook, section };
  }, [attachBook, editingBook, mobileMenuOpen, organizationDialog, section, selectedBook, showAdd, showPrefs, showReader, showReading, tutorialStep]);

  useEffect(() => {
    if (!isNativeRuntime()) return;
    let disposed = false;
    let remove: (() => Promise<void>) | undefined;
    const handleNativeBack = () => {
      const now = Date.now();
      if (now < nativeBackLockedUntil.current) return;
      nativeBackLockedUntil.current = now + 450;
      const state = nativeBackState.current;
      if (state.showReader) {
        window.dispatchEvent(new Event("mybookshelf-reader-finish"));
        window.setTimeout(() => { if (nativeBackState.current.showReader) closeReaderToBook(); }, 0);
      } else if (state.editingBook) setEditingBook(null);
      else if (state.attachBook) setAttachBook(null);
      else if (state.tutorialStep !== null) { localStorage.setItem("mybookshelf-tutorial-v1", "completed"); initializeStats().catch(() => undefined); setTutorialStep(null); }
      else if (state.organizationDialog) setOrganizationDialog(null);
      else if (state.showReading) setShowReading(false);
      else if (state.showAdd) setShowAdd(false);
      else if (state.showPrefs) setShowPrefs(false);
      else if (state.mobileMenuOpen) setMobileMenuOpen(false);
      else if (state.selectedBook) setSelectedBook(null);
      else if (state.section !== "dashboard") { setSection("dashboard"); setSelectedBook(null); setQuery(""); setOrganizationFilter(null); setFilter("all"); setMobileMenuOpen(false); }
      else CapacitorApp.minimizeApp();
    };
    window.addEventListener("mybookshelf-native-back", handleNativeBack);
    CapacitorApp.addListener("backButton", handleNativeBack).then((handle) => {
      if (disposed) handle.remove();
      else remove = () => handle.remove();
    });
    return () => { disposed = true; window.removeEventListener("mybookshelf-native-back", handleNativeBack); remove?.(); };
  }, [closeReaderToBook]);

  useEffect(() => {
    if (!isNativeRuntime() || !hydrated.current) return;
    const timer = window.setTimeout(() => initializeReadingNotifications(books), 900);
    return () => window.clearTimeout(timer);
  }, [books]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const visibleBooks = useMemo(() => {
    let result = books;
    if (section === "reading") result = result.filter((book) => book.status === "reading");
    if (section === "read") result = result.filter((book) => book.status === "read");
    if (section === "favorites") result = result.filter((book) => book.favorite);
    if (organizationFilter) {
      const allowed = new Set(organizationFilter.bookIds);
      result = result.filter((book) => allowed.has(book.id));
    }
    if (filter !== "all") result = result.filter((book) => book.status === filter);
    if (query.trim()) {
      const normalized = query.toLocaleLowerCase("pt-BR");
      result = result.filter((book) => `${book.title} ${book.author} ${book.tags.join(" ")} ${book.categories.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalized));
    }
    return result;
  }, [books, filter, organizationFilter, query, section]);

  const readingBook = books.find((book) => book.status === "reading");

  const navigate = (next: string) => {
    setSection(next);
    setSelectedBook(null);
    setEditingBook(null);
    setQuery("");
    setOrganizationFilter(null);
    if (["reading", "read", "favorites"].includes(next)) setFilter("all");
    setMobileMenuOpen(false);
  };

  const updateBook = (updated: Book) => {
    setBooks((current) => current.map((book) => (book.id === updated.id ? updated : book)));
    setSelectedBook((current) => current?.id === updated.id ? updated : current);
    setEditingBook((current) => current?.id === updated.id ? updated : current);
  };

  const saveBookEdition = (updated: Book) => {
    updateBook(updated);
    setEditingBook(null); setSelectedBook(updated); setToast(`${updated.title} foi salvo.`);
  };

  const changeBookStatus = (book: Book, status: Status) => {
    const updated = { ...book, status, currentPage: status === "read" && book.pages ? book.pages : book.currentPage };
    setBooks((current) => current.map((item) => item.id === book.id ? updated : item));
    setSelectedBook((current) => current?.id === book.id ? updated : current);
    fetch(`/api/library/${book.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, currentPage: updated.currentPage }) }).catch(() => undefined);
    setToast(`${book.title} agora está como ${statusLabels[status].toLowerCase()}.`);
  };

  const removeBook = (book: Book) => {
    setBooks((current) => current.filter((item) => item.id !== book.id));
    setSelectedBook((current) => current?.id === book.id ? null : current);
    fetch(`/api/library/${book.id}`, { method: "DELETE" }).catch(() => undefined);
    if (book.readerFile) deleteReaderDocument(book.id).catch(() => undefined);
    setToast(`${book.title} foi removido da biblioteca.`);
  };

  const deleteBook = (book: Book) => setConfirmation({ title: "Excluir livro", message: `“${book.title}” será removido da biblioteca e seus dados de leitura locais serão apagados.`, confirmLabel: "Excluir", onConfirm: () => removeBook(book) });

  const attachDocument = (book: Book, document: ReaderDocument) => {
    const updated: Book = { ...book, pages: book.pages || document.pages.length || document.images.length, readerFile: { fileName: document.fileName, format: document.format, storageMode: document.storageMode, pageCount: document.pages.length || document.images.length } };
    updateBook(updated); setAttachBook(null); setToast(`${document.fileName} foi anexado e está disponível offline.`);
  };

  const openReader = async (book: Book) => {
    if (openingReader) return;
    setOpeningReader(true);
    try {
      const stored = await loadReaderDocument(book.id);
      if (!stored) throw new Error("O arquivo deste livro não está disponível neste dispositivo.");
      nativeBackState.current = { ...nativeBackState.current, showReader: true, selectedBook: book };
      setReaderDocument(stored); setShowReader(true); setToast("");
    } catch (reason) { setToast(reason instanceof Error ? reason.message : "Não foi possível abrir o livro."); }
    finally { setOpeningReader(false); }
  };

  const recordReaderSession = (book: Book, result: ReadingSessionResult) => {
    const totalPages = book.readerFile?.pageCount || book.pages;
    const previousSessions = Array.isArray(book.sessions) ? book.sessions : [];
    const reachedPage = Math.min(totalPages || result.currentPage + 1, Math.max(book.currentPage, result.currentPage + 1));
    const advancedPages = Math.max(0, reachedPage - book.currentPage);
    const session: Session | undefined = advancedPages || result.wordsRead ? { date: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date()).replace(".", ""), isoDate: localDateKey(new Date()), start: book.currentPage + 1, end: reachedPage, pagesRead: advancedPages, minutes: result.minutes, wpm: result.averageWpm, source: result.source } : undefined;
    const updated: Book = { ...book, pages: book.pages || totalPages, currentPage: reachedPage, status: reachedPage >= totalPages && totalPages > 0 ? "read" : result.wordsRead || advancedPages ? "reading" : book.status, sessions: session ? [...previousSessions, session] : previousSessions, readingTimeMinutes: (book.readingTimeMinutes ?? previousSessions.reduce((sum, item) => sum + (item.minutes ?? 0), 0)) + result.minutes, rsvpWordsRead: (book.rsvpWordsRead ?? 0) + result.wordsRead };
    updateBook(updated); setToast(session ? `Sessão de ${result.minutes} min registrada automaticamente.` : "Posição de leitura salva.");
  };

  const finishTutorial = () => {
    localStorage.setItem("mybookshelf-tutorial-v1", "completed");
    initializeStats().catch(() => undefined);
    setTutorialStep(null);
  };

  const saveOrganization = (item: OrganizationItem) => {
    const inferred = organizationDialog?.item?.id.startsWith("inferred-") ? organizationDialog.item : undefined;
    const persisted = inferred ? { ...item, id: crypto.randomUUID() } : item;
    const editing = organizations.some((existing) => existing.id === persisted.id);
    const previousName = organizationDialog?.item?.name;
    const metadataKind = persisted.kind === "categories" ? "categories" : persisted.kind === "tags" ? "tags" : undefined;
    if (metadataKind) setBooks((current) => current.map((book) => {
      const names = book[metadataKind].filter((name) => !previousName || name !== previousName);
      return { ...book, [metadataKind]: persisted.bookIds.includes(book.id) ? [...new Set([...names, persisted.name])] : names };
    }));
    setOrganizations((current) => [persisted, ...current.filter((existing) => existing.id !== persisted.id)]);
    if (!isNativeRuntime()) fetch("/api/organization", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(persisted) }).catch(() => undefined);
    setOrganizationDialog(null);
    setToast(`${item.name} foi ${editing ? "atualizado" : "criado"} e salvo.`);
  };

  const removeOrganization = (item: OrganizationItem) => {
    const metadataKind = item.kind === "categories" ? "categories" : item.kind === "tags" ? "tags" : undefined;
    if (metadataKind) setBooks((current) => current.map((book) => ({ ...book, [metadataKind]: book[metadataKind].filter((name) => name !== item.name) })));
    setOrganizations((current) => current.filter((existing) => existing.id !== item.id));
    if (!isNativeRuntime()) fetch(`/api/organization?id=${encodeURIComponent(item.id)}`, { method: "DELETE" }).catch(() => undefined);
    setToast(`${item.name} foi removido da organização da biblioteca.`);
  };

  const deleteOrganization = (item: OrganizationItem) => setConfirmation({ title: `Excluir ${item.kind === "categories" ? "categoria" : item.kind === "tags" ? "tag" : "coleção"}`, message: `“${item.name}” será removido da organização da sua biblioteca.`, confirmLabel: "Excluir", onConfirm: () => removeOrganization(item) });

  const useOrganizationFilter = (item: OrganizationItem) => {
    navigate("library");
    setOrganizationFilter({ label: item.name, bookIds: item.bookIds });
    setToast(`Mostrando livros de ${item.name}.`);
  };

  const appStyle = { "--accent": accent } as React.CSSProperties;

  return (
    <main className="app-shell" data-theme={theme} data-style={style} data-font={appFont} data-interface-scale={interfaceScale} data-native={isNativeRuntime() ? "true" : undefined} style={appStyle}>
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-drawer-open" : ""}`} aria-label="Menu lateral">
        <button className="brand" onClick={() => navigate("dashboard")} aria-label="Ir para o início">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>MyBookshelf<small>Sua biblioteca viva</small></span>
        </button>
        <nav>
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map(([id, icon, label]) => (
                <button key={id} className={section === id ? "active" : ""} onClick={() => navigate(id)}>
                  <span className="nav-icon">{icon}</span><span>{label}</span>
                  {id === "reading" && <b>{books.filter((book) => book.status === "reading").length}</b>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sync-status"><i className={online ? "online" : ""} /><span>{online ? "Tudo sincronizado" : "Modo offline"}</span></div>
          <button className="profile" onClick={() => setShowPrefs(true)}><span>NG</span><span>Minha biblioteca<small>Preferências</small></span><b>···</b></button>
        </div>
      </aside>
      <button className={`drawer-backdrop ${mobileMenuOpen ? "visible" : ""}`} onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu lateral" />

      <div className="app-main">
        <header className="topbar">
          <button className="mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir menu lateral">☰</button>
          <button className="mobile-brand" onClick={() => navigate("dashboard")} aria-label="Início"><span className="brand-mark"><i /><i /><i /></span></button>
          <label className="global-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => section === "dashboard" && setSection("library")} placeholder="Buscar por título, autor ou tag…" />
            <kbd>⌘ K</kbd>
          </label>
          <div className="top-actions">
            <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Alternar tema">{theme === "dark" ? "☼" : "◐"}</button>
            <button className="icon-button" onClick={() => setShowPrefs(true)} aria-label="Personalizar interface">◈</button>
            <button type="button" className="primary-button add-book-button" onClick={() => setShowAdd(true)} aria-label="Adicionar livro" aria-haspopup="dialog"><span className="add-icon" aria-hidden="true">+</span><span className="add-label">Adicionar livro</span></button>
          </div>
        </header>

        {selectedBook ? (
          <BookDetail book={selectedBook} relatedBooks={books.filter((item) => item.id !== selectedBook.id).slice(0, 3)} onBack={() => setSelectedBook(null)} onUpdate={updateBook} onEdit={() => setEditingBook(selectedBook)} onRead={() => setShowReading(true)} onOpenReader={() => openReader(selectedBook)} readerOpening={openingReader} onAttach={() => setAttachBook(selectedBook)} />
        ) : section === "dashboard" ? (
          <Dashboard books={books} readingBook={readingBook} onOpen={setSelectedBook} onRead={() => { if (readingBook) { setSelectedBook(readingBook); setShowReading(true); } }} onAdd={() => setShowAdd(true)} onNavigate={navigate} />
        ) : ["library", "reading", "read", "favorites"].includes(section) ? (
          <Library books={visibleBooks} section={section} viewMode={viewMode} setViewMode={setViewMode} filter={filter} setFilter={setFilter} onOpen={setSelectedBook} onStatusChange={changeBookStatus} onDelete={deleteBook} />
        ) : section === "stats" ? (
          <Stats books={books} />
        ) : section === "history" ? (
          <History books={books} />
        ) : section === "integrations" ? (
          <Integrations />
        ) : (
          <Organize section={section} books={books} items={organizations} onOpen={setSelectedBook} onCreate={() => setOrganizationDialog({ kind: section as OrganizationKind })} onEdit={(item) => setOrganizationDialog({ kind: item.kind, item })} onDelete={deleteOrganization} onFilter={useOrganizationFilter} />
        )}
      </div>

      <nav className="mobile-nav" aria-label="Navegação principal">
        {[["dashboard", "⌂", "Início"], ["library", "▦", "Biblioteca"], ["add", "+", "Adicionar"], ["stats", "↗", "Estatísticas"], ["profile", "○", "Perfil"]].map(([id, icon, label]) => (
          <button type="button" key={id} className={`${section === id ? "active" : ""} ${id === "add" ? "mobile-add-button" : ""}`} onClick={() => id === "add" ? setShowAdd(true) : id === "profile" ? setShowPrefs(true) : navigate(id)}><span className={id === "add" ? "add-icon" : undefined}>{icon}</span>{label}</button>
        ))}
      </nav>

      {showAdd && <AddBookDialog books={books} onClose={() => setShowAdd(false)} onAdd={(book) => { setBooks((current) => [book, ...current.filter((item) => item.id !== book.id)]); setShowAdd(false); setSelectedBook(book); setToast(`${book.title} foi adicionado à biblioteca.`); }} />}
      {editingBook && <BookEditDialog book={editingBook} onSave={saveBookEdition} onCancel={() => setEditingBook(null)} />}
      {showPrefs && <Preferences theme={theme} setTheme={setTheme} style={style} setStyle={setStyle} accent={accent} setAccent={setAccent} appFont={appFont} setAppFont={setAppFont} interfaceScale={interfaceScale} setInterfaceScale={setInterfaceScale} onTutorial={() => { setShowPrefs(false); setTutorialStep(0); }} onClose={() => setShowPrefs(false)} />}
      {showReading && selectedBook && <ReadingDialog book={selectedBook} onClose={() => setShowReading(false)} onSave={(book) => { updateBook(book); setShowReading(false); setToast("Progresso salvo automaticamente."); }} />}
      {attachBook && <FileAttachDialog book={attachBook} onClose={() => setAttachBook(null)} onImported={(document) => attachDocument(attachBook, document)} />}
      {organizationDialog && <OrganizationDialog kind={organizationDialog.kind} item={organizationDialog.item} books={books} existing={organizations} onClose={() => setOrganizationDialog(null)} onSave={saveOrganization} />}
      {confirmation && <ConfirmDialog title={confirmation.title} message={confirmation.message} confirmLabel={confirmation.confirmLabel} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation.onConfirm; setConfirmation(null); action(); }} />}
      {tutorialStep !== null && <Tutorial step={tutorialStep} onStep={setTutorialStep} onSkip={finishTutorial} onFinish={finishTutorial} />}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
      {showReader && selectedBook && readerDocument && <ReaderModule book={selectedBook} initialDocument={readerDocument} theme={theme} appFont={appFont} onClose={closeReaderToBook} onSession={(result) => recordReaderSession(selectedBook, result)} />}
    </main>
  );
}

function Dashboard({ books, readingBook, onOpen, onRead, onAdd, onNavigate }: { books: Book[]; readingBook?: Book; onOpen: (book: Book) => void; onRead: () => void; onAdd: () => void; onNavigate: (section: string) => void }) {
  const [today, setToday] = useState(() => new Date());
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>(7);
  const [chartMode, setChartMode] = useState<ChartMode>("bars");
  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const read = books.filter((book) => book.status === "read").length;
  const pagesByDate = new Map<string, number>();
  books.flatMap((book) => book.sessions).forEach((session) => {
    const key = sessionDateKey(session);
    if (key) pagesByDate.set(key, (pagesByDate.get(key) ?? 0) + pagesInSession(session));
  });
  const todayKey = localDateKey(today);
  const recentDays = Array.from({ length: chartPeriod }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (chartPeriod - 1 - index));
    return date;
  });
  const weeklyValues = recentDays.map((date) => pagesByDate.get(localDateKey(date)) ?? 0);
  const weeklyPages = weeklyValues.reduce((total, value) => total + value, 0);
  const weeklyMinutes = books.flatMap((book) => book.sessions).filter((session) => session.isoDate && recentDays.some((date) => localDateKey(date) === session.isoDate)).reduce((sum, session) => sum + (session.minutes ?? 0), 0);
  const chartBuckets = aggregateChart(recentDays, weeklyValues);
  const maxWeekly = Math.max(1, ...chartBuckets.map((bucket) => bucket.value));
  const wavePoints = chartBuckets.map((bucket, index) => `${chartBuckets.length === 1 ? 50 : (index / (chartBuckets.length - 1)) * 100},${92 - (bucket.value / maxWeekly) * 80}`).join(" ");
  const dateKeys = [...pagesByDate.keys()].sort();
  const dateSet = new Set(dateKeys);
  const streakCursor = new Date(today);
  if (!dateSet.has(localDateKey(streakCursor))) streakCursor.setDate(streakCursor.getDate() - 1);
  let currentStreak = 0;
  while (dateSet.has(localDateKey(streakCursor))) {
    currentStreak += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }
  let bestStreak = 0;
  let runningStreak = 0;
  let previousDate: Date | null = null;
  dateKeys.forEach((key) => {
    const currentDate = new Date(`${key}T12:00:00`);
    runningStreak = previousDate && Math.round((currentDate.getTime() - previousDate.getTime()) / 86_400_000) === 1 ? runningStreak + 1 : 1;
    bestStreak = Math.max(bestStreak, runningStreak);
    previousDate = currentDate;
  });
  const heatmapCells = Array.from({ length: 119 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (118 - index));
    const pages = pagesByDate.get(localDateKey(date)) ?? 0;
    return pages === 0 ? 0 : pages < 15 ? 1 : pages < 35 ? 2 : pages < 60 ? 3 : 4;
  });
  const goalProgress = Math.min(100, Math.round((read / 24) * 100));
  const noteBook = books.find((book) => book.note?.trim());
  const queue = books.filter((book) => book.status === "want" || book.status === "paused").slice(0, 2);
  return (
    <div className="page dashboard-page">
      <section className="page-heading dashboard-heading">
        <div><span className="eyebrow" suppressHydrationWarning>{todayLabel(today)}</span><h1 suppressHydrationWarning>{greetingFor(today)}, leitor.</h1><p>{pagesByDate.size ? `${pagesByDate.get(todayKey) ?? 0} páginas registradas hoje.` : "Suas métricas começam com a primeira leitura registrada."}</p></div>
        <div className="heading-quote"><i>“</i><p>Um livro é uma prova de que os seres humanos são capazes de fazer magia.<small>— Carl Sagan</small></p></div>
      </section>

      <div className="dashboard-grid">
        <section className={`current-card panel ${readingBook ? "" : "first-access-card"}`}>
          {readingBook ? <>
            <div className="section-label"><span>Leitura atual</span><button onClick={() => onOpen(readingBook)}>Ver detalhes →</button></div>
            <div className="current-book">
              <Cover book={readingBook} size="large" />
              <div className="current-copy">
                <span className="status-pill"><i /> Em andamento</span>
                <h2>{readingBook.title}</h2><p className="book-author">{readingBook.author}</p>
                <div className="progress-copy"><b>{progress(readingBook)}%</b><span>Página {readingBook.currentPage} de {readingBook.pages}</span></div>
                <ProgressBar value={progress(readingBook)} />
                <p className="estimate">≈ {Math.max(0, Math.round((readingBook.pages - readingBook.currentPage) * 1.2))} min restantes</p>
                <div className="current-actions"><button className="primary-button" onClick={onRead}>＋ Registrar leitura</button><button className="quiet-button" onClick={() => onOpen(readingBook)}>Continuar</button></div>
              </div>
            </div>
          </> : <div className="empty-state"><span className={books.length ? undefined : "add-icon"}>{books.length ? "◐" : "+"}</span><h2>{books.length ? "Nenhuma leitura em andamento" : "Comece sua biblioteca"}</h2><p>{books.length ? "Mova um livro para Lendo quando quiser começar." : "Adicione seu primeiro livro para acompanhar leituras, páginas e anotações."}</p><button className="primary-button" onClick={books.length ? () => onNavigate("library") : onAdd}>{books.length ? "Abrir biblioteca" : "Adicionar primeiro livro"}</button></div>}
        </section>

        <section className="quick-stats">
          <article className="metric panel"><span className="metric-icon">⌁</span><div><small>Páginas hoje</small><b>{pagesByDate.get(todayKey) ?? 0}</b><p>{pagesByDate.has(todayKey) ? "Registradas hoje" : "Nenhuma leitura registrada"}</p></div></article>
          <article className="metric panel"><span className="metric-icon">⌁</span><div><small>Sequência atual</small><b>{currentStreak} <em>{currentStreak === 1 ? "dia" : "dias"}</em></b><p>Recorde: {bestStreak} {bestStreak === 1 ? "dia" : "dias"}</p></div></article>
          <article className="metric panel"><span className="metric-icon">◉</span><div><small>Livros em 2026</small><b>{read}</b><p>{read ? "Livros concluídos" : "Nenhum livro concluído"}</p></div></article>
        </section>

        <section className="weekly panel">
          <div className="section-label weekly-heading"><div><span>Leitura no período</span><small>{weeklyPages} páginas · {weeklyMinutes || Math.round(weeklyPages * 1.2)} min{weeklyMinutes ? " cronometrados" : " estimados"}</small></div><div className="chart-mode-switch" aria-label="Formato do gráfico"><button type="button" className={chartMode === "bars" ? "active" : ""} aria-label="Gráfico atual" title="Gráfico atual" onClick={() => setChartMode("bars")}>▥</button><button type="button" className={chartMode === "wave" ? "active" : ""} aria-label="Gráfico em onda" title="Gráfico em onda" onClick={() => setChartMode("wave")}>∿</button></div></div>
          <div className="graph-filter-row"><AppChoice className="chart-period-choice graph-filter-choice" label="Período do gráfico" value={String(chartPeriod)} options={[{ value: "7", label: "7 dias" }, { value: "15", label: "15 dias" }, { value: "30", label: "30 dias" }, { value: "90", label: "3 meses" }]} onChange={(value) => setChartPeriod(Number(value) as ChartPeriod)} /></div>
          {chartMode === "bars" ? <div className="bar-chart" aria-label={`Páginas lidas nos últimos ${chartPeriod} dias`} style={{ gridTemplateColumns: `repeat(${chartBuckets.length}, minmax(0, 1fr))` }}>
            {chartBuckets.map((bucket, index) => <div key={bucket.key}><span className={index === chartBuckets.length - 1 ? "today" : ""} style={{ height: `${Math.max(4, Math.round((bucket.value / maxWeekly) * 92))}%` }}><b>{bucket.value || ""}</b></span><small>{bucket.label}</small></div>)}
          </div> : <div className="wave-chart" role="img" aria-label={`Gráfico em onda de páginas lidas nos últimos ${chartPeriod} dias`}><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="reading-wave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".42"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs><polygon points={`0,100 ${wavePoints} 100,100`} fill="url(#reading-wave)"/><polyline points={wavePoints} fill="none" stroke="var(--accent)" strokeWidth="2.2" vectorEffect="non-scaling-stroke"/></svg><div>{chartBuckets.map((bucket, index) => <small key={bucket.key} style={{ left: `${chartBuckets.length === 1 ? 50 : (index / (chartBuckets.length - 1)) * 100}%` }}>{index === 0 || index === chartBuckets.length - 1 || index % Math.max(1, Math.floor(chartBuckets.length / 4)) === 0 ? bucket.label : ""}</small>)}</div></div>}
        </section>

        <section className="streak-card panel">
          <div className="section-label"><div><span>Sua constância</span><small>{pagesByDate.size} {pagesByDate.size === 1 ? "dia com leitura" : "dias com leitura"} nos últimos registros</small></div><div className="streak-badge">◒ {currentStreak} {currentStreak === 1 ? "dia" : "dias"}</div></div>
          <Heatmap cells={heatmapCells} />
        </section>

        {books.length > 0 && <section className="recent-books panel">
          <div className="section-label"><div><span>Adicionados recentemente</span><small>Continue construindo sua biblioteca</small></div><button onClick={() => onNavigate("library")}>Ver biblioteca →</button></div>
          <div className="recent-row">
            {books.slice(0, 5).map((book) => <button className="mini-book" key={book.id} onClick={() => onOpen(book)}><Cover book={book} /><span><b>{book.title}</b><small>{book.author}</small><i>{statusLabels[book.status]}</i></span></button>)}
          </div>
        </section>}

        <aside className="dashboard-rail">
          <section className="goal-card panel"><div className="section-label"><span>Meta anual</span><button>Editar</button></div><div className="goal-ring"><div><b>{read}</b><small>de 24 livros</small></div></div><p><span>{goalProgress}% concluída</span><b>{Math.max(0, 24 - read)} restantes</b></p><ProgressBar value={goalProgress} /><small>{read ? "Progresso calculado pelos livros concluídos." : "A meta começa no primeiro livro concluído."}</small></section>
          {noteBook && <section className="note-card panel"><div className="section-label"><span>Nota em destaque</span></div><p>“{noteBook.note}”</p><div><span className="tiny-cover" style={{ background: noteBook.accent }} /><span><b>{noteBook.title}</b><small>Anotação pessoal</small></span></div></section>}
          <section className="next-card panel"><div className="section-label"><span>Na sua fila</span><button onClick={() => onNavigate("library")}>Ver todos</button></div>{queue.map((book, index) => <button key={book.id} onClick={() => onOpen(book)}><span>{index + 1}</span><Cover book={book} size="small" /><span><b>{book.title}</b><small>{book.author}</small></span></button>)}</section>
        </aside>
      </div>
    </div>
  );
}

function Library({ books, section, viewMode, setViewMode, filter, setFilter, onOpen, onStatusChange, onDelete }: { books: Book[]; section: string; viewMode: ViewMode; setViewMode: (mode: ViewMode) => void; filter: Status | "all"; setFilter: (filter: Status | "all") => void; onOpen: (book: Book) => void; onStatusChange: (book: Book, status: Status) => void; onDelete: (book: Book) => void }) {
  const [actionBookId, setActionBookId] = useState<string | null>(null);
  const [sort, setSort] = useState<LibrarySort>("recent");
  const [category, setCategory] = useState("all");
  const title = section === "reading" ? "Lendo agora" : section === "read" ? "Livros lidos" : section === "favorites" ? "Favoritos" : "Sua biblioteca";
  const categories = useMemo(() => [...new Set(books.flatMap((book) => book.categories))].sort((left, right) => left.localeCompare(right, "pt-BR")), [books]);
  const selectedCategory = category === "all" || categories.includes(category) ? category : "all";
  const displayedBooks = useMemo(() => {
    const filtered = selectedCategory === "all" ? books : books.filter((book) => book.categories.includes(selectedCategory));
    const indexed = filtered.map((book, index) => ({ book, index }));
    indexed.sort((left, right) => {
      if (sort === "oldest") return right.index - left.index;
      if (sort === "pages-asc") return left.book.pages - right.book.pages || left.book.title.localeCompare(right.book.title, "pt-BR");
      if (sort === "pages-desc") return right.book.pages - left.book.pages || left.book.title.localeCompare(right.book.title, "pt-BR");
      if (sort === "az") return left.book.title.localeCompare(right.book.title, "pt-BR");
      if (sort === "za") return right.book.title.localeCompare(left.book.title, "pt-BR");
      return left.index - right.index;
    });
    return indexed.map(({ book }) => book);
  }, [books, selectedCategory, sort]);
  return (
    <div className="page library-page">
      <section className="page-heading library-heading"><div><span className="eyebrow">Coleção pessoal</span><h1>{title}</h1><p>{displayedBooks.length} {displayedBooks.length === 1 ? "livro encontrado" : "livros encontrados"}</p></div><div className="view-switch" aria-label="Modo de visualização">{[["grid", "▦", "Grade"], ["carousel", "▱", "Carrossel"], ["list", "☷", "Lista"], ["table", "▤", "Tabela"]].map(([mode, icon, label]) => <button key={mode} className={viewMode === mode ? "active" : ""} onClick={() => setViewMode(mode as ViewMode)} title={label}>{icon}</button>)}</div></section>
      <section className="library-tools"><AppChoice className="library-status-choice" label="Filtrar por status" value={filter} options={[{ value: "all", label: "Todos os status" }, ...(["reading", "read", "paused", "abandoned", "want"] as Status[]).map((status) => ({ value: status, label: statusLabels[status] }))]} onChange={(value) => setFilter(value as Status | "all")} /><div className="library-choice-row"><AppChoice label="Filtrar por categoria" value={selectedCategory} options={[{ value: "all", label: "Todas as categorias" }, ...categories.map((item) => ({ value: item, label: item }))]} onChange={setCategory} /><AppChoice label="Ordenar biblioteca" value={sort} options={[{ value: "recent", label: "Adicionados recentemente" }, { value: "oldest", label: "Adicionados anteriormente" }, { value: "pages-asc", label: "Páginas: crescente" }, { value: "pages-desc", label: "Páginas: decrescente" }, { value: "az", label: "A – Z" }, { value: "za", label: "Z – A" }]} onChange={(value) => setSort(value as LibrarySort)} /></div></section>
      {displayedBooks.length ? <div className={`book-collection view-${viewMode}`}>
        {displayedBooks.map((book) => <article className="library-book" key={book.id} tabIndex={0} role="button" onClick={() => onOpen(book)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(book); }}>
          <button className="book-overflow" aria-label={`Ações para ${book.title}`} aria-expanded={actionBookId === book.id} onClick={(event) => { event.stopPropagation(); setActionBookId((current) => current === book.id ? null : book.id); }}>⋮</button>
          {actionBookId === book.id && <div className="book-action-menu" role="menu" onClick={(event) => event.stopPropagation()}>
            <span>Alterar status</span>
            <button role="menuitem" onClick={() => { onStatusChange(book, "reading"); setActionBookId(null); }}><i>◐</i>Lendo</button>
            <button role="menuitem" onClick={() => { onStatusChange(book, "read"); setActionBookId(null); }}><i>✓</i>Lido</button>
            <button role="menuitem" onClick={() => { onStatusChange(book, "abandoned"); setActionBookId(null); }}><i>×</i>Abandonado</button>
            <button className="danger" role="menuitem" onClick={() => { onDelete(book); setActionBookId(null); }}><i>⌫</i>Excluir livro</button>
          </div>}
          <Cover book={book} size={viewMode === "table" ? "small" : "medium"} />
          <div className="library-book-copy"><span className={`book-status status-${book.status}`}>{statusLabels[book.status]}</span><h2>{book.title}</h2><p>{book.author}</p>{book.status === "reading" || book.status === "paused" ? <><ProgressBar value={progress(book)} /><small>{progress(book)}% · {book.currentPage}/{book.pages} páginas</small></> : <small>{book.published} · {book.pages || "—"} páginas</small>}<div className="book-tags" aria-label="Categorias">{primaryCategories(book).map((category) => <i key={category}>{category}</i>)}</div></div>
          <div className="table-meta"><span>{book.publisher || "—"}</span><span>{book.language || "—"}</span><span>{book.rating ? `${"★".repeat(book.rating)}${"☆".repeat(5 - book.rating)}` : "Sem avaliação"}</span></div>
        </article>)}
      </div> : <div className="empty-state"><span>⌕</span><h2>Nenhum livro por aqui</h2><p>Experimente remover um filtro ou buscar outro termo.</p></div>}
    </div>
  );
}

function BookDetail({ book, relatedBooks, onBack, onUpdate, onEdit, onRead, onOpenReader, readerOpening, onAttach }: { book: Book; relatedBooks: Book[]; onBack: () => void; onUpdate: (book: Book) => void; onEdit: () => void; onRead: () => void; onOpenReader: () => void; readerOpening: boolean; onAttach: () => void }) {
  const [tab, setTab] = useState("overview");
  const [note, setNote] = useState(book.note ?? "");
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState(book.description);
  const saveNote = () => onUpdate({ ...book, note });
  const saveAbout = () => { onUpdate({ ...book, description: aboutDraft.trim() }); setEditingAbout(false); };
  return (
    <div className="page detail-page">
      <button className="back-button" onClick={onBack}>← Voltar para a biblioteca</button>
      <section className="detail-hero">
        <Cover book={book} size="large" />
        <div className="detail-title"><span className={`book-status status-${book.status}`}>{statusLabels[book.status]}</span><h1>{book.title}</h1><p>{book.author}</p><div className="rating" aria-label={`${book.rating} de 5 estrelas`}>{[1,2,3,4,5].map((star) => <button key={star} onClick={() => onUpdate({ ...book, rating: star })}>{star <= book.rating ? "★" : "☆"}</button>)}</div><div className="detail-actions">{book.readerFile ? <button className="primary-button" onClick={onOpenReader} disabled={readerOpening}>{readerOpening ? "Abrindo…" : "▶ Abrir"}</button> : <button className="primary-button" onClick={onAttach}>⇧ Anexar arquivo</button>}<button className="quiet-button" onClick={onEdit}>✎ Editar</button><button className="quiet-button" onClick={onRead}>＋ Registrar</button><button className="quiet-button" onClick={() => onUpdate({ ...book, favorite: !book.favorite })}>{book.favorite ? "♥ Favorito" : "♡ Favoritar"}</button></div>{book.readerFile && <button className="attached-file" onClick={onAttach}><span>{book.readerFile.format}</span><span><b>{book.readerFile.fileName}</b><small>{book.readerFile.storageMode === "text" ? "Texto · RSVP disponível" : "Imagem · leitura tradicional"}</small></span><i>Substituir</i></button>}</div>
        <div className="detail-progress panel"><small>Seu progresso</small><b>{progress(book)}%</b><ProgressBar value={progress(book)} /><p>Página {book.currentPage} de {book.pages || "—"}</p><span>≈ {Math.max(0, Math.round((book.pages - book.currentPage) * 1.2))} min restantes</span></div>
      </section>
      <nav className="detail-tabs">{[["overview", "Visão geral"], ["history", "Histórico"], ["notes", "Anotações"], ["related", "Relacionados"]].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>
      {tab === "overview" && <div className="detail-grid"><section><div className="about-book-heading"><h2>Sobre o livro</h2><button type="button" className="about-edit-button" aria-label="Editar Sobre o livro" title="Editar Sobre o livro" onClick={() => { setAboutDraft(book.description); setEditingAbout(true); }}>✎</button></div>{editingAbout ? <div className="about-book-editor"><textarea autoFocus value={aboutDraft} onChange={(event) => setAboutDraft(event.target.value)} placeholder="Escreva uma descrição para o livro." /><div><button type="button" className="quiet-button" onClick={() => { setAboutDraft(book.description); setEditingAbout(false); }}>Cancelar</button><button type="button" className="primary-button" onClick={saveAbout}>Salvar</button></div></div> : <p className="description">{book.description || "Descrição ainda não disponível. Use o ícone de edição para adicionar um texto."}</p>}<h2>Detalhes</h2><dl className="metadata"><div><dt>Editora</dt><dd>{book.publisher || "—"}</dd></div><div><dt>Publicação</dt><dd>{book.published || "—"}</dd></div><div><dt>Idioma</dt><dd>{book.language || "—"}</dd></div><div><dt>ISBN</dt><dd>{book.isbn || "—"}</dd></div><div><dt>Páginas</dt><dd>{book.pages || "—"}</dd></div><div><dt>Categorias</dt><dd>{book.categories.join(", ") || "—"}</dd></div><div><dt>Tags principais</dt><dd>{primaryTags([book, ...relatedBooks], book).join(", ") || "—"}{book.tags.length > 3 ? ` · +${book.tags.length - 3}` : ""}</dd></div></dl></section><aside className="detail-side panel"><h2>Ritmo de leitura</h2><div className="pace-number"><b>{book.sessions.reduce((total, item) => total + pagesInSession(item), 0)}</b><span>páginas registradas</span></div><p>Tempo total <b>{book.readingTimeMinutes ?? book.sessions.reduce((sum, item) => sum + (item.minutes ?? 0), 0)} min</b></p><p>RSVP médio <b>{averageBookWpm(book) || "—"}{averageBookWpm(book) ? " ppm" : ""}</b></p></aside></div>}
      {tab === "history" && <section className="history-list detail-history"><h2>Histórico de leitura</h2>{book.sessions.length ? book.sessions.slice().reverse().map((session, index) => <article key={`${session.date}-${index}`}><span>{session.date}</span><i /><div><b>{pagesInSession(session) ? `Páginas ${session.start}–${session.end}` : "Leitura na posição atual"}</b><p>{pagesInSession(session)} páginas lidas · {session.minutes ?? 0} min</p></div></article>) : <div className="empty-state"><h2>Nenhuma sessão registrada</h2><p>Registre sua primeira leitura para começar o histórico.</p></div>}</section>}
      {tab === "notes" && <section className="notes-editor"><div><h2>Anotações pessoais</h2><span>Salvamento automático neste dispositivo</span></div><textarea value={note} onChange={(event) => setNote(event.target.value)} onBlur={saveNote} placeholder="Registre uma ideia, reflexão ou comentário…" /><button className="quiet-button" onClick={saveNote}>✓ Salvo automaticamente</button></section>}
      {tab === "related" && (relatedBooks.length ? <section className="related-grid">{relatedBooks.map((item) => <article key={item.id}><Cover book={item} /><h2>{item.title}</h2><p>{item.author}</p></article>)}</section> : <section className="panel empty-state"><h2>Nenhum livro relacionado</h2><p>Adicione mais livros para ver sugestões nesta área.</p></section>)}
    </div>
  );
}

function optimizedCover(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("Selecione um arquivo de imagem.")); return; }
    const url = URL.createObjectURL(file); const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 900 / image.naturalWidth, 1350 / image.naturalHeight);
      const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d"); if (!context) { URL.revokeObjectURL(url); reject(new Error("Não foi possível preparar a capa.")); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url); resolve(canvas.toDataURL("image/jpeg", .88));
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Imagem de capa inválida.")); };
    image.src = url;
  });
}

function BookEditDialog({ book, onSave, onCancel }: { book: Book; onSave: (book: Book) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Book>({ ...book });
  const [error, setError] = useState("");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const chooseCover = async (file?: File) => {
    if (!file) return;
    try { const coverUrl = await optimizedCover(file); setDraft((current) => ({ ...current, coverUrl, manualCover: true })); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível alterar a capa."); }
  };
  const submit = async () => {
    if (!draft.title.trim() || !draft.author.trim()) { setError("Título e autor são obrigatórios."); return; }
    const updated = { ...draft, title: draft.title.trim(), author: draft.author.trim(), pages: Math.max(0, Number(draft.pages) || 0), currentPage: Math.min(Math.max(0, draft.currentPage), Math.max(0, Number(draft.pages) || 0)) };
    onSave(updated);
  };
  const field = (key: keyof Book, value: string | number) => setDraft((current) => ({ ...current, [key]: value }));

  return <div className="dialog-backdrop edit-book-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}><section className="dialog book-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="book-edit-title">
    <div className="dialog-head"><div><span className="eyebrow">Editar livro</span><h2 id="book-edit-title">{draft.title}</h2><p>Edite com rapidez, sem sair da página do livro.</p></div><button onClick={onCancel} aria-label="Fechar">×</button></div>
    <div className="book-edit-scroll">
      <section className="book-edit-summary-card">
        <div className="book-edit-cover-control"><Cover book={draft} size="medium" /><label className="book-cover-pencil" title="Alterar capa" aria-label="Alterar capa"><span aria-hidden="true">✎</span><input hidden type="file" accept="image/*" onChange={(event) => chooseCover(event.target.files?.[0])} /></label></div>
        <div className="book-edit-summary-copy"><h3>{draft.title}</h3><p>{draft.author}</p><span className={`status-pill status-${draft.status}`}>{statusLabels[draft.status]}</span><div className="book-edit-progress"><b>{progress(draft)}% concluído</b><ProgressBar value={progress(draft)} /><small>Você parou na página {draft.currentPage}</small></div></div>
      </section>
      <section className="book-edit-lead-fields"><label><span>Título</span><input value={draft.title} onChange={(event) => field("title", event.target.value)} /></label><label><span>Autor</span><input value={draft.author} onChange={(event) => field("author", event.target.value)} /></label><label><span>Editora</span><input value={draft.publisher} onChange={(event) => field("publisher", event.target.value)} /></label><div className="book-edit-status-field"><span>Status</span><div className="book-status-picker"><button type="button" className="book-status-trigger" aria-haspopup="listbox" aria-expanded={statusMenuOpen} onClick={() => setStatusMenuOpen((open) => !open)}><span>{statusLabels[draft.status]}</span><i aria-hidden="true">⌄</i></button>{statusMenuOpen && <div className="book-status-options" role="listbox" aria-label="Status de leitura">{Object.entries(statusLabels).map(([value, label]) => <button type="button" role="option" aria-selected={draft.status === value} className={draft.status === value ? "active" : ""} key={value} onClick={() => { field("status", value as Status); setStatusMenuOpen(false); }}><span>{label}</span><i aria-hidden="true">{draft.status === value ? "✓" : ""}</i></button>)}</div>}</div></div></section>
      <section className="book-edit-rating-group"><span>Avaliação</span><div className="edit-rating" aria-label={`Avaliação: ${draft.rating} de 5`}>{[1,2,3,4,5].map((star) => <button type="button" aria-label={`${star} estrelas`} className={star <= draft.rating ? "active" : ""} key={star} onClick={() => field("rating", star)}>★</button>)}</div></section>
      <section className="book-edit-details"><label><span>Número de páginas</span><input type="number" min="0" value={draft.pages} onChange={(event) => field("pages", Number(event.target.value))} /></label><label><span>Idioma</span><input value={draft.language} onChange={(event) => field("language", event.target.value)} /></label><label><span>Ano de publicação</span><input value={draft.published} onChange={(event) => field("published", event.target.value)} /></label><label><span>ISBN</span><input value={draft.isbn} onChange={(event) => field("isbn", event.target.value)} /></label></section>
      <section className="book-edit-texts"><label><span>Comentários e anotações</span><textarea value={draft.note ?? ""} onChange={(event) => field("note", event.target.value)} /></label></section>
      {error && <p className="form-error">{error}</p>}
    </div>
    <div className="book-edit-actions"><div><button className="quiet-button" onClick={onCancel}>Cancelar</button><button className="primary-button" onClick={submit}>Salvar alterações</button></div><small>As alterações ficam disponíveis offline.</small></div>
  </section></div>;
}

function Stats({ books }: { books: Book[] }) {
  const currentYear = new Date().getFullYear();
  const availableYears = useMemo(() => {
    const years = books.flatMap((book) => book.sessions).map((session) => Number(session.isoDate?.slice(0, 4))).filter((year) => Number.isInteger(year) && year >= 1900 && year <= 2200);
    return [...new Set([currentYear, ...years])].sort((left, right) => right - left);
  }, [books, currentYear]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [yearChartMode, setYearChartMode] = useState<ChartMode>("bars");
  const read = books.filter((book) => book.status === "read");
  const pagesRead = books.reduce((total, book) => total + book.sessions.reduce((sum, session) => sum + pagesInSession(session), 0), 0);
  const rated = books.filter((book) => book.rating > 0);
  const averageRating = rated.length ? (rated.reduce((total, book) => total + book.rating, 0) / rated.length).toFixed(1).replace(".", ",") : "0,0";
  const totalMinutes = books.reduce((sum, book) => sum + (book.readingTimeMinutes ?? book.sessions.reduce((sessionSum, session) => sessionSum + (session.minutes ?? 0), 0)), 0);
  const wpmSessions = books.flatMap((book) => book.sessions).filter((session) => Boolean(session.wpm));
  const averageWpm = wpmSessions.length ? Math.round(wpmSessions.reduce((sum, session) => sum + (session.wpm ?? 0), 0) / wpmSessions.length) : 0;
  const monthlyPages = Array.from({ length: 12 }, (_, month) => books.reduce((total, book) => total + book.sessions.reduce((sum, session) => {
    if (!session.isoDate) return sum;
    const date = new Date(`${session.isoDate}T12:00:00`);
    return date.getFullYear() === selectedYear && date.getMonth() === month ? sum + pagesInSession(session) : sum;
  }, 0), 0));
  const maxMonth = Math.max(1, ...monthlyPages);
  const selectedYearPages = monthlyPages.reduce((sum, pages) => sum + pages, 0);
  const monthLabels = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
  const annualWavePoints = monthlyPages.map((value, index) => `${(index / 11) * 100},${96 - (value / maxMonth) * 88}`).join(" ");
  return <div className="page stats-page">
    <section className="page-heading"><div><span className="eyebrow">Visão geral</span><h1>Estatísticas</h1><p>Leitura tradicional e RSVP reunidas sem transformar o hábito em obrigação.</p></div></section>
    <div className="stats-kpis"><article className="panel"><small>Livros lidos</small><b>{read.length}</b><span>{read.length ? "Registrados na biblioteca" : "Nenhum livro concluído"}</span></article><article className="panel"><small>Páginas lidas</small><b>{pagesRead.toLocaleString("pt-BR")}</b><span>{pagesRead ? "Em todas as sessões" : "Nenhuma página registrada"}</span></article><article className="panel"><small>Tempo de leitura</small><b>{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</b><span>{totalMinutes ? "Cronometrado pelo leitor" : "Nenhum tempo registrado"}</span></article><article className="panel"><small>RSVP médio</small><b>{averageWpm || "—"}</b><span>{averageWpm ? "palavras por minuto" : "Nenhuma sessão RSVP"}</span></article></div>
    <div className="stats-grid">
      <section className="panel annual-stats-panel">
        <div className="section-label annual-stats-heading"><div><span>Páginas por mês</span><small>{selectedYearPages.toLocaleString("pt-BR")} páginas em {selectedYear}</small></div><div className="chart-mode-switch" aria-label="Formato do gráfico anual"><button type="button" className={yearChartMode === "bars" ? "active" : ""} aria-label="Gráfico em barras" title="Gráfico em barras" onClick={() => setYearChartMode("bars")}>▥</button><button type="button" className={yearChartMode === "wave" ? "active" : ""} aria-label="Gráfico em onda" title="Gráfico em onda" onClick={() => setYearChartMode("wave")}>∿</button></div></div>
        <div className="graph-filter-row"><AppChoice className="stats-year-choice graph-filter-choice" label="Ano das estatísticas" value={String(selectedYear)} options={availableYears.map((year) => ({ value: String(year), label: String(year) }))} onChange={(value) => setSelectedYear(Number(value))} /></div>
        {yearChartMode === "bars" ? <div className="monthly-chart" aria-label={`Páginas lidas em ${selectedYear}`}>{monthlyPages.map((value, index) => <div key={index}><b>{value || ""}</b><span style={{ height: `${value ? Math.max(4, Math.round((value / maxMonth) * 92)) : 2}%` }} /><small>{monthLabels[index]}</small></div>)}</div> : <div className="wave-chart monthly-wave-chart" role="img" aria-label={`Gráfico anual de páginas lidas em ${selectedYear}`}><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="annual-reading-wave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".42"/><stop offset="1" stopColor="var(--accent)" stopOpacity="0"/></linearGradient></defs><polygon points={`0,100 ${annualWavePoints} 100,100`} fill="url(#annual-reading-wave)"/><polyline points={annualWavePoints} fill="none" stroke="var(--accent)" strokeWidth="2.2" vectorEffect="non-scaling-stroke"/></svg><div>{monthLabels.map((label, index) => <small key={`${label}-${index}`} style={{ left: `${(index / 11) * 100}%` }}>{label}</small>)}</div></div>}
      </section>
      <section className="panel category-stats"><div className="section-label"><span>Resumo das sessões</span></div><div className="reader-stat-list"><p><span>Sessões registradas</span><b>{books.reduce((sum, book) => sum + book.sessions.length, 0)}</b></p><p><span>Palavras em RSVP</span><b>{books.reduce((sum, book) => sum + (book.rsvpWordsRead ?? 0), 0).toLocaleString("pt-BR")}</b></p><p><span>Avaliação média</span><b>{averageRating} / 5</b></p></div></section>
    </div>
    <section className="panel author-table"><div className="section-label"><span>Arquivos de leitura</span></div><div className="reader-stat-list"><p><span>Livros com arquivo</span><b>{books.filter((book) => book.readerFile).length}</b></p><p><span>Armazenados como texto</span><b>{books.filter((book) => book.readerFile?.storageMode === "text").length}</b></p><p><span>Armazenados como imagem</span><b>{books.filter((book) => book.readerFile?.storageMode === "image").length}</b></p></div></section>
  </div>;
}

function History({ books }: { books: Book[] }) {
  const events = books.slice(0, 12).map((book) => ["Recentemente", book.status === "read" ? "finish" : "add", book.status === "read" ? "Livro concluído" : "Livro adicionado", book.title]);
  return <div className="page history-page"><section className="page-heading"><div><span className="eyebrow">Registro permanente</span><h1>Histórico</h1><p>Todas as mudanças importantes da sua biblioteca, em ordem cronológica.</p></div></section>{events.length ? <div className="history-layout"><section className="history-list panel">{events.map(([date, type, title, detail], index) => <article key={index}><span>{date}</span><i className={`event-${type}`} /><div><b>{title}</b><p>{detail}</p></div></article>)}</section><aside className="panel history-filter"><h2>Filtrar atividade</h2>{["Todos os eventos", "Leituras", "Livros", "Anotações", "Avaliações"].map((label, index) => <button className={index === 0 ? "active" : ""} key={label}>{label}<span>{index === 0 ? events.length : 0}</span></button>)}</aside></div> : <section className="panel empty-state"><span>↺</span><h2>Nenhuma atividade ainda</h2><p>Seu histórico começará quando você adicionar o primeiro livro.</p></section>}</div>;
}

function Organize({ section, books, items, onOpen, onCreate, onEdit, onDelete, onFilter }: { section: string; books: Book[]; items: OrganizationItem[]; onOpen: (book: Book) => void; onCreate: () => void; onEdit: (item: OrganizationItem) => void; onDelete: (item: OrganizationItem) => void; onFilter: (item: OrganizationItem) => void }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const labels: Record<string, [string, string]> = {
    categories: ["Categorias", "Classificações amplas da obra, automáticas ou criadas por você."],
    tags: ["Tags", "Temas e palavras-chave específicas, automáticas ou personalizadas."],
    collections: ["Coleções", "Estantes manuais para agrupar livros do seu jeito."],
  };
  const [title, subtitle] = labels[section] ?? labels.categories;
  const kind = section as OrganizationKind;
  const inferredNames = kind === "categories" ? [...new Set(books.flatMap((book) => book.categories))] : kind === "tags" ? [...new Set(books.flatMap((book) => book.tags))] : [];
  const defaults: OrganizationItem[] = inferredNames.map((name, index) => ({ id: `inferred-${kind}-${index}`, kind, name, bookIds: books.filter((book) => kind === "categories" ? book.categories.includes(name) : book.tags.includes(name)).map((book) => book.id) }));
  const saved = items.filter((item) => item.kind === kind);
  const groups = [
    ...saved.map((item) => {
      const automatic = defaults.find((candidate) => candidate.name.localeCompare(item.name, "pt-BR", { sensitivity: "base" }) === 0);
      return { ...item, bookIds: [...new Set([...item.bookIds, ...(automatic?.bookIds ?? [])])], manual: true };
    }),
    ...defaults.filter((item) => !saved.some((savedItem) => savedItem.name.localeCompare(item.name, "pt-BR", { sensitivity: "base" }) === 0)).map((item) => ({ ...item, manual: false })),
  ];
  const createLabel = section === "collections" ? "coleção" : section === "tags" ? "tag" : "categoria";
  return <div className="page organize-page"><section className="page-heading"><div><span className="eyebrow">Organização flexível</span><h1>{title}</h1><p>{subtitle}</p></div><button type="button" className="primary-button organization-create" onClick={onCreate}><span className="add-icon" aria-hidden="true">+</span>Criar {createLabel}</button></section><div className="organize-grid">{groups.map((group) => { const groupBooks = group.bookIds.map((id) => books.find((book) => book.id === id)).filter((book): book is Book => Boolean(book)); const selected = selectedIds.includes(group.id); return <article className={`panel ${selected ? "selected" : ""}`} key={group.id}><div className="collection-head"><label className="organization-select" aria-label={`Selecionar ${group.name}`}><input type="checkbox" checked={selected} onChange={() => setSelectedIds((current) => current.includes(group.id) ? current.filter((id) => id !== group.id) : [...current, group.id])} /><span>{section === "tags" ? "#" : section === "collections" ? "▤" : "◇"}</span></label><button className="collection-filter" onClick={() => onFilter(group)}><h2>{group.name}</h2><p>{groupBooks.length} {groupBooks.length === 1 ? "livro" : "livros"}{group.manual ? " · Manual" : " · Automática"}</p></button><div className="collection-actions"><button type="button" onClick={() => onEdit(group)} aria-label={`Editar ${group.name}`}>✎</button><button type="button" onClick={() => onDelete(group)} aria-label={`Excluir ${group.name}`}>×</button><button type="button" onClick={() => onFilter(group)} aria-label={`Filtrar por ${group.name}`}>→</button></div></div><div className="cover-stack">{groupBooks.slice(0, 3).map((book) => <button key={book.id} onClick={() => onOpen(book)}><Cover book={book} size="small" /></button>)}</div></article>; })}</div></div>;
}

function Integrations() {
  const items = [["Kindle", "Sincronize destaques e progresso de leitura."], ["Skoob", "Importe sua estante e avaliações."], ["Google Drive", "Faça backups automáticos da biblioteca."], ["Goodreads", "Traga listas e histórico de leitura."], ["Exportar dados", "Baixe uma cópia completa em formatos abertos."], ["Sincronização", "Mantenha todos os dispositivos atualizados."]];
  return <div className="page integrations-page"><section className="page-heading"><div><span className="eyebrow">Preparado para crescer</span><h1>Integrações</h1><p>Conectores previstos na arquitetura para versões futuras.</p></div></section><div className="integration-notice"><span>i</span><p><b>Esta função não está disponível no momento.</b>As integrações abaixo mostram o que já está previsto para o futuro do MyBookshelf.</p></div><div className="integration-grid">{items.map(([title, description], index) => <article className="panel" key={title}><span className={`integration-logo logo-${index}`}>{title.slice(0, 1)}</span><div><h2>{title}</h2><p>{description}</p></div><button disabled>Em breve</button></article>)}</div></div>;
}

function AddBookDialog({ books, onClose, onAdd }: { books: Book[]; onClose: () => void; onAdd: (book: Book) => void }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const search = async () => {
    if (title.trim().length < 2) { setError("Digite pelo menos duas letras do título."); return; }
    setLoading(true); setError("");
    try {
      const found = await searchMetadataCandidates(title, author);
      setResults(found); if (!found.length) setError("Nenhum resultado encontrado. Revise título e autor ou tente somente o título.");
    } catch { setError(navigator.onLine ? "As fontes de metadados não responderam. Tente novamente em instantes." : "Sem conexão. Você ainda pode adicionar o livro manualmente."); }
    finally { setLoading(false); }
  };
  const add = async (result?: SearchResult) => {
    setLoading(true); setError("");
    try {
      const picked = result?.sourceId.startsWith("/works/") ? await enrichOpenLibraryResult(result) : result ?? { sourceId: crypto.randomUUID(), title, author, coverUrl: "", pages: 0, published: "", publisher: "", language: "", isbn: "", description: "", categories: [], tags: [] };
      if (!picked.title.trim() || !picked.author.trim()) { setError("Título e autor são obrigatórios."); return; }
      const duplicate = books.some((book) => book.title.toLowerCase() === picked.title.toLowerCase() && book.author.toLowerCase() === picked.author.toLowerCase());
      if (duplicate) { setError("Este livro já está na sua biblioteca."); return; }
      const book: Book = { id: crypto.randomUUID(), title: picked.title, author: picked.author, coverUrl: picked.coverUrl, pages: picked.pages, currentPage: 0, status: "want", rating: 0, favorite: false, description: picked.description, published: picked.published, publisher: picked.publisher, language: picked.language, isbn: picked.isbn, categories: picked.categories, tags: picked.tags, accent: "#7fd6ca", sessions: [] };
      if (!isNativeRuntime()) fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...book, metadata: { published: book.published, publisher: book.publisher, language: book.language, isbn: book.isbn, categories: book.categories, tags: book.tags, accent: book.accent } }) }).catch(() => undefined);
      onAdd(book);
    } catch { setError("Não foi possível completar os metadados desta obra. Tente novamente."); }
    finally { setLoading(false); }
  };
  const addImported = async (document: ReaderDocument) => {
    setLoading(true); setError("");
    try {
      const metadata = results.length ? bestMetadataFor(title || document.title, author || document.author, document.isbn ?? "", results) : undefined;
      const profileTitle = metadata?.title || document.title;
      const profileAuthor = metadata?.author || document.author;
      const duplicate = books.some((book) => book.title.localeCompare(profileTitle, "pt-BR", { sensitivity: "base" }) === 0 && book.author.localeCompare(profileAuthor, "pt-BR", { sensitivity: "base" }) === 0);
      if (duplicate) { await deleteReaderDocument(document.bookId); throw new Error("Este livro já está na sua biblioteca. Anexe o arquivo pela página do livro existente."); }
      const pageCount = document.pages.length || document.images.length;
      const resolvedPages = document.format === "PDF" && pageCount > 0 ? pageCount : metadata?.pages || pageCount;
      const book: Book = { id: document.bookId, title: profileTitle, author: profileAuthor, coverUrl: metadata?.coverUrl || "", pages: resolvedPages, currentPage: 0, status: "want", rating: 0, favorite: false, description: metadata?.description || "", published: metadata?.published || "", publisher: metadata?.publisher || "", language: metadata?.language || "", isbn: metadata?.isbn || document.isbn || "", categories: metadata?.categories || [], tags: metadata?.tags || [], accent: "#7fd6ca", sessions: [], readerFile: { fileName: document.fileName, format: document.format, storageMode: document.storageMode, pageCount } };
      onAdd(book);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível adicionar o arquivo."); }
    finally { setLoading(false); }
  };
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-title">
    <div className="dialog-head"><div><span className="eyebrow">Cadastro inteligente</span><h2 id="add-title">Adicionar livro</h2><p>Primeiro localize a obra; depois, se desejar, importe o arquivo para leitura.</p></div><button onClick={onClose} aria-label="Fechar">×</button></div>
    <div className="metadata-search-block"><div className="form-row"><label><span>Título do livro</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Ex.: Ensaio sobre a cegueira" /></label><label><span>Autor</span><input value={author} onChange={(event) => setAuthor(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Ex.: José Saramago" /></label></div><button className="primary-button search-metadata" onClick={search} disabled={loading}>{loading ? "Buscando metadados…" : "⌕ Buscar automaticamente"}</button>{error && <p className="form-error">{error}</p>}{results.length > 0 && <div className="search-results">{results.map((result) => <button key={result.sourceId} onClick={() => add(result)}><div className="result-cover">{result.coverUrl ? <img src={result.coverUrl} alt={`Capa de ${result.title}`} /> : <span>{result.title.slice(0, 1)}</span>}</div><span><b>{result.title}</b><small>{result.author} · {result.published || "Ano desconhecido"}</small><i>{result.pages ? `${result.pages} páginas` : "Páginas não informadas"}</i></span><strong className="add-icon">+</strong></button>)}</div>}<div className="manual-add"><span>Não encontrou?</span><button onClick={() => add()}>Adicionar com estes dados</button></div></div>
    <div className="import-divider"><span>ou importe o arquivo do livro</span></div><FileImportPanel onImported={addImported} />
    <footer>Metadados consultados em fontes públicas. Arquivos e progresso permanecem neste dispositivo.</footer>
  </section></div>;
}

function FileImportPanel({ bookId, onImported }: { bookId?: string; onImported: (document: ReaderDocument) => void | Promise<void> }) {
  const [mode, setMode] = useState<ReaderImportMode>("text");
  const [progressMessage, setProgressMessage] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const choose = async (file?: File) => {
    if (!file) return;
    setError(""); setProgressMessage("Lendo arquivo…");
    try {
      const document = await extractReaderDocument(file, bookId ?? crypto.randomUUID(), mode, setProgressMessage);
      setProgressMessage("Salvando no dispositivo…");
      await saveReaderDocument(document);
      setProgressMessage("Adicionando à biblioteca…");
      await onImported(document);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao importar o arquivo."); }
    finally { setProgressMessage(""); if (input.current) input.current.value = ""; }
  };
  return <section className="file-import-panel"><div className="file-import-copy"><span>⇧</span><div><h3>Importar arquivo do livro</h3><p>{supportedReaderFormats.join(" · ")}</p></div></div><div className="storage-mode"><span>Modo de importação</span><label><input type="radio" checked={mode === "text"} onChange={() => setMode("text")} /><b>Texto (recomendada)</b><small>Extrai o texto selecionável rapidamente</small></label><label><input type="radio" checked={mode === "image"} onChange={() => setMode("image")} /><b>Imagem do PDF</b><small>Exibe as páginas originais, sem OCR</small></label><label><input type="radio" checked={mode === "complete"} onChange={() => setMode("complete")} /><b>Completa</b><small>Usa o texto e recorre à visualização original quando necessário</small></label></div><input ref={input} hidden type="file" accept=".pdf,.epub,.txt,.docx,.doc,.rtf,.html,.htm,.md" onChange={(event) => choose(event.target.files?.[0])} /><button className="primary-button file-picker-button" disabled={Boolean(progressMessage)} onClick={() => input.current?.click()}>{progressMessage || "Escolher arquivo"}</button>{error && <p className="form-error">{error}</p>}<small className="import-privacy">Importação local, privada e disponível offline. PDFs de até 480 MB; demais formatos, até 120 MB.</small></section>;
}

function FileAttachDialog({ book, onClose, onImported }: { book: Book; onClose: () => void; onImported: (document: ReaderDocument) => void }) {
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog attach-dialog"><div className="dialog-head"><div><span className="eyebrow">Leitura integrada</span><h2>Anexar arquivo</h2><p>{book.title}</p></div><button onClick={onClose} aria-label="Fechar">×</button></div><FileImportPanel bookId={book.id} onImported={onImported} /></section></div>;
}

function OrganizationDialog({ kind, item, books, existing, onClose, onSave }: { kind: OrganizationKind; item?: OrganizationItem; books: Book[]; existing: OrganizationItem[]; onClose: () => void; onSave: (item: OrganizationItem) => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [bookIds, setBookIds] = useState<string[]>(item?.bookIds ?? []);
  const [error, setError] = useState("");
  const singular = kind === "categories" ? "categoria" : kind === "tags" ? "tag" : "coleção";
  const toggleBook = (id: string) => setBookIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const submit = () => {
    const normalized = name.trim().replace(/\s+/g, " ");
    if (!normalized) { setError(`Informe o nome da ${singular}.`); return; }
    if (existing.some((existingItem) => existingItem.id !== item?.id && existingItem.kind === kind && existingItem.name.localeCompare(normalized, "pt-BR", { sensitivity: "base" }) === 0)) { setError(`Esta ${singular} já existe.`); return; }
    onSave({ id: item?.id ?? crypto.randomUUID(), kind, name: normalized, bookIds, createdAt: item?.createdAt });
  };
  const action = item ? "Editar" : "Criar";
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog organization-dialog" role="dialog" aria-modal="true" aria-labelledby="organization-title"><div className="dialog-head"><div><span className="eyebrow">Organização manual</span><h2 id="organization-title">{action} {singular}</h2><p>O conteúdo manual complementa os metadados automáticos e nunca os substitui.</p></div><button onClick={onClose} aria-label="Fechar">×</button></div><label className="organization-name"><span>Nome da {singular}</span><input autoFocus value={name} maxLength={60} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder={`Ex.: ${kind === "categories" ? "Ensaios" : kind === "tags" ? "Inteligência Artificial" : "Favoritos do ano"}`} /></label><fieldset className="organization-books"><legend>Livros nesta {singular}</legend>{books.map((book) => <label key={book.id}><input type="checkbox" checked={bookIds.includes(book.id)} onChange={() => toggleBook(book.id)} /><Cover book={book} size="small" /><span><b>{book.title}</b><small>{book.author}</small></span></label>)}</fieldset>{error && <p className="form-error">{error}</p>}<button className="primary-button dialog-submit" onClick={submit}>{item ? "Salvar alterações" : `Criar ${singular}`}</button></section></div>;
}

function ConfirmDialog({ title, message, confirmLabel, onCancel, onConfirm }: { title: string; message: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="dialog-backdrop confirmation-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}><section className="dialog confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message"><div className="confirmation-icon" aria-hidden="true">!</div><div><span className="eyebrow">Confirmar ação</span><h2 id="confirmation-title">{title}</h2><p id="confirmation-message">{message}</p></div><footer><button type="button" className="quiet-button" onClick={onCancel}>Cancelar</button><button type="button" className="danger-button" onClick={onConfirm}>{confirmLabel}</button></footer></section></div>;
}

function ReadingDialog({ book, onClose, onSave }: { book: Book; onClose: () => void; onSave: (book: Book) => void }) {
  const suggestedStart = Math.min(book.pages || Infinity, book.currentPage + 1);
  const [start, setStart] = useState(suggestedStart || 1);
  const [end, setEnd] = useState(Math.min(book.pages || suggestedStart + 30, suggestedStart + 29));
  const today = useMemo(() => new Date(), []);
  const [day, setDay] = useState(today.getDate());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [error, setError] = useState("");
  const submit = () => {
    if (start < 1 || end < start || (book.pages > 0 && end > book.pages)) { setError(`Use um intervalo entre 1 e ${book.pages || "o fim do livro"}.`); return; }
    if (book.sessions.some((session) => start <= session.end && end >= session.start)) { setError("Este intervalo se sobrepõe a uma leitura já registrada."); return; }
    const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const parsedDate = new Date(`${date}T12:00:00`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.getDate() !== day || parsedDate.getMonth() + 1 !== month || parsedDate.getFullYear() !== year) { setError("Informe uma data válida."); return; }
    const session = { date: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`)).replace(".", ""), isoDate: date, start, end };
    const updated = { ...book, currentPage: Math.max(book.currentPage, end), status: end >= book.pages && book.pages > 0 ? "read" as Status : "reading" as Status, sessions: [...book.sessions, session] };
    if (!isNativeRuntime()) fetch(`/api/library/${book.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPage: updated.currentPage, status: updated.status, session: { startPage: start, endPage: end, readAt: date } }) }).catch(() => undefined);
    onSave(updated);
  };
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog reading-dialog" role="dialog" aria-modal="true"><div className="dialog-head"><div><span className="eyebrow">Sessão de leitura</span><h2>Registrar progresso</h2><p>{book.title}</p></div><button onClick={onClose} aria-label="Fechar">×</button></div><div className="reading-book-row"><Cover book={book} size="small" /><div><b>{progress(book)}% concluído</b><ProgressBar value={progress(book)} /><span>Você parou na página {book.currentPage}</span></div></div><div className="page-range"><label><span>Página inicial</span><input type="number" min="1" max={book.pages} value={start} onChange={(event) => setStart(Number(event.target.value))} /></label><i>→</i><label><span>Página final</span><input type="number" min="1" max={book.pages} value={end} onChange={(event) => setEnd(Number(event.target.value))} /></label></div><label className="date-field"><span>Data da leitura</span><span className="themed-date-input"><input aria-label="Dia" inputMode="numeric" type="number" min="1" max="31" value={day} onChange={(event) => setDay(Number(event.target.value))} /><i>/</i><input aria-label="Mês" inputMode="numeric" type="number" min="1" max="12" value={month} onChange={(event) => setMonth(Number(event.target.value))} /><i>/</i><input aria-label="Ano" inputMode="numeric" type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} /></span></label><div className="session-summary"><span>Páginas nesta sessão</span><b>{Math.max(0, end - start + 1)}</b></div>{error && <p className="form-error">{error}</p>}<button className="primary-button dialog-submit" onClick={submit}>Registrar leitura</button><footer>Salvo automaticamente e disponível offline.</footer></section></div>;
}

function Tutorial({ step, onStep, onSkip, onFinish }: { step: number; onStep: (step: number) => void; onSkip: () => void; onFinish: () => void }) {
  const item = tutorialSteps[step];
  const last = step === tutorialSteps.length - 1;
  return <div className="tutorial-backdrop"><section className="tutorial" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><header><span>Guia rápido</span><button onClick={onSkip}>Pular tutorial</button></header><div className="tutorial-visual" aria-hidden="true"><i>{item.icon}</i><span>{String(step + 1).padStart(2, "0")}</span></div><div className="tutorial-copy"><small>Etapa {step + 1} de {tutorialSteps.length}</small><h2 id="tutorial-title">{item.title}</h2><p>{item.copy}</p></div><div className="tutorial-progress" aria-label={`Etapa ${step + 1} de ${tutorialSteps.length}`}>{tutorialSteps.map((_, index) => <i key={index} className={index <= step ? "active" : ""} />)}</div><footer><button className="quiet-button" onClick={() => onStep(step - 1)} disabled={step === 0}>← Voltar</button><button className="primary-button" onClick={() => last ? onFinish() : onStep(step + 1)}>{last ? "Concluir" : "Avançar →"}</button></footer></section></div>;
}

function Preferences({ theme, setTheme, style, setStyle, accent, setAccent, appFont, setAppFont, interfaceScale, setInterfaceScale, onTutorial, onClose }: { theme: Theme; setTheme: (theme: Theme) => void; style: VisualStyle; setStyle: (style: VisualStyle) => void; accent: string; setAccent: (accent: string) => void; appFont: AppFont; setAppFont: (font: AppFont) => void; interfaceScale: InterfaceScale; setInterfaceScale: (scale: InterfaceScale) => void; onTutorial: () => void; onClose: () => void }) {
  const fonts: Array<[AppFont, string, string]> = [
    ["original", "Original", "Geist + Libre Baskerville"],
    ["serif", "Serifada", "Georgia"],
    ["arial", "Arial", "Arial"],
    ["courier", "Monoespaçada", "Courier New"],
  ];
  return <div className="dialog-backdrop preference-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="preferences" role="dialog" aria-modal="true" aria-labelledby="prefs-title">
    <div className="dialog-head"><div><span className="eyebrow">Aparência</span><h2 id="prefs-title">Sua interface</h2><p>As mudanças são aplicadas imediatamente.</p></div><button onClick={onClose} aria-label="Fechar">×</button></div>
    <div className="preference-group"><h3>Tema</h3><div className="segmented"><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>☼ Claro</button><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>◐ Escuro</button></div></div>
    <div className="preference-group"><h3>Fonte do aplicativo</h3><div className="font-options">{fonts.map(([id, label, sample]) => <button key={id} className={appFont === id ? "active" : ""} data-font-option={id} onClick={() => setAppFont(id)}><b>{label}</b><small>{sample}</small></button>)}</div></div>
    <div className="preference-group"><h3>Tamanho da interface</h3><div className="segmented interface-scale-options"><button className={interfaceScale === "small" ? "active" : ""} onClick={() => setInterfaceScale("small")}>Pequena</button><button className={interfaceScale === "medium" ? "active" : ""} onClick={() => setInterfaceScale("medium")}>Média</button><button className={interfaceScale === "large" ? "active" : ""} onClick={() => setInterfaceScale("large")}>Grande</button></div></div>
    <div className="preference-group"><h3>Estilo visual</h3><div className="style-options"><button className={style === "minimal" ? "active" : ""} onClick={() => setStyle("minimal")}><span className="style-preview minimal-preview"><i /><i /><i /></span><b>Minimalista</b><small>Conteúdo e espaço</small></button><button className={style === "brutal" ? "active" : ""} onClick={() => setStyle("brutal")}><span className="style-preview brutal-preview"><i /><i /><i /></span><b>Neobrutalismo</b><small>Traços e contraste</small></button><button className={style === "glass" ? "active" : ""} onClick={() => setStyle("glass")}><span className="style-preview glass-preview"><i /><i /><i /></span><b>Glass</b><small>Vidro e profundidade</small></button></div></div>
    <div className="preference-group"><h3>Cor principal</h3><div className="accent-options">{accentOptions.map((color) => <button key={color} className={accent === color ? "active" : ""} style={{ background: color }} onClick={() => setAccent(color)} aria-label={`Usar cor ${color}`}>{accent === color ? "✓" : ""}</button>)}</div></div>
    <button className="tutorial-reopen" onClick={onTutorial}><span>?</span><span><b>Rever tutorial</b><small>Conheça novamente os principais recursos.</small></span><i>→</i></button><div className="preference-note"><span>AA</span><p><b>Legibilidade preservada</b>Contraste e hierarquia permanecem consistentes em todas as combinações.</p></div>
  </section></div>;
}
