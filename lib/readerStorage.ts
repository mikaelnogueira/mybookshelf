import type { ReaderDocument } from "./readerTypes";

const DATABASE_NAME = "mybookshelf-mobile-v1";
const DATABASE_VERSION = 4;
type ReaderProgress = Pick<ReaderDocument, "currentWord" | "currentPage" | "settings">;
const documentCache = new Map<string, ReaderDocument>();

function storageError(reason: unknown) {
  const name = reason instanceof DOMException ? reason.name : "";
  if (name === "QuotaExceededError") return new Error("Não há espaço local suficiente para salvar este livro. Libere armazenamento ou use a importação por Texto.");
  return reason instanceof Error ? reason : new Error("Não foi possível salvar o livro no armazenamento local.");
}

function estimatedDocumentBytes(document: ReaderDocument) {
  const textBytes = (document.text.length + document.pages.reduce((sum, page) => sum + page.length, 0) + (document.paragraphs ?? []).reduce((sum, paragraph) => sum + paragraph.length, 0)) * 2;
  return textBytes + (document.pdfFile?.size ?? 0) + 256 * 1024;
}

async function ensureDocumentCapacity(document: ReaderDocument) {
  await navigator.storage?.persist?.().catch(() => false);
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  if (!estimate?.quota) return;
  const available = Math.max(0, estimate.quota - (estimate.usage ?? 0));
  if (estimatedDocumentBytes(document) > available * .92) throw new Error("O dispositivo não possui espaço local suficiente para concluir esta importação.");
}

function openReaderDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = (event) => {
      const database = request.result;
      if (!database.objectStoreNames.contains("library")) database.createObjectStore("library");
      if (!database.objectStoreNames.contains("covers")) database.createObjectStore("covers");
      if (!database.objectStoreNames.contains("documents")) database.createObjectStore("documents");
      if (!database.objectStoreNames.contains("readerProgress")) database.createObjectStore("readerProgress");
      if (event.oldVersion < 3 && database.objectStoreNames.contains("documents")) {
        const store = request.transaction?.objectStore("documents");
        const cursorRequest = store?.openCursor();
        if (cursorRequest) cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          const value = cursor.value as ReaderDocument;
          if (value.originalFile) { const lightweight = { ...value }; delete lightweight.originalFile; cursor.update(lightweight); }
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("O armazenamento está ocupado por outra janela do aplicativo. Feche a outra janela e tente novamente."));
  });
}

export async function prepareReaderStorage() {
  await navigator.storage?.persist?.().catch(() => false);
  const database = await openReaderDatabase();
  database.close();
}

export async function saveReaderDocument(document: ReaderDocument) {
  await ensureDocumentCapacity(document);
  const database = await openReaderDatabase();
  const lightweight = { ...document };
  delete lightweight.originalFile;
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const fail = (reason: unknown) => { if (settled) return; settled = true; database.close(); reject(storageError(reason)); };
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(["documents", "readerProgress"], "readwrite");
      transaction.objectStore("documents").put(lightweight, document.bookId);
      transaction.objectStore("readerProgress").put({ currentWord: document.currentWord, currentPage: document.currentPage, settings: document.settings }, document.bookId);
    } catch (reason) { fail(reason); return; }
    transaction.oncomplete = () => { settled = true; documentCache.set(document.bookId, lightweight as ReaderDocument); database.close(); resolve(); };
    transaction.onerror = () => fail(transaction.error);
    transaction.onabort = () => fail(transaction.error ?? new Error("O salvamento local foi interrompido."));
  });
}

export async function loadReaderDocument(bookId: string) {
  const cached = documentCache.get(bookId);
  if (cached) return cached;
  const database = await openReaderDatabase();
  return new Promise<ReaderDocument | undefined>((resolve, reject) => {
    const transaction = database.transaction(["documents", "readerProgress"], "readonly");
    const documentRequest = transaction.objectStore("documents").get(bookId);
    const progressRequest = transaction.objectStore("readerProgress").get(bookId);
    transaction.oncomplete = () => {
      const stored = documentRequest.result as ReaderDocument | undefined;
      const progress = progressRequest.result as ReaderProgress | undefined;
      const value = stored ? { ...stored, ...(progress ?? {}) } : undefined;
      if (value) documentCache.set(bookId, value);
      database.close(); resolve(value);
    };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(storageError(transaction.error)); };
  });
}

export async function saveReaderProgress(bookId: string, progress: ReaderProgress) {
  const cached = documentCache.get(bookId);
  if (cached) documentCache.set(bookId, { ...cached, ...progress });
  const database = await openReaderDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("readerProgress", "readwrite");
    transaction.objectStore("readerProgress").put(progress, bookId);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(storageError(transaction.error)); };
  });
}

export async function deleteReaderDocument(bookId: string) {
  documentCache.delete(bookId);
  const database = await openReaderDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(["documents", "readerProgress"], "readwrite");
    transaction.objectStore("documents").delete(bookId);
    transaction.objectStore("readerProgress").delete(bookId);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(storageError(transaction.error)); };
  });
}
