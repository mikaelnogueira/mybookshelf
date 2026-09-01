import { Capacitor, registerPlugin } from "@capacitor/core";

type NotificationQuote = { text: string; author: string; book: string };
type ReadingNotificationsPlugin = {
  requestPermissions(): Promise<{ notifications: string }>;
  initialize(): Promise<void>;
  updateQuotes(options: { quotes: NotificationQuote[] }): Promise<void>;
};

const ReadingNotifications = registerPlugin<ReadingNotificationsPlugin>("ReadingNotifications");

function quoteCandidates(extract: string) {
  return extract.split(/\n+/).map((line) => line.replace(/^[*#:;\s–—-]+/, "").replace(/\[[^\]]+]/g, "").trim())
    .filter((line) => line.length >= 35 && line.length <= 220 && !/^(ver também|ligações externas|referências|bibliografia)/i.test(line));
}

async function quotesForBook(book: { title: string; author: string }) {
  try {
    const query = new URLSearchParams({ action: "query", prop: "extracts", explaintext: "1", redirects: "1", format: "json", origin: "*", titles: book.title });
    const response = await fetch(`https://pt.wikiquote.org/w/api.php?${query}`);
    if (!response.ok) return [];
    const data = await response.json() as { query?: { pages?: Record<string, { extract?: string }> } };
    const extract = Object.values(data.query?.pages ?? {})[0]?.extract ?? "";
    return quoteCandidates(extract).slice(0, 4).map((text) => ({ text, author: book.author, book: book.title }));
  } catch { return []; }
}

export async function initializeReadingNotifications(books: Array<{ title: string; author: string }>) {
  if (!Capacitor.isNativePlatform()) return;
  await ReadingNotifications.requestPermissions().catch(() => undefined);
  await ReadingNotifications.initialize().catch(() => undefined);
  const researched = (await Promise.all(books.slice(0, 12).map(quotesForBook))).flat();
  const fallback = books.slice(0, 8).map((book) => ({ text: `Que tal retomar a leitura e reencontrar as ideias de ${book.title}?`, author: book.author, book: book.title }));
  await ReadingNotifications.updateQuotes({ quotes: researched.length ? researched : fallback }).catch(() => undefined);
}
