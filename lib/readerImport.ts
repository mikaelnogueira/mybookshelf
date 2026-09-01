import JSZip from "jszip";
import mammoth from "mammoth";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import type { ReaderDocument, ReaderImportMode } from "./readerTypes";
import { defaultReaderSettings } from "./readerTypes";

export const supportedReaderFormats = ["PDF", "EPUB", "TXT", "DOCX", "DOC", "RTF", "HTML", "MD"];

type ImportedContent = { title: string; author: string; isbn: string; text: string; paragraphs: string[]; pages: string[]; images: string[]; pdfFile?: Blob };

function extractIsbn(value: string) {
  const candidates = value.match(/(?:97[89][\s-]?)?(?:\d[\s-]?){9}[\dXx]/g) ?? [];
  return candidates.map((candidate) => candidate.replace(/[^\dX]/gi, "")).find((candidate) => candidate.length === 10 || candidate.length === 13) ?? "";
}

export function structurePlainText(source: string) {
  const presentation = source.replace(/\r\n?/g, "\n");
  const blocks = presentation.split(/\n[\t ]*\n+/);
  const paragraphs: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    let current: string[] = [];
    const flush = () => { if (current.length) paragraphs.push(current.join(" ")); current = []; };
    for (const line of lines) {
      const heading = line.length <= 72 && (/^(cap[ií]tulo|chapter|parte|livro|pr[oó]logo|ep[ií]logo)\b/i.test(line) || (line.length > 3 && line === line.toLocaleUpperCase("pt-BR")));
      const isolated = heading || /^([•*#]|[-–—]\s|\d+[.)]\s)/.test(line);
      if (isolated) { flush(); paragraphs.push(line); } else current.push(line);
    }
    flush();
  }
  return paragraphs.length ? paragraphs : [presentation];
}

function stripMarkup(value: string) {
  const document = new DOMParser().parseFromString(value, "text/html");
  return (document.body.textContent ?? "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function pageText(text: string, wordsPerPage = 330) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const pages: string[] = [];
  for (let index = 0; index < words.length; index += wordsPerPage) pages.push(words.slice(index, index + wordsPerPage).join(" "));
  return pages;
}

function pdfTextWithLayout(items: unknown[]) {
  const fragments = items.flatMap((item) => {
    if (!item || typeof item !== "object" || !("str" in item)) return [];
    const value = item as { str?: string; transform?: number[]; width?: number; hasEOL?: boolean };
    const text = value.str?.trim(); if (!text) return [];
    return [{ text, x: value.transform?.[4] ?? 0, y: value.transform?.[5] ?? 0, height: Math.abs(value.transform?.[3] ?? 10), hasEOL: Boolean(value.hasEOL) }];
  });
  fragments.sort((left, right) => Math.abs(right.y - left.y) > Math.max(2, Math.min(left.height, right.height) * .35) ? right.y - left.y : left.x - right.x);
  const lines: Array<{ y: number; height: number; parts: typeof fragments }> = [];
  for (const fragment of fragments) {
    const tolerance = Math.max(2, fragment.height * .42);
    const line = lines.at(-1);
    if (line && Math.abs(line.y - fragment.y) <= Math.max(tolerance, line.height * .42)) line.parts.push(fragment);
    else lines.push({ y: fragment.y, height: fragment.height, parts: [fragment] });
  }
  return lines.map((line, index) => {
    const text = line.parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(" ").replace(/\s+([,.;:!?])/g, "$1").trim();
    const next = lines[index + 1];
    const paragraphBreak = next && Math.abs(line.y - next.y) > Math.max(line.height, next.height) * 1.7;
    return `${text}${paragraphBreak ? "\n" : ""}`;
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function allowBrowserPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export function removeRepeatedPageArtifacts(pages: string[]) {
  if (pages.length < 3) return pages;
  const occurrences = new Map<string, number>();
  const normalize = (line: string) => line.toLocaleLowerCase("pt-BR").replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
  pages.forEach((page) => new Set(page.split("\n").map(normalize).filter(Boolean)).forEach((line) => occurrences.set(line, (occurrences.get(line) ?? 0) + 1)));
  const threshold = Math.max(3, Math.ceil(pages.length * .55));
  return pages.map((page) => page.split("\n").filter((line) => {
    const key = normalize(line);
    return !key || key.length > 110 || (occurrences.get(key) ?? 0) < threshold;
  }).join("\n").trim());
}

function fileTitle(file: File) {
  return file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Livro importado";
}

function fileIdentity(file: File) {
  const base = file.name.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
  const parts = base.split(/\s+[–—-]\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { author: parts[0], title: parts.slice(1).join(" — ") };
  return { author: "Autor não informado", title: fileTitle(file) };
}

function xmlText(document: Document, selectors: string[]) {
  for (const selector of selectors) {
    const value = document.querySelector(selector)?.textContent?.trim();
    if (value) return value;
  }
  return "";
}

async function importPdf(file: File, onProgress: (message: string) => void): Promise<ImportedContent> {
  onProgress("Abrindo PDF…");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const url = URL.createObjectURL(file);
  const loadingTask = pdfjs.getDocument({ url });
  const pages: string[] = []; const images: string[] = [];
  try {
    const pdf = await loadingTask.promise;
    const metadata = await pdf.getMetadata().catch(() => undefined);
    const info = (metadata?.info ?? {}) as Record<string, unknown>;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress(`Processando página ${pageNumber} de ${pdf.numPages}…`);
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        pages.push(pdfTextWithLayout(content.items));
      } finally {
        page.cleanup();
      }
      if (pageNumber % 3 === 0) await allowBrowserPaint();
    }
    onProgress("Organizando o texto extraído…");
    const cleanedPages = removeRepeatedPageArtifacts(pages);
    const text = cleanedPages.filter(Boolean).join("\n\n");
    return { title: String(info.Title ?? ""), author: String(info.Author ?? ""), isbn: extractIsbn(JSON.stringify(info)), text, paragraphs: text.split(/\n{2,}/).filter(Boolean), pages: cleanedPages, images };
  } finally {
    await loadingTask.destroy().catch(() => undefined);
    URL.revokeObjectURL(url);
  }
}

async function importPdfAsImages(file: File, onProgress: (message: string) => void): Promise<ImportedContent> {
  onProgress("Preparando visualização do PDF…");
  const pdfFile = file.slice(0, file.size, file.type || "application/pdf");
  const buffer = await file.arrayBuffer();
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), disableAutoFetch: true, disableStream: true });
  let pdf: Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]> | undefined;
  try {
    pdf = await loadingTask.promise;
    const metadata = await pdf.getMetadata().catch(() => undefined);
    const info = (metadata?.info ?? {}) as Record<string, unknown>;
    return { title: String(info.Title ?? ""), author: String(info.Author ?? ""), isbn: extractIsbn(JSON.stringify(info)), text: "", paragraphs: [], pages: Array.from({ length: pdf.numPages }, () => ""), images: [], pdfFile };
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

async function importEpub(buffer: ArrayBuffer): Promise<ImportedContent> {
  const zip = await JSZip.loadAsync(buffer);
  const container = await zip.file("META-INF/container.xml")?.async("string");
  const containerXml = new DOMParser().parseFromString(container ?? "", "application/xml");
  const rootPath = containerXml.querySelector("rootfile")?.getAttribute("full-path") ?? "content.opf";
  const opfText = await zip.file(rootPath)?.async("string");
  if (!opfText) throw new Error("EPUB inválido: manifesto não encontrado.");
  const opf = new DOMParser().parseFromString(opfText, "application/xml");
  const title = xmlText(opf, ["metadata > title", "dc\\:title", "title"]);
  const author = xmlText(opf, ["metadata > creator", "dc\\:creator", "creator"]);
  const isbn = extractIsbn(Array.from(opf.querySelectorAll("identifier, dc\\:identifier")).map((item) => item.textContent ?? "").join(" "));
  const base = rootPath.includes("/") ? rootPath.slice(0, rootPath.lastIndexOf("/") + 1) : "";
  const manifest = new Map(Array.from(opf.querySelectorAll("manifest item")).map((item) => [item.getAttribute("id") ?? "", item.getAttribute("href") ?? ""]));
  const spine = Array.from(opf.querySelectorAll("spine itemref")).map((item) => item.getAttribute("idref") ?? "");
  const pages: string[] = [];
  for (const id of spine) {
    const href = manifest.get(id); if (!href) continue;
    const entry = zip.file(decodeURIComponent(`${base}${href.split("#")[0]}`)); if (!entry) continue;
    const text = stripMarkup(await entry.async("string")); if (text) pages.push(text);
  }
  const text = pages.join("\n\n");
  return { title, author, isbn, text, paragraphs: pages, pages, images: [] };
}

async function importDocx(buffer: ArrayBuffer) {
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  const zip = await JSZip.loadAsync(buffer);
  const core = await zip.file("docProps/core.xml")?.async("string");
  const metadata = new DOMParser().parseFromString(core ?? "", "application/xml");
  const text = result.value.trim();
  return { title: xmlText(metadata, ["title", "dc\\:title"]), author: xmlText(metadata, ["creator", "dc\\:creator"]), isbn: extractIsbn(metadata.documentElement.textContent ?? ""), text, paragraphs: text.split(/\n{2,}/).filter(Boolean), pages: pageText(text), images: [] };
}

function importLegacyDocument(buffer: ArrayBuffer, extension: string) {
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  let text = decoded;
  if (extension === "txt" || extension === "md") return { title: "", author: "", isbn: extractIsbn(fileHeader(decoded)), text: decoded, paragraphs: structurePlainText(decoded), pages: pageText(decoded), images: [] };
  if (extension === "html" || extension === "htm") text = stripMarkup(text);
  else if (extension === "rtf") text = text.replace(/\\'[0-9a-f]{2}/gi, " ").replace(/\\[a-z]+-?\d* ?/gi, " ").replace(/[{}]/g, " ");
  else if (extension === "doc") text = Array.from(new Uint8Array(buffer)).map((value) => value >= 32 && value < 127 ? String.fromCharCode(value) : " ").join("");
  text = text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { title: "", author: "", isbn: extractIsbn(fileHeader(text)), text, paragraphs: text.split(/\n{2,}/).filter(Boolean), pages: pageText(text), images: [] };
}

function fileHeader(text: string) {
  return text.slice(0, 4000);
}

export async function extractReaderDocument(file: File, bookId: string, mode: ReaderImportMode, onProgress: (message: string) => void): Promise<ReaderDocument> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const supported = ["pdf", "epub", "txt", "docx", "doc", "rtf", "html", "htm", "md"];
  if (!supported.includes(extension)) throw new Error(`Formato .${extension || "desconhecido"} não suportado.`);
  const sizeLimit = extension === "pdf" ? 480 : 120;
  if (file.size > sizeLimit * 1024 * 1024) throw new Error(`O arquivo excede o limite local de ${sizeLimit} MB.`);
  let content: ImportedContent;
  if (mode === "image" && extension !== "pdf") throw new Error("A visualização por imagem está disponível apenas para arquivos PDF.");
  if (extension === "pdf" && mode === "image") content = await importPdfAsImages(file, onProgress);
  else {
    if (extension === "pdf") {
      content = await importPdf(file, onProgress);
      if (mode === "complete" && !content.text.trim()) content = await importPdfAsImages(file, onProgress);
    }
    else {
    const buffer = await file.arrayBuffer();
    if (extension === "epub") content = await importEpub(buffer);
    else if (extension === "docx") content = await importDocx(buffer);
    else content = importLegacyDocument(buffer, extension);
    }
  }
  if (!content.text.trim() && extension === "pdf" && mode === "text") throw new Error("Este PDF não possui texto selecionável. Tente a importação por imagem ou Completa.");
  if (!content.text.trim() && !content.images.length && !content.pdfFile) throw new Error("Não foi possível extrair conteúdo legível deste arquivo.");
  if (!content.pages.length && content.text) content.pages = pageText(content.text);
  const identity = fileIdentity(file);
  return {
    version: 1, bookId, fileName: file.name, format: extension.toUpperCase(), storageMode: content.pdfFile ? "image" : "text",
    title: content.title || identity.title, author: content.author || identity.author, isbn: content.isbn, text: content.text, paragraphs: content.paragraphs,
    pages: content.pages, images: content.images, pdfFile: content.pdfFile, importedAt: new Date().toISOString(),
    currentWord: 0, currentPage: 0, settings: { ...defaultReaderSettings, layout: content.pdfFile ? "pages" : defaultReaderSettings.layout },
  };
}
