"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Status = "reading" | "read" | "paused" | "abandoned" | "want";
type ViewMode = "grid" | "carousel" | "list" | "table";
type VisualStyle = "minimal" | "brutal" | "glass";
type Theme = "dark" | "light";

type Session = { date: string; start: number; end: number };
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

const accentOptions = ["#c7f36b", "#7fd6ca", "#f3a868", "#b7a0ff", "#ed7c9c"];

function progress(book: Book) {
  return book.pages ? Math.min(100, Math.round((book.currentPage / book.pages) * 100)) : 0;
}

function todayLabel() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
}

function Cover({ book, size = "medium" }: { book: Book; size?: "small" | "medium" | "large" }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`book-cover book-cover--${size}`} style={{ "--cover-accent": book.accent } as React.CSSProperties}>
      {!broken && book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.coverUrl} alt={`Capa de ${book.title}`} onError={() => setBroken(true)} />
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

function Heatmap() {
  const cells = useMemo(
    () =>
      Array.from({ length: 119 }, (_, index) => {
        const wave = (index * 7 + Math.floor(index / 11) * 3) % 17;
        return index > 99 ? (wave % 5 === 0 ? 0 : Math.min(4, Math.ceil(wave / 4))) : wave > 10 ? 0 : Math.min(4, Math.ceil(wave / 3));
      }),
    [],
  );
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
  const [books, setBooks] = useState<Book[]>(seedBooks);
  const [section, setSection] = useState("dashboard");
  const [theme, setTheme] = useState<Theme>("dark");
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
  const hydrated = useRef(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const cached = localStorage.getItem("mybookshelf-library-v1");
    const settings = localStorage.getItem("mybookshelf-settings-v1");
    if (cached) {
      try { setBooks(JSON.parse(cached) as Book[]); } catch { /* keep safe seed */ }
    }
    if (settings) {
      try {
        const parsed = JSON.parse(settings) as { theme?: Theme; style?: VisualStyle; accent?: string };
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.style) setStyle(parsed.style);
        if (parsed.accent) setAccent(parsed.accent);
      } catch { /* keep defaults */ }
    }
    fetch("/api/library")
      .then((response) => response.json())
      .then((data: { books?: Array<Record<string, unknown>> }) => {
        if (!data.books?.length) return;
        setBooks((current) => {
          const currentIds = new Set(current.map((book) => book.id));
          const synced = data.books!
            .filter((item) => !currentIds.has(String(item.id)))
            .map((item) => ({
              id: String(item.id), title: String(item.title), author: String(item.author),
              coverUrl: String(item.coverUrl ?? ""), pages: Number(item.pages ?? 0),
              currentPage: Number(item.currentPage ?? 0), status: (item.status ?? "want") as Status,
              rating: Number(item.rating ?? 0), favorite: Boolean(item.favorite),
              description: String(item.description ?? ""), published: "", publisher: "",
              language: "", isbn: "", categories: [], tags: [], accent: "#7fd6ca", sessions: [],
            }));
          return [...synced, ...current];
        });
      })
      .catch(() => undefined)
      .finally(() => { hydrated.current = true; });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    localStorage.setItem("mybookshelf-library-v1", JSON.stringify(books));
  }, [books]);

  useEffect(() => {
    localStorage.setItem("mybookshelf-settings-v1", JSON.stringify({ theme, style, accent }));
  }, [theme, style, accent]);

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
    if (filter !== "all") result = result.filter((book) => book.status === filter);
    if (query.trim()) {
      const normalized = query.toLocaleLowerCase("pt-BR");
      result = result.filter((book) => `${book.title} ${book.author} ${book.tags.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalized));
    }
    return result;
  }, [books, filter, query, section]);

  const readingBook = books.find((book) => book.status === "reading") ?? books[0];

  const navigate = (next: string) => {
    setSection(next);
    setSelectedBook(null);
    setQuery("");
    if (["reading", "read", "favorites"].includes(next)) setFilter("all");
  };

  const updateBook = (updated: Book) => {
    setBooks((current) => current.map((book) => (book.id === updated.id ? updated : book)));
    setSelectedBook(updated);
  };

  const appStyle = { "--accent": accent } as React.CSSProperties;

  return (
    <main className="app-shell" data-theme={theme} data-style={style} style={appStyle}>
      <aside className="sidebar">
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

      <div className="app-main">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => navigate("dashboard")} aria-label="Início"><span className="brand-mark"><i /><i /><i /></span></button>
          <label className="global-search">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => section === "dashboard" && setSection("library")} placeholder="Buscar por título, autor ou tag…" />
            <kbd>⌘ K</kbd>
          </label>
          <div className="top-actions">
            <button className="icon-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Alternar tema">{theme === "dark" ? "☼" : "◐"}</button>
            <button className="icon-button" onClick={() => setShowPrefs(true)} aria-label="Personalizar interface">◈</button>
            <button className="primary-button" onClick={() => setShowAdd(true)}><span>＋</span>Adicionar livro</button>
          </div>
        </header>

        {selectedBook ? (
          <BookDetail book={selectedBook} onBack={() => setSelectedBook(null)} onUpdate={updateBook} onRead={() => setShowReading(true)} />
        ) : section === "dashboard" ? (
          <Dashboard books={books} readingBook={readingBook} onOpen={setSelectedBook} onRead={() => { setSelectedBook(readingBook); setShowReading(true); }} onNavigate={navigate} />
        ) : ["library", "reading", "read", "favorites"].includes(section) ? (
          <Library books={visibleBooks} section={section} viewMode={viewMode} setViewMode={setViewMode} filter={filter} setFilter={setFilter} onOpen={setSelectedBook} />
        ) : section === "stats" ? (
          <Stats books={books} />
        ) : section === "history" ? (
          <History books={books} />
        ) : section === "integrations" ? (
          <Integrations />
        ) : (
          <Organize section={section} books={books} onOpen={setSelectedBook} />
        )}
      </div>

      <nav className="mobile-nav" aria-label="Navegação principal">
        {[["dashboard", "⌂", "Início"], ["library", "▦", "Biblioteca"], ["add", "＋", "Adicionar"], ["stats", "↗", "Estatísticas"], ["profile", "○", "Perfil"]].map(([id, icon, label]) => (
          <button key={id} className={section === id ? "active" : ""} onClick={() => id === "add" ? setShowAdd(true) : id === "profile" ? setShowPrefs(true) : navigate(id)}><span>{icon}</span>{label}</button>
        ))}
      </nav>

      {showAdd && <AddBookDialog books={books} onClose={() => setShowAdd(false)} onAdd={(book) => { setBooks((current) => [book, ...current]); setShowAdd(false); setToast(`${book.title} foi adicionado à sua estante.`); }} />}
      {showPrefs && <Preferences theme={theme} setTheme={setTheme} style={style} setStyle={setStyle} accent={accent} setAccent={setAccent} onClose={() => setShowPrefs(false)} />}
      {showReading && selectedBook && <ReadingDialog book={selectedBook} onClose={() => setShowReading(false)} onSave={(book) => { updateBook(book); setShowReading(false); setToast("Progresso salvo automaticamente."); }} />}
      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}

function Dashboard({ books, readingBook, onOpen, onRead, onNavigate }: { books: Book[]; readingBook: Book; onOpen: (book: Book) => void; onRead: () => void; onNavigate: (section: string) => void }) {
  const read = books.filter((book) => book.status === "read").length;
  return (
    <div className="page dashboard-page">
      <section className="page-heading dashboard-heading">
        <div><span className="eyebrow">{todayLabel()}</span><h1>Boa noite, leitor.</h1><p>Você está a 28 páginas de manter sua melhor sequência.</p></div>
        <div className="heading-quote"><i>“</i><p>Um livro é uma prova de que os seres humanos são capazes de fazer magia.<small>— Carl Sagan</small></p></div>
      </section>

      <div className="dashboard-grid">
        <section className="current-card panel">
          <div className="section-label"><span>Leitura atual</span><button onClick={() => onOpen(readingBook)}>Ver detalhes →</button></div>
          <div className="current-book">
            <Cover book={readingBook} size="large" />
            <div className="current-copy">
              <span className="status-pill"><i /> Em andamento</span>
              <h2>{readingBook.title}</h2><p className="book-author">{readingBook.author}</p>
              <div className="progress-copy"><b>{progress(readingBook)}%</b><span>Página {readingBook.currentPage} de {readingBook.pages}</span></div>
              <ProgressBar value={progress(readingBook)} />
              <p className="estimate">≈ 3h 40min restantes</p>
              <div className="current-actions"><button className="primary-button" onClick={onRead}>＋ Registrar leitura</button><button className="quiet-button" onClick={() => onOpen(readingBook)}>Continuar</button></div>
            </div>
          </div>
        </section>

        <section className="quick-stats">
          <article className="metric panel"><span className="metric-icon">⌁</span><div><small>Páginas hoje</small><b>46</b><p><i>↗ 12%</i> vs. média</p></div></article>
          <article className="metric panel"><span className="metric-icon">⌁</span><div><small>Sequência atual</small><b>12 <em>dias</em></b><p>Recorde: 18 dias</p></div></article>
          <article className="metric panel"><span className="metric-icon">◉</span><div><small>Livros em 2026</small><b>{read + 9}</b><p>Meta: 24 livros</p></div></article>
        </section>

        <section className="weekly panel">
          <div className="section-label"><div><span>Leitura esta semana</span><small>184 páginas · 3h 12min</small></div><button>Últimos 7 dias⌄</button></div>
          <div className="bar-chart" aria-label="Páginas lidas por dia da semana">
            {[18, 31, 22, 46, 28, 0, 39].map((value, index) => <div key={index}><span className={index === 3 ? "today" : ""} style={{ height: `${Math.max(4, value * 1.75)}%` }}><b>{value || ""}</b></span><small>{["seg", "ter", "qua", "qui", "sex", "sáb", "dom"][index]}</small></div>)}
          </div>
        </section>

        <section className="streak-card panel">
          <div className="section-label"><div><span>Sua constância</span><small>76 dias com leitura nos últimos 4 meses</small></div><div className="streak-badge">◒ 12 dias</div></div>
          <Heatmap />
        </section>

        <section className="recent-books panel">
          <div className="section-label"><div><span>Adicionados recentemente</span><small>Continue construindo sua biblioteca</small></div><button onClick={() => onNavigate("library")}>Ver biblioteca →</button></div>
          <div className="recent-row">
            {books.slice(1, 6).map((book) => <button className="mini-book" key={book.id} onClick={() => onOpen(book)}><Cover book={book} /><span><b>{book.title}</b><small>{book.author}</small><i>{statusLabels[book.status]}</i></span></button>)}
          </div>
        </section>

        <aside className="dashboard-rail">
          <section className="goal-card panel"><div className="section-label"><span>Meta anual</span><button>Editar</button></div><div className="goal-ring"><div><b>13</b><small>de 24 livros</small></div></div><p><span>54% concluída</span><b>11 restantes</b></p><ProgressBar value={54} /><small>No ritmo atual, você conclui em novembro.</small></section>
          <section className="note-card panel"><div className="section-label"><span>Nota em destaque</span><button>···</button></div><p>“O mistério da vida não é um problema a resolver, mas uma realidade a experimentar.”</p><div><span className="tiny-cover" style={{ background: readingBook.accent }} /><span><b>{readingBook.title}</b><small>Página 146</small></span></div></section>
          <section className="next-card panel"><div className="section-label"><span>Na sua fila</span><button onClick={() => onNavigate("library")}>Ver todos</button></div>{books.filter((book) => book.status === "want").concat(books.filter((book) => book.status === "paused")).slice(0, 2).map((book, index) => <button key={book.id} onClick={() => onOpen(book)}><span>{index + 1}</span><Cover book={book} size="small" /><span><b>{book.title}</b><small>{book.author}</small></span></button>)}</section>
        </aside>
      </div>
    </div>
  );
}

function Library({ books, section, viewMode, setViewMode, filter, setFilter, onOpen }: { books: Book[]; section: string; viewMode: ViewMode; setViewMode: (mode: ViewMode) => void; filter: Status | "all"; setFilter: (filter: Status | "all") => void; onOpen: (book: Book) => void }) {
  const title = section === "reading" ? "Lendo agora" : section === "read" ? "Livros lidos" : section === "favorites" ? "Favoritos" : "Sua biblioteca";
  return (
    <div className="page library-page">
      <section className="page-heading library-heading"><div><span className="eyebrow">Coleção pessoal</span><h1>{title}</h1><p>{books.length} {books.length === 1 ? "livro encontrado" : "livros encontrados"}</p></div><div className="view-switch" aria-label="Modo de visualização">{[["grid", "▦", "Grade"], ["carousel", "▱", "Carrossel"], ["list", "☷", "Lista"], ["table", "▤", "Tabela"]].map(([mode, icon, label]) => <button key={mode} className={viewMode === mode ? "active" : ""} onClick={() => setViewMode(mode as ViewMode)} title={label}>{icon}</button>)}</div></section>
      <section className="library-tools"><div className="filter-chips"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos</button>{(["reading", "read", "paused", "want"] as Status[]).map((status) => <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{statusLabels[status]}</button>)}</div><button className="sort-button">Ordenar: recentes ⌄</button></section>
      {books.length ? <div className={`book-collection view-${viewMode}`}>
        {books.map((book) => <button className="library-book" key={book.id} onClick={() => onOpen(book)}>
          <Cover book={book} size={viewMode === "table" ? "small" : "medium"} />
          <div className="library-book-copy"><span className={`book-status status-${book.status}`}>{statusLabels[book.status]}</span><h2>{book.title}</h2><p>{book.author}</p>{book.status === "reading" || book.status === "paused" ? <><ProgressBar value={progress(book)} /><small>{progress(book)}% · {book.currentPage}/{book.pages} páginas</small></> : <small>{book.published} · {book.pages || "—"} páginas</small>}<div className="book-tags">{book.categories.slice(0, 2).map((category) => <i key={category}>{category}</i>)}</div></div>
          <div className="table-meta"><span>{book.publisher || "—"}</span><span>{book.language || "—"}</span><span>{book.rating ? `${"★".repeat(book.rating)}${"☆".repeat(5 - book.rating)}` : "Sem avaliação"}</span></div>
        </button>)}
      </div> : <div className="empty-state"><span>⌕</span><h2>Nenhum livro por aqui</h2><p>Experimente remover um filtro ou buscar outro termo.</p></div>}
    </div>
  );
}

function BookDetail({ book, onBack, onUpdate, onRead }: { book: Book; onBack: () => void; onUpdate: (book: Book) => void; onRead: () => void }) {
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
      {tab === "related" && <section className="related-grid">{seedBooks.filter((item) => item.id !== book.id).slice(0, 3).map((item) => <article key={item.id}><Cover book={item} /><h2>{item.title}</h2><p>{item.author}</p></article>)}</section>}
    </div>
  );
}

function Stats({ books }: { books: Book[] }) {
  const read = books.filter((book) => book.status === "read");
  return <div className="page stats-page"><section className="page-heading"><div><span className="eyebrow">Visão geral</span><h1>Estatísticas</h1><p>Entenda seus hábitos sem transformar a leitura em obrigação.</p></div></section><div className="stats-kpis"><article className="panel"><small>Livros lidos</small><b>{read.length + 9}</b><span>↗ 18% este ano</span></article><article className="panel"><small>Páginas lidas</small><b>4.286</b><span>17,8 por dia</span></article><article className="panel"><small>Tempo estimado</small><b>82h</b><span>3h 10min por semana</span></article><article className="panel"><small>Avaliação média</small><b>4,3</b><span>de 5 estrelas</span></article></div><div className="stats-grid"><section className="panel"><div className="section-label"><span>Páginas por mês</span><button>2026⌄</button></div><div className="monthly-chart">{[31,46,58,42,70,54,83,61,0,0,0,0].map((value, index) => <div key={index}><span style={{ height: `${Math.max(3, value)}%` }} /><small>{"JFMAMJJASOND"[index]}</small></div>)}</div></section><section className="panel category-stats"><div className="section-label"><span>Categorias mais lidas</span></div>{[["Ficção científica", 34], ["História", 24], ["Fantasia", 18], ["Clássicos", 14], ["Outros", 10]].map(([label, value]) => <div key={label}><p><span>{label}</span><b>{value}%</b></p><ProgressBar value={Number(value)} /></div>)}</section></div><section className="panel author-table"><div className="section-label"><span>Autores mais lidos</span><button>Ver relatório completo →</button></div><div className="table-row table-head"><span>Autor</span><span>Livros</span><span>Páginas</span><span>Avaliação</span></div>{[["Ursula K. Le Guin", 3, 934, "4,8"], ["Frank Herbert", 2, 1212, "4,5"], ["J. R. R. Tolkien", 2, 734, "5,0"]].map((row) => <div className="table-row" key={String(row[0])}>{row.map((cell, index) => <span key={index}>{cell}</span>)}</div>)}</section></div>;
}

function History({ books }: { books: Book[] }) {
  const events = [
    ["Hoje, 21:14", "progress", "Leitura atualizada", `${books[0].title} · páginas 384–412`],
    ["Hoje, 18:02", "note", "Anotação adicionada", `${books[0].title} · página 391`],
    ["Ontem, 22:47", "progress", "Leitura atualizada", `${books[0].title} · páginas 347–383`],
    ["08 ago, 19:31", "finish", "Livro concluído", books[1].title],
    ["07 ago, 09:12", "add", "Livro adicionado", books[4].title],
    ["04 ago, 20:44", "rating", "Avaliação modificada", `${books[2].title} · 5 estrelas`],
  ];
  return <div className="page history-page"><section className="page-heading"><div><span className="eyebrow">Registro permanente</span><h1>Histórico</h1><p>Todas as mudanças importantes da sua biblioteca, em ordem cronológica.</p></div></section><div className="history-layout"><section className="history-list panel">{events.map(([date, type, title, detail], index) => <article key={index}><span>{date}</span><i className={`event-${type}`} /><div><b>{title}</b><p>{detail}</p></div></article>)}</section><aside className="panel history-filter"><h2>Filtrar atividade</h2>{["Todos os eventos", "Leituras", "Livros", "Anotações", "Avaliações"].map((label, index) => <button className={index === 0 ? "active" : ""} key={label}>{label}<span>{[26, 12, 6, 5, 3][index]}</span></button>)}</aside></div></div>;
}

function Organize({ section, books, onOpen }: { section: string; books: Book[]; onOpen: (book: Book) => void }) {
  const labels: Record<string, [string, string]> = { categories: ["Categorias", "Navegue por assuntos identificados automaticamente."], tags: ["Tags", "Crie relações livres entre livros, ideias e momentos."], collections: ["Coleções", "Agrupe livros em estantes que fazem sentido para você."] };
  const [title, subtitle] = labels[section] ?? labels.categories;
  const groups = section === "categories" ? ["Ficção científica", "Clássicos", "História", "Fantasia", "Desenvolvimento pessoal"] : section === "tags" ? ["política", "humanidade", "gênero", "aventura", "hábitos", "sociedade"] : ["Essenciais", "Para reler", "Viagens longas", "Recomendações de amigos"];
  return <div className="page organize-page"><section className="page-heading"><div><span className="eyebrow">Organização flexível</span><h1>{title}</h1><p>{subtitle}</p></div><button className="primary-button">＋ Criar {section === "collections" ? "coleção" : section === "tags" ? "tag" : "categoria"}</button></section><div className="organize-grid">{groups.map((group, index) => <article className="panel" key={group}><div className="collection-head"><span>{section === "tags" ? "#" : "◇"}</span><div><h2>{group}</h2><p>{(index % 3) + 1} livros</p></div><button>···</button></div><div className="cover-stack">{books.slice(index % 3, index % 3 + 3).map((book) => <button key={book.id} onClick={() => onOpen(book)}><Cover book={book} size="small" /></button>)}</div></article>)}</div></div>;
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
      const response = await fetch(`/api/books/search?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}`);
      const data = (await response.json()) as { books?: SearchResult[]; error?: string };
      setResults(data.books ?? []); if (!data.books?.length) setError(data.error ?? "Nenhum resultado encontrado.");
    } catch { setError("Sem conexão. Você ainda pode adicionar o livro manualmente."); }
    finally { setLoading(false); }
  };
  const add = (result?: SearchResult) => {
    const picked = result ?? { sourceId: crypto.randomUUID(), title, author, coverUrl: "", pages: 0, published: "", publisher: "", language: "", isbn: "", categories: [] };
    if (!picked.title.trim() || !picked.author.trim()) { setError("Título e autor são obrigatórios."); return; }
    const duplicate = books.some((book) => book.title.toLowerCase() === picked.title.toLowerCase() && book.author.toLowerCase() === picked.author.toLowerCase());
    if (duplicate) { setError("Este livro já está na sua biblioteca."); return; }
    const book: Book = { id: crypto.randomUUID(), title: picked.title, author: picked.author, coverUrl: picked.coverUrl, pages: picked.pages, currentPage: 0, status: "want", rating: 0, favorite: false, description: "", published: picked.published, publisher: picked.publisher, language: picked.language, isbn: picked.isbn, categories: picked.categories, tags: [], accent: "#7fd6ca", sessions: [] };
    fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...book, metadata: { published: book.published, publisher: book.publisher, language: book.language, isbn: book.isbn, categories: book.categories } }) }).catch(() => undefined);
    onAdd(book);
  };
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-title"><div className="dialog-head"><div><span className="eyebrow">Cadastro inteligente</span><h2 id="add-title">Adicionar livro</h2><p>Informe somente o essencial. Buscamos o restante.</p></div><button onClick={onClose} aria-label="Fechar">×</button></div><div className="form-row"><label><span>Título do livro</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Ex.: Ensaio sobre a cegueira" /></label><label><span>Autor</span><input value={author} onChange={(event) => setAuthor(event.target.value)} onKeyDown={(event) => event.key === "Enter" && search()} placeholder="Ex.: José Saramago" /></label></div><button className="primary-button search-metadata" onClick={search} disabled={loading}>{loading ? "Buscando metadados…" : "⌕ Buscar automaticamente"}</button>{error && <p className="form-error">{error}</p>}{results.length > 0 && <div className="search-results">{results.map((result) => <button key={result.sourceId} onClick={() => add(result)}><div className="result-cover">{result.coverUrl ? <img src={result.coverUrl} alt="" /> : <span>{result.title.slice(0, 1)}</span>}</div><span><b>{result.title}</b><small>{result.author} · {result.published || "Ano desconhecido"}</small><i>{result.pages ? `${result.pages} páginas` : "Páginas não informadas"}</i></span><strong>＋</strong></button>)}</div>}<div className="manual-add"><span>Não encontrou?</span><button onClick={() => add()}>Adicionar com estes dados</button></div><footer>Metadados fornecidos pela Open Library. Suas edições manuais nunca serão sobrescritas.</footer></section></div>;
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
    const session = { date: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`)).replace(".", ""), start, end };
    const updated = { ...book, currentPage: Math.max(book.currentPage, end), status: end >= book.pages && book.pages > 0 ? "read" as Status : "reading" as Status, sessions: [...book.sessions, session] };
    fetch(`/api/library/${book.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPage: updated.currentPage, status: updated.status, session: { startPage: start, endPage: end, readAt: date } }) }).catch(() => undefined);
    onSave(updated);
  };
  return <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog reading-dialog" role="dialog" aria-modal="true"><div className="dialog-head"><div><span className="eyebrow">Sessão de leitura</span><h2>Registrar progresso</h2><p>{book.title}</p></div><button onClick={onClose} aria-label="Fechar">×</button></div><div className="reading-book-row"><Cover book={book} size="small" /><div><b>{progress(book)}% concluído</b><ProgressBar value={progress(book)} /><span>Você parou na página {book.currentPage}</span></div></div><div className="page-range"><label><span>Página inicial</span><input type="number" min="1" max={book.pages} value={start} onChange={(event) => setStart(Number(event.target.value))} /></label><i>→</i><label><span>Página final</span><input type="number" min="1" max={book.pages} value={end} onChange={(event) => setEnd(Number(event.target.value))} /></label></div><label className="date-field"><span>Data da leitura</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><div className="session-summary"><span>Páginas nesta sessão</span><b>{Math.max(0, end - start + 1)}</b></div>{error && <p className="form-error">{error}</p>}<button className="primary-button dialog-submit" onClick={submit}>Registrar leitura</button><footer>Salvo automaticamente e disponível offline.</footer></section></div>;
}

function Preferences({ theme, setTheme, style, setStyle, accent, setAccent, onClose }: { theme: Theme; setTheme: (theme: Theme) => void; style: VisualStyle; setStyle: (style: VisualStyle) => void; accent: string; setAccent: (accent: string) => void; onClose: () => void }) {
  return <div className="dialog-backdrop preference-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="preferences" role="dialog" aria-modal="true" aria-labelledby="prefs-title"><div className="dialog-head"><div><span className="eyebrow">Aparência</span><h2 id="prefs-title">Sua interface</h2><p>As mudanças são aplicadas imediatamente.</p></div><button onClick={onClose} aria-label="Fechar">×</button></div><div className="preference-group"><h3>Tema</h3><div className="segmented"><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>☼ Claro</button><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>◐ Escuro</button></div></div><div className="preference-group"><h3>Estilo visual</h3><div className="style-options"><button className={style === "minimal" ? "active" : ""} onClick={() => setStyle("minimal")}><span className="style-preview minimal-preview"><i /><i /><i /></span><b>Minimalista</b><small>Conteúdo e espaço</small></button><button className={style === "brutal" ? "active" : ""} onClick={() => setStyle("brutal")}><span className="style-preview brutal-preview"><i /><i /><i /></span><b>Neobrutalismo</b><small>Traços e contraste</small></button><button className={style === "glass" ? "active" : ""} onClick={() => setStyle("glass")}><span className="style-preview glass-preview"><i /><i /><i /></span><b>Glass</b><small>Vidro e profundidade</small></button></div></div><div className="preference-group"><h3>Cor principal</h3><div className="accent-options">{accentOptions.map((color) => <button key={color} className={accent === color ? "active" : ""} style={{ background: color }} onClick={() => setAccent(color)} aria-label={`Usar cor ${color}`}>{accent === color ? "✓" : ""}</button>)}</div></div><div className="preference-note"><span>AA</span><p><b>Legibilidade preservada</b>Contraste e hierarquia permanecem consistentes em todas as combinações.</p></div></section></div>;
}
