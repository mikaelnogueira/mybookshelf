"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { classifyBookSubjects } from "../lib/bookClassification";

type Status = "reading" | "read" | "paused" | "abandoned" | "want";
type ViewMode = "grid" | "carousel" | "list" | "table";
type VisualStyle = "minimal" | "brutal" | "glass";
type Theme = "dark" | "light";
type OrganizationKind = "categories" | "tags" | "collections";

type Session = { date: string; start: number; end: number; isoDate?: string };
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
  categories: string[];
  tags: string[];
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

const accentOptions = ["#b7a0ff", "#c7f36b", "#7fd6ca", "#f3a868", "#ed7c9c"];

const tutorialSteps = [
  { icon: "▥", title: "Bem-vindo ao MyBookshelf", copy: "Sua biblioteca, progresso, ideias e hábitos de leitura reunidos em uma experiência simples." },
  { icon: "▦", title: "Organize sua biblioteca", copy: "Adicione livros, use categorias, tags e coleções e encontre qualquer título com rapidez." },
  { icon: "◔", title: "Acompanhe seu progresso", copy: "Registre páginas lidas e veja o avanço de cada leitura sem perder o histórico." },
  { icon: "↗", title: "Mantenha sua ofensiva", copy: "A sequência de leitura ajuda a criar constância sem transformar a leitura em obrigação." },
  { icon: "☷", title: "Encontre a melhor visualização", copy: "Filtre por status e alterne entre grade, carrossel, lista e tabela conforme o momento." },
  { icon: "✎", title: "Guarde suas anotações", copy: "Registre reflexões e observações diretamente na página de cada livro." },
  { icon: "◈", title: "Deixe o app com a sua cara", copy: "O padrão inicial é Claro com destaque Roxo. Temas, estilos e cores podem ser alterados em Aparência." },
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
  return Math.max(0, session.end - session.start + 1);
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
    const request = indexedDB.open("mybookshelf-mobile-v1", 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("library")) database.createObjectStore("library");
      if (!database.objectStoreNames.contains("covers")) database.createObjectStore("covers");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function mobileStoreGet<T>(storeName: "library" | "covers", key: string) {
  const database = await openMobileDatabase();
  return new Promise<T | undefined>((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function mobileStorePut(storeName: "library" | "covers", key: string, value: unknown) {
  const database = await openMobileDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function resetMobileStorage() {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("mybookshelf-mobile-v1");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

async function loadNativeCover(book: Book) {
  const cached = await mobileStoreGet<Blob>("covers", book.id);
  if (cached) return URL.createObjectURL(cached);
  if (!book.coverUrl || !navigator.onLine) return book.coverUrl;
  const response = await fetch(book.coverUrl);
  if (!response.ok) return book.coverUrl;
  const blob = await response.blob();
  await mobileStorePut("covers", book.id, blob);
  return URL.createObjectURL(blob);
}

async function searchOpenLibraryDirect(title: string, author: string): Promise<SearchResult[]> {
  const query = new URLSearchParams({
    title,
    limit: "6",
    fields: "key,title,author_name,cover_i,number_of_pages_median,first_publish_year,publisher,language,isbn,subject",
  });
  if (author.trim()) query.set("author", author.trim());
  const response = await fetch(`https://openlibrary.org/search.json?${query}`);
  if (!response.ok) throw new Error("Open Library indisponível");
  const data = (await response.json()) as { docs?: Array<Record<string, unknown>> };
  return (data.docs ?? []).map((document) => {
    const authors = document.author_name as string[] | undefined;
    const publishers = document.publisher as string[] | undefined;
    const languages = document.language as string[] | undefined;
    const isbns = document.isbn as string[] | undefined;
    const subjects = document.subject as string[] | undefined;
    const coverId = Number(document.cover_i ?? 0);
    const classification = classifyBookSubjects(subjects ?? []);
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
      ...classification,
    };
  });
}

function Cover({ book, size = "medium" }: { book: Book; size?: "small" | "medium" | "large" }) {
  const [broken, setBroken] = useState(false);
  const [displayUrl, setDisplayUrl] = useState(book.coverUrl);
  useEffect(() => {
    let objectUrl = "";
    if (!isNativeRuntime() || !book.coverUrl.startsWith("http")) {
      setDisplayUrl(book.coverUrl);
      return;
    }
    loadNativeCover(book).then((url) => {
      objectUrl = url.startsWith("blob:") ? url : "";
      setDisplayUrl(url);
    }).catch(() => setDisplayUrl(book.coverUrl));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [book.id, book.coverUrl]);
  return (
    <div className={`book-cover book-cover--${size}`} style={{ "--cover-accent": book.accent } as React.CSSProperties}>
      {!broken && displayUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt={`Capa de ${book.title}`} onError={() => setBroken(true)} />
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

export function BookshelfApp() {
  const [books, setBooks] = useState<Book[]>([]);
  const [section, setSection] = useState("dashboard");
  const [theme, setTheme] = useState<Theme>("light");
  const [style, setStyle] = useState<VisualStyle>("minimal");
  const [accent, setAccent] = useState(accentOptions[0]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showReading, setShowReading] = useState(false);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(true);
  const [settingsReady, setSettingsReady] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [organizationFilter, setOrganizationFilter] = useState<{ label: string; bookIds: string[] } | null>(null);
  const [organizationDialog, setOrganizationDialog] = useState<{ kind: OrganizationKind; item?: OrganizationItem } | null>(null);
  const hydrated = useRef(false);
  const organizationsHydrated = useRef(false);

  useEffect(() => {
    const native = isNativeRuntime();
    let active = true;
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const initialize = async () => {
      const resetMarker = native ? "mybookshelf-native-first-user-v3" : "mybookshelf-web-first-user-v3";
      if (localStorage.getItem(resetMarker) !== "ready") {
        localStorage.clear();
        if (native) await resetMobileStorage().catch(() => undefined);
        localStorage.setItem(resetMarker, "ready");
      }

      const settings = localStorage.getItem("mybookshelf-settings-v1");
      if (settings) {
        try {
          const parsed = JSON.parse(settings) as { theme?: Theme; style?: VisualStyle; accent?: string };
          if (parsed.theme) setTheme(parsed.theme);
          if (parsed.style) setStyle(parsed.style);
          if (parsed.accent) setAccent(parsed.accent);
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
        if (active && storedBooks?.length) setBooks(storedBooks);
        if (active && storedOrganizations?.length) setOrganizations(storedOrganizations);
      } else {
        const cached = localStorage.getItem("mybookshelf-library-v1");
        const cachedOrganizations = localStorage.getItem("mybookshelf-organizations-v1");
        if (cached) {
          try { setBooks(JSON.parse(cached) as Book[]); } catch { /* use server state */ }
        }
        if (cachedOrganizations) {
          try { setOrganizations(JSON.parse(cachedOrganizations) as OrganizationItem[]); } catch { /* use server state */ }
        }
        const [libraryData, organizationData] = await Promise.all([
          fetch("/api/library").then((response) => response.json()).catch(() => ({ books: [] })),
          fetch("/api/organization").then((response) => response.json()).catch(() => ({ items: [] })),
        ]) as [{ books?: Array<Record<string, unknown>> }, { items?: OrganizationItem[] }];
        if (active && libraryData.books?.length) {
          setBooks(libraryData.books.map(bookFromServer));
        }
        if (active && organizationData.items?.length) setOrganizations(organizationData.items);
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
    if (isNativeRuntime()) mobileStorePut("library", "books", books).catch(() => undefined);
    else localStorage.setItem("mybookshelf-library-v1", JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    if (!settingsReady) return;
    localStorage.setItem("mybookshelf-settings-v1", JSON.stringify({ theme, style, accent }));
  }, [theme, style, accent, settingsReady]);

  useEffect(() => {
    if (!organizationsHydrated.current) return;
    if (isNativeRuntime()) mobileStorePut("library", "organizations", organizations).catch(() => undefined);
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
    setQuery("");
    setOrganizationFilter(null);
    if (["reading", "read", "favorites"].includes(next)) setFilter("all");
    setMobileMenuOpen(false);
  };

  const updateBook = (updated: Book) => {
    setBooks((current) => current.map((book) => (book.id === updated.id ? updated : book)));
    setSelectedBook(updated);
  };

  const changeBookStatus = (book: Book, status: Status) => {
    const updated = { ...book, status, currentPage: status === "read" && book.pages ? book.pages : book.currentPage };
    setBooks((current) => current.map((item) => item.id === book.id ? updated : item));
    setSelectedBook((current) => current?.id === book.id ? updated : current);
    fetch(`/api/library/${book.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, currentPage: updated.currentPage }) }).catch(() => undefined);
    setToast(`${book.title} agora está como ${statusLabels[status].toLowerCase()}.`);
  };

  const deleteBook = (book: Book) => {
    setBooks((current) => current.filter((item) => item.id !== book.id));
    setSelectedBook((current) => current?.id === book.id ? null : current);
    fetch(`/api/library/${book.id}`, { method: "DELETE" }).catch(() => undefined);
    setToast(`${book.title} foi removido da biblioteca.`);
  };

  const finishTutorial = () => {
    localStorage.setItem("mybookshelf-tutorial-v1", "completed");
    initializeStats().catch(() => undefined);
    setTutorialStep(null);
  };

  const saveOrganization = (item: OrganizationItem) => {
    const editing = organizations.some((existing) => existing.id === item.id);
    setOrganizations((current) => [item, ...current.filter((existing) => existing.id !== item.id)]);
    if (!isNativeRuntime()) fetch("/api/organization", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) }).catch(() => undefined);
    setOrganizationDialog(null);
    setToast(`${item.name} foi ${editing ? "atualizado" : "criado"} e salvo.`);
  };

  const deleteOrganization = (item: OrganizationItem) => {
    if (!window.confirm(`Excluir ${item.name}? Os metadados automáticos dos livros serão preservados.`)) return;
    setOrganizations((current) => current.filter((existing) => existing.id !== item.id));
    if (!isNativeRuntime()) fetch(`/api/organization?id=${encodeURIComponent(item.id)}`, { method: "DELETE" }).catch(() => undefined);
    setToast(`${item.name} foi removido. Os metadados automáticos foram mantidos.`);
  };

  const useOrganizationFilter = (item: OrganizationItem) => {
    navigate("library");
    setOrganizationFilter({ label: item.name, bookIds: item.bookIds });
    setToast(`Mostrando livros de ${item.name}.`);
  };

  const appStyle = { "--accent": accent } as React.CSSProperties;

  return (
    <main className="app-shell" data-theme={theme} data-style={style} data-native={isNativeRuntime() ? "true" : undefined} style={appStyle}>
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
            <button type="button" className="primary-button add-book-button" onClick={() => setShowAdd(true)} aria-haspopup="dialog"><span className="add-icon" aria-hidden="true">+</span>Adicionar livro</button>
          </div>
        </header>

        {selectedBook ? (
          <BookDetail book={selectedBook} relatedBooks={books.filter((item) => item.id !== selectedBook.id).slice(0, 3)} onBack={() => setSelectedBook(null)} onUpdate={updateBook} onRead={() => setShowReading(true)} />
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

      {showAdd && <AddBookDialog books={books} onClose={() => setShowAdd(false)} onAdd={(book) => { setBooks((current) => [book, ...current]); setShowAdd(false); setToast(`${book.title} foi adicionado à sua estante.`); }} />}
      {showPrefs && <Preferences theme={theme} setTheme={setTheme} style={style} setStyle={setStyle} accent={accent} setAccent={setAccent} onTutorial={() => { setShowPrefs(false); setTutorialStep(0); }} onClose={() => setShowPrefs(false)} />}
      {showReading && selectedBook && <ReadingDialog book={selectedBook} onClose={() => setShowReading(false)} onSave={(book) => { updateBook(book); setShowReading(false); setToast("Progresso salvo automaticamente."); }} />}
      {organizationDialog && <OrganizationDialog kind={organizationDialog.kind} item={organizationDialog.item} books={books} existing={organizations} onClose={() => setOrganizationDialog(null)} onSave={saveOrganization} />}
      {tutorialStep !== null && <Tutorial step={tutorialStep} onStep={setTutorialStep} onSkip={finishTutorial} onFinish={finishTutorial} />}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

function Dashboard({ books, readingBook, onOpen, onRead, onAdd, onNavigate }: { books: Book[]; readingBook?: Book; onOpen: (book: Book) => void; onRead: () => void; onAdd: () => void; onNavigate: (section: string) => void }) {
  const [today, setToday] = useState(() => new Date());
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
  const recentDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date;
  });
  const weeklyValues = recentDays.map((date) => pagesByDate.get(localDateKey(date)) ?? 0);
  const weeklyPages = weeklyValues.reduce((total, value) => total + value, 0);
  const maxWeekly = Math.max(1, ...weeklyValues);
  const dateKeys = [...pagesByDate.keys()].sort();
  const dateSet = new Set(dateKeys);
  let streakCursor = new Date(today);
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
        <div><span className="eyebrow">{todayLabel(today)}</span><h1>{greetingFor(today)}, leitor.</h1><p>{pagesByDate.size ? `${pagesByDate.get(todayKey) ?? 0} páginas registradas hoje.` : "Suas métricas começam com a primeira leitura registrada."}</p></div>
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
          <div className="section-label"><div><span>Leitura esta semana</span><small>{weeklyPages} páginas · {Math.round(weeklyPages * 1.2)} min</small></div><button>Últimos 7 dias⌄</button></div>
          <div className="bar-chart" aria-label="Páginas lidas por dia da semana">
            {weeklyValues.map((value, index) => <div key={localDateKey(recentDays[index])}><span className={index === 6 ? "today" : ""} style={{ height: `${Math.max(4, Math.round((value / maxWeekly) * 92))}%` }}><b>{value || ""}</b></span><small>{new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(recentDays[index]).slice(0, 3)}</small></div>)}
          </div>
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
  const title = section === "reading" ? "Lendo agora" : section === "read" ? "Livros lidos" : section === "favorites" ? "Favoritos" : "Sua biblioteca";
  return (
    <div className="page library-page">
      <section className="page-heading library-heading"><div><span className="eyebrow">Coleção pessoal</span><h1>{title}</h1><p>{books.length} {books.length === 1 ? "livro encontrado" : "livros encontrados"}</p></div><div className="view-switch" aria-label="Modo de visualização">{[["grid", "▦", "Grade"], ["carousel", "▱", "Carrossel"], ["list", "☷", "Lista"], ["table", "▤", "Tabela"]].map(([mode, icon, label]) => <button key={mode} className={viewMode === mode ? "active" : ""} onClick={() => setViewMode(mode as ViewMode)} title={label}>{icon}</button>)}</div></section>
      <section className="library-tools"><div className="filter-chips"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos</button>{(["reading", "read", "paused", "abandoned", "want"] as Status[]).map((status) => <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{statusLabels[status]}</button>)}</div><button className="sort-button">Ordenar: recentes ⌄</button></section>
      {books.length ? <div className={`book-collection view-${viewMode}`}>
        {books.map((book) => <article className="library-book" key={book.id} tabIndex={0} role="button" onClick={() => onOpen(book)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(book); }}>
          <button className="book-overflow" aria-label={`Ações para ${book.title}`} aria-expanded={actionBookId === book.id} onClick={(event) => { event.stopPropagation(); setActionBookId((current) => current === book.id ? null : book.id); }}>⋮</button>
          {actionBookId === book.id && <div className="book-action-menu" role="menu" onClick={(event) => event.stopPropagation()}>
            <span>Alterar status</span>
            <button role="menuitem" onClick={() => { onStatusChange(book, "reading"); setActionBookId(null); }}><i>◐</i>Lendo</button>
            <button role="menuitem" onClick={() => { onStatusChange(book, "read"); setActionBookId(null); }}><i>✓</i>Lido</button>
            <button role="menuitem" onClick={() => { onStatusChange(book, "abandoned"); setActionBookId(null); }}><i>×</i>Abandonado</button>
            <button className="danger" role="menuitem" onClick={() => { if (window.confirm(`Excluir “${book.title}” da biblioteca?`)) onDelete(book); setActionBookId(null); }}><i>⌫</i>Excluir livro</button>
          </div>}
          <Cover book={book} size={viewMode === "table" ? "small" : "medium"} />
          <div className="library-book-copy"><span className={`book-status status-${book.status}`}>{statusLabels[book.status]}</span><h2>{book.title}</h2><p>{book.author}</p>{book.status === "reading" || book.status === "paused" ? <><ProgressBar value={progress(book)} /><small>{progress(book)}% · {book.currentPage}/{book.pages} páginas</small></> : <small>{book.published} · {book.pages || "—"} páginas</small>}<div className="book-tags">{book.categories.slice(0, 2).map((category) => <i key={category}>{category}</i>)}</div></div>
          <div className="table-meta"><span>{book.publisher || "—"}</span><span>{book.language || "—"}</span><span>{book.rating ? `${"★".repeat(book.rating)}${"☆".repeat(5 - book.rating)}` : "Sem avaliação"}</span></div>
        </article>)}
      </div> : <div className="empty-state"><span>⌕</span><h2>Nenhum livro por aqui</h2><p>Experimente remover um filtro ou buscar outro termo.</p></div>}
    </div>
  );
}

function BookDetail({ book, relatedBooks, onBack, onUpdate, onRead }: { book: Book; relatedBooks: Book[]; onBack: () => void; onUpdate: (book: Book) => void; onRead: () => void }) {
  const [tab, setTab] = useState("overview");
  const [note, setNote] = useState(book.note ?? "");
  const saveNote = () => onUpdate({ ...book, note });
  return (
    <div className="page detail-page">
      <button className="back-button" onClick={onBack}>← Voltar para a biblioteca</button>
      <section className="detail-hero">
        <Cover book={book} size="large" />
        <div className="detail-title"><span className={`book-status status-${book.status}`}>{statusLabels[book.status]}</span><h1>{book.title}</h1><p>{book.author}</p><div className="rating" aria-label={`${book.rating} de 5 estrelas`}>{[1,2,3,4,5].map((star) => <button key={star} onClick={() => onUpdate({ ...book, rating: star })}>{star <= book.rating ? "★" : "☆"}</button>)}</div><div className="detail-actions"><button className="primary-button" onClick={onRead}>＋ Registrar leitura</button><button className="quiet-button" onClick={() => onUpdate({ ...book, favorite: !book.favorite })}>{book.favorite ? "♥ Favorito" : "♡ Favoritar"}</button></div></div>
        <div className="detail-progress panel"><small>Seu progresso</small><b>{progress(book)}%</b><ProgressBar value={progress(book)} /><p>Página {book.currentPage} de {book.pages || "—"}</p><span>≈ {Math.max(0, Math.round((book.pages - book.currentPage) * 1.2))} min restantes</span></div>
      </section>
      <nav className="detail-tabs">{[["overview", "Visão geral"], ["history", "Histórico"], ["notes", "Anotações"], ["related", "Relacionados"]].map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>
      {tab === "overview" && <div className="detail-grid"><section><h2>Sobre o livro</h2><p className="description">{book.description || "Descrição ainda não disponível. Os metadados poderão ser atualizados quando houver conexão."}</p><h2>Detalhes</h2><dl className="metadata"><div><dt>Editora</dt><dd>{book.publisher || "—"}</dd></div><div><dt>Publicação</dt><dd>{book.published || "—"}</dd></div><div><dt>Idioma</dt><dd>{book.language || "—"}</dd></div><div><dt>ISBN</dt><dd>{book.isbn || "—"}</dd></div><div><dt>Páginas</dt><dd>{book.pages || "—"}</dd></div><div><dt>Categorias</dt><dd>{book.categories.join(", ") || "—"}</dd></div></dl></section><aside className="detail-side panel"><h2>Ritmo de leitura</h2><div className="pace-number"><b>{book.sessions.reduce((total, item) => total + item.end - item.start + 1, 0)}</b><span>páginas registradas</span></div><p>Média por sessão <b>38 páginas</b></p><p>Previsão de término <b>17 de agosto</b></p></aside></div>}
      {tab === "history" && <section className="history-list detail-history"><h2>Histórico de leitura</h2>{book.sessions.length ? book.sessions.slice().reverse().map((session, index) => <article key={`${session.date}-${index}`}><span>{session.date}</span><i /><div><b>Páginas {session.start}–{session.end}</b><p>{session.end - session.start + 1} páginas lidas</p></div></article>) : <div className="empty-state"><h2>Nenhuma sessão registrada</h2><p>Registre sua primeira leitura para começar o histórico.</p></div>}</section>}
      {tab === "notes" && <section className="notes-editor"><div><h2>Anotações pessoais</h2><span>Salvamento automático neste dispositivo</span></div><textarea value={note} onChange={(event) => setNote(event.target.value)} onBlur={saveNote} placeholder="Registre uma ideia, reflexão ou comentário…" /><button className="quiet-button" onClick={saveNote}>✓ Salvo automaticamente</button></section>}
      {tab === "related" && (relatedBooks.length ? <section className="related-grid">{relatedBooks.map((item) => <article key={item.id}><Cover book={item} /><h2>{item.title}</h2><p>{item.author}</p></article>)}</section> : <section className="panel empty-state"><h2>Nenhum livro relacionado</h2><p>Adicione mais livros para ver sugestões nesta área.</p></section>)}
    </div>
  );
}

function Stats({ books }: { books: Book[] }) {
  const read = books.filter((book) => book.status === "read");
  const pagesRead = books.reduce((total, book) => total + book.sessions.reduce((sum, session) => sum + Math.max(0, session.end - session.start + 1), 0), 0);
  const rated = books.filter((book) => book.rating > 0);
  const averageRating = rated.length ? (rated.reduce((total, book) => total + book.rating, 0) / rated.length).toFixed(1).replace(".", ",") : "0,0";
  const estimatedHours = Math.round((pagesRead * 1.2) / 60);
  return <div className="page stats-page"><section className="page-heading"><div><span className="eyebrow">Visão geral</span><h1>Estatísticas</h1><p>Entenda seus hábitos sem transformar a leitura em obrigação.</p></div></section><div className="stats-kpis"><article className="panel"><small>Livros lidos</small><b>{read.length}</b><span>{read.length ? "Registrados na biblioteca" : "Nenhum livro concluído"}</span></article><article className="panel"><small>Páginas lidas</small><b>{pagesRead.toLocaleString("pt-BR")}</b><span>{pagesRead ? "Em sessões registradas" : "Nenhuma página registrada"}</span></article><article className="panel"><small>Tempo estimado</small><b>{estimatedHours}h</b><span>{estimatedHours ? "Com base nas páginas lidas" : "Nenhum tempo registrado"}</span></article><article className="panel"><small>Avaliação média</small><b>{averageRating}</b><span>de 5 estrelas</span></article></div><div className="stats-grid"><section className="panel"><div className="section-label"><span>Páginas por mês</span><button>2026⌄</button></div><div className="monthly-chart">{Array.from({ length: 12 }, (_, index) => <div key={index}><span style={{ height: "3%" }} /><small>{"JFMAMJJASOND"[index]}</small></div>)}</div></section><section className="panel category-stats"><div className="section-label"><span>Categorias mais lidas</span></div><div className="empty-state"><h2>Nenhum dado ainda</h2><p>As categorias aparecerão após suas primeiras leituras.</p></div></section></div><section className="panel author-table"><div className="section-label"><span>Autores mais lidos</span></div><div className="empty-state"><h2>Nenhum autor registrado</h2><p>Seus autores mais lidos aparecerão aqui.</p></div></section></div>;
}

function History({ books }: { books: Book[] }) {
  const events = books.slice(0, 12).map((book) => ["Recentemente", book.status === "read" ? "finish" : "add", book.status === "read" ? "Livro concluído" : "Livro adicionado", book.title]);
  return <div className="page history-page"><section className="page-heading"><div><span className="eyebrow">Registro permanente</span><h1>Histórico</h1><p>Todas as mudanças importantes da sua biblioteca, em ordem cronológica.</p></div></section>{events.length ? <div className="history-layout"><section className="history-list panel">{events.map(([date, type, title, detail], index) => <article key={index}><span>{date}</span><i className={`event-${type}`} /><div><b>{title}</b><p>{detail}</p></div></article>)}</section><aside className="panel history-filter"><h2>Filtrar atividade</h2>{["Todos os eventos", "Leituras", "Livros", "Anotações", "Avaliações"].map((label, index) => <button className={index === 0 ? "active" : ""} key={label}>{label}<span>{index === 0 ? events.length : 0}</span></button>)}</aside></div> : <section className="panel empty-state"><span>↺</span><h2>Nenhuma atividade ainda</h2><p>Seu histórico começará quando você adicionar o primeiro livro.</p></section>}</div>;
}

function Organize({ section, books, items, onOpen, onCreate, onEdit, onDelete, onFilter }: { section: string; books: Book[]; items: OrganizationItem[]; onOpen: (book: Book) => void; onCreate: () => void; onEdit: (item: OrganizationItem) => void; onDelete: (item: OrganizationItem) => void; onFilter: (item: OrganizationItem) => void }) {
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
  return <div className="page organize-page"><section className="page-heading"><div><span className="eyebrow">Organização flexível</span><h1>{title}</h1><p>{subtitle}</p></div><button type="button" className="primary-button organization-create" onClick={onCreate}><span className="add-icon" aria-hidden="true">+</span>Criar {createLabel}</button></section><div className="organize-grid">{groups.map((group) => { const groupBooks = group.bookIds.map((id) => books.find((book) => book.id === id)).filter((book): book is Book => Boolean(book)); return <article className="panel" key={group.id}><div className="collection-head"><span>{section === "tags" ? "#" : section === "collections" ? "▤" : "◇"}</span><button className="collection-filter" onClick={() => onFilter(group)}><h2>{group.name}</h2><p>{groupBooks.length} {groupBooks.length === 1 ? "livro" : "livros"}{group.manual ? " · Manual" : " · Automática"}</p></button><div className="collection-actions">{group.manual && <><button type="button" onClick={() => onEdit(group)} aria-label={`Editar ${group.name}`}>✎</button><button type="button" onClick={() => onDelete(group)} aria-label={`Excluir ${group.name}`}>×</button></>}<button type="button" onClick={() => onFilter(group)} aria-label={`Filtrar por ${group.name}`}>→</button></div></div><div className="cover-stack">{groupBooks.slice(0, 3).map((book) => <button key={book.id} onClick={() => onOpen(book)}><Cover book={book} size="small" /></button>)}</div></article>; })}</div></div>;
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
      const data = isNativeRuntime()
        ? { books: await searchOpenLibraryDirect(title, author) }
        : (await (await fetch(`/api/books/search?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`)).json()) as { books?: SearchResult[]; error?: string };
      setResults(data.books ?? []); if (!data.books?.length) setError(data.error ?? "Nenhum resultado encontrado.");
    } catch { setError("Sem conexão. Você ainda pode adicionar o livro manualmente."); }
    finally { setLoading(false); }
  };
  const add = (result?: SearchResult) => {
    const picked = result ?? { sourceId: crypto.randomUUID(), title, author, coverUrl: "", pages: 0, published: "", publisher: "", language: "", isbn: "", categories: [], tags: [] };
    if (!picked.title.trim() || !picked.author.trim()) { setError("Título e autor são obrigatórios."); return; }
    const duplicate = books.some((book) => book.title.toLowerCase() === picked.title.toLowerCase() && book.author.toLowerCase() === picked.author.toLowerCase());
    if (duplicate) { setError("Este livro já está na sua biblioteca."); return; }
    const book: Book = { id: crypto.randomUUID(), title: picked.title, author: picked.author, coverUrl: picked.coverUrl, pages: picked.pages, currentPage: 0, status: "want", rating: 0, favorite: false, description: "", published: picked.published, publisher: picked.publisher, language: picked.language, isbn: picked.isbn, categories: picked.categories, tags: picked.tags, accent: "#7fd6ca", sessions: [] };
    if (!isNativeRuntime()) fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...book, metadata: { published: book.published, publisher: book.publisher, language: book.language, isbn: book.isbn, categories: book.categories, tags: book.tags, accent: book.accent } }) }).catch(() => undefined);
    onAdd(book);
  };
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-title"><div className="dialog-head"><div><span className="eyebrow">Cadastro inteligente</span><h2 id="add-title">Adicionar livro</h2><p>Informe somente o essencial. Buscamos o restante.</p></div><button onClick={onClose} aria-label="Fechar">×</button></div><div className="form-row"><label><span>Título do livro</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Ex.: Ensaio sobre a cegueira" /></label><label><span>Autor</span><input value={author} onChange={(event) => setAuthor(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Ex.: José Saramago" /></label></div><button className="primary-button search-metadata" onClick={search} disabled={loading}>{loading ? "Buscando metadados…" : "⌕ Buscar automaticamente"}</button>{error && <p className="form-error">{error}</p>}{results.length > 0 && <div className="search-results">{results.map((result) => <button key={result.sourceId} onClick={() => add(result)}><div className="result-cover">{result.coverUrl ? <img src={result.coverUrl} alt="" /> : <span>{result.title.slice(0, 1)}</span>}</div><span><b>{result.title}</b><small>{result.author} · {result.published || "Ano desconhecido"}</small><i>{result.pages ? `${result.pages} páginas` : "Páginas não informadas"}</i></span><strong className="add-icon">+</strong></button>)}</div>}<div className="manual-add"><span>Não encontrou?</span><button onClick={() => add()}>Adicionar com estes dados</button></div><footer>Metadados fornecidos pela Open Library. Suas edições manuais nunca serão sobrescritas.</footer></section></div>;
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

function ReadingDialog({ book, onClose, onSave }: { book: Book; onClose: () => void; onSave: (book: Book) => void }) {
  const suggestedStart = Math.min(book.pages || Infinity, book.currentPage + 1);
  const [start, setStart] = useState(suggestedStart || 1);
  const [end, setEnd] = useState(Math.min(book.pages || suggestedStart + 30, suggestedStart + 29));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const submit = () => {
    if (start < 1 || end < start || (book.pages > 0 && end > book.pages)) { setError(`Use um intervalo entre 1 e ${book.pages || "o fim do livro"}.`); return; }
    if (book.sessions.some((session) => start <= session.end && end >= session.start)) { setError("Este intervalo se sobrepõe a uma leitura já registrada."); return; }
    const session = { date: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`)).replace(".", ""), isoDate: date, start, end };
    const updated = { ...book, currentPage: Math.max(book.currentPage, end), status: end >= book.pages && book.pages > 0 ? "read" as Status : "reading" as Status, sessions: [...book.sessions, session] };
    if (!isNativeRuntime()) fetch(`/api/library/${book.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPage: updated.currentPage, status: updated.status, session: { startPage: start, endPage: end, readAt: date } }) }).catch(() => undefined);
    onSave(updated);
  };
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog reading-dialog" role="dialog" aria-modal="true"><div className="dialog-head"><div><span className="eyebrow">Sessão de leitura</span><h2>Registrar progresso</h2><p>{book.title}</p></div><button onClick={onClose} aria-label="Fechar">×</button></div><div className="reading-book-row"><Cover book={book} size="small" /><div><b>{progress(book)}% concluído</b><ProgressBar value={progress(book)} /><span>Você parou na página {book.currentPage}</span></div></div><div className="page-range"><label><span>Página inicial</span><input type="number" min="1" max={book.pages} value={start} onChange={(event) => setStart(Number(event.target.value))} /></label><i>→</i><label><span>Página final</span><input type="number" min="1" max={book.pages} value={end} onChange={(event) => setEnd(Number(event.target.value))} /></label></div><label className="date-field"><span>Data da leitura</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><div className="session-summary"><span>Páginas nesta sessão</span><b>{Math.max(0, end - start + 1)}</b></div>{error && <p className="form-error">{error}</p>}<button className="primary-button dialog-submit" onClick={submit}>Registrar leitura</button><footer>Salvo automaticamente e disponível offline.</footer></section></div>;
}

function Tutorial({ step, onStep, onSkip, onFinish }: { step: number; onStep: (step: number) => void; onSkip: () => void; onFinish: () => void }) {
  const item = tutorialSteps[step];
  const last = step === tutorialSteps.length - 1;
  return <div className="tutorial-backdrop"><section className="tutorial" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><header><span>Guia rápido</span><button onClick={onSkip}>Pular tutorial</button></header><div className="tutorial-visual" aria-hidden="true"><i>{item.icon}</i><span>{String(step + 1).padStart(2, "0")}</span></div><div className="tutorial-copy"><small>Etapa {step + 1} de {tutorialSteps.length}</small><h2 id="tutorial-title">{item.title}</h2><p>{item.copy}</p></div><div className="tutorial-progress" aria-label={`Etapa ${step + 1} de ${tutorialSteps.length}`}>{tutorialSteps.map((_, index) => <i key={index} className={index <= step ? "active" : ""} />)}</div><footer><button className="quiet-button" onClick={() => onStep(step - 1)} disabled={step === 0}>← Voltar</button><button className="primary-button" onClick={() => last ? onFinish() : onStep(step + 1)}>{last ? "Concluir" : "Avançar →"}</button></footer></section></div>;
}

function Preferences({ theme, setTheme, style, setStyle, accent, setAccent, onTutorial, onClose }: { theme: Theme; setTheme: (theme: Theme) => void; style: VisualStyle; setStyle: (style: VisualStyle) => void; accent: string; setAccent: (accent: string) => void; onTutorial: () => void; onClose: () => void }) {
  return <div className="dialog-backdrop preference-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="preferences" role="dialog" aria-modal="true" aria-labelledby="prefs-title"><div className="dialog-head"><div><span className="eyebrow">Aparência</span><h2 id="prefs-title">Sua interface</h2><p>As mudanças são aplicadas imediatamente.</p></div><button onClick={onClose} aria-label="Fechar">×</button></div><div className="preference-group"><h3>Tema</h3><div className="segmented"><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>☼ Claro</button><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>◐ Escuro</button></div></div><div className="preference-group"><h3>Estilo visual</h3><div className="style-options"><button className={style === "minimal" ? "active" : ""} onClick={() => setStyle("minimal")}><span className="style-preview minimal-preview"><i /><i /><i /></span><b>Minimalista</b><small>Conteúdo e espaço</small></button><button className={style === "brutal" ? "active" : ""} onClick={() => setStyle("brutal")}><span className="style-preview brutal-preview"><i /><i /><i /></span><b>Neobrutalismo</b><small>Traços e contraste</small></button><button className={style === "glass" ? "active" : ""} onClick={() => setStyle("glass")}><span className="style-preview glass-preview"><i /><i /><i /></span><b>Glass</b><small>Vidro e profundidade</small></button></div></div><div className="preference-group"><h3>Cor principal</h3><div className="accent-options">{accentOptions.map((color) => <button key={color} className={accent === color ? "active" : ""} style={{ background: color }} onClick={() => setAccent(color)} aria-label={`Usar cor ${color}`}>{accent === color ? "✓" : ""}</button>)}</div></div><button className="tutorial-reopen" onClick={onTutorial}><span>?</span><span><b>Rever tutorial</b><small>Conheça novamente os principais recursos.</small></span><i>→</i></button><div className="preference-note"><span>AA</span><p><b>Legibilidade preservada</b>Contraste e hierarquia permanecem consistentes em todas as combinações.</p></div></section></div>;
}
