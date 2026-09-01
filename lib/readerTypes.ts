export type ReaderStorageMode = "text" | "image";
export type ReaderImportMode = "text" | "image" | "complete";
export type ReaderLayout = "scroll" | "pages";

export type ReaderSettings = {
  fontSize: number;
  fontWeight: 400 | 600 | 700;
  fontFamily: string;
  fontOverride: boolean;
  layout: ReaderLayout;
  rsvpMode: "single" | "context";
  wpm: number;
  traditionalWpm: number;
  guidedMode: boolean;
};

export type ReaderDocument = {
  version: 1;
  bookId: string;
  fileName: string;
  format: string;
  storageMode: ReaderStorageMode;
  title: string;
  author: string;
  isbn?: string;
  text: string;
  paragraphs?: string[];
  pages: string[];
  images: string[];
  pdfFile?: Blob;
  originalFile?: Blob;
  importedAt: string;
  currentWord: number;
  currentPage: number;
  settings: ReaderSettings;
};

export type ReaderFileSummary = Pick<ReaderDocument, "fileName" | "format" | "storageMode"> & {
  pageCount: number;
};

export type ReadingSessionResult = {
  minutes: number;
  pagesRead: number;
  currentPage: number;
  wordsRead: number;
  averageWpm?: number;
  source: "traditional" | "rsvp";
};

export const defaultReaderSettings: ReaderSettings = {
  fontSize: 20,
  fontWeight: 400,
  fontFamily: "Georgia, serif",
  fontOverride: false,
  layout: "scroll",
  rsvpMode: "single",
  wpm: 300,
  traditionalWpm: 220,
  guidedMode: false,
};

export function traditionalScrollPixelsPerSecond(wpm: number, fontSize: number) {
  const safeWpm = Math.min(800, Math.max(80, Number(wpm) || defaultReaderSettings.traditionalWpm));
  const safeFontSize = Math.min(34, Math.max(14, Number(fontSize) || defaultReaderSettings.fontSize));
  return safeWpm * safeFontSize / 300;
}

export function normalizeReaderSettings(settings?: Partial<ReaderSettings> | null): ReaderSettings {
  const migratedFamily = settings?.fontFamily === '"Courier New", monospace' ? '"Courier New", Courier, monospace' : settings?.fontFamily;
  const allowedFamilies = [
    "Georgia, serif",
    "Arial, Helvetica, sans-serif",
    "\"Courier New\", Courier, monospace",
  ];
  return {
    fontSize: Math.min(34, Math.max(14, Number(settings?.fontSize) || defaultReaderSettings.fontSize)),
    fontWeight: settings?.fontWeight === 600 || settings?.fontWeight === 700 ? settings.fontWeight : 400,
    fontFamily: allowedFamilies.includes(migratedFamily ?? "") ? migratedFamily! : defaultReaderSettings.fontFamily,
    fontOverride: Boolean(settings?.fontOverride),
    layout: settings?.layout === "pages" ? "pages" : "scroll",
    rsvpMode: settings?.rsvpMode === "context" ? "context" : "single",
    wpm: Math.min(1000, Math.max(100, Number(settings?.wpm) || defaultReaderSettings.wpm)),
    traditionalWpm: Math.min(800, Math.max(80, Number(settings?.traditionalWpm) || defaultReaderSettings.traditionalWpm)),
    guidedMode: Boolean(settings?.guidedMode),
  };
}
