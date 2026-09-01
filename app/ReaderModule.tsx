"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { saveReaderProgress } from "../lib/readerStorage";
import type { ReaderDocument, ReaderSettings, ReadingSessionResult } from "../lib/readerTypes";
import { normalizeReaderSettings, traditionalScrollPixelsPerSecond } from "../lib/readerTypes";
import { structurePlainText } from "../lib/readerImport";

type ReaderBook = { id: string; title: string; author: string };
const textWords = (value: string) => value.split(/\s+/).filter(Boolean);

function wordParts(word: string) {
  const letters = Array.from(word).map((char, index) => ({ char, index })).filter(({ char }) => /[\p{L}\p{N}]/u.test(char));
  const pivot = letters[Math.floor((letters.length - 1) / 2)]?.index ?? 0;
  return { before: word.slice(0, pivot), focus: word[pivot] ?? "", after: word.slice(pivot + 1) };
}

function RsvpWord({ word, next }: { word: string; next?: string }) {
  const parts = wordParts(word);
  return <div className="rsvp-word"><span className="rsvp-token"><i>{parts.before}</i><b>{parts.focus}</b><i>{parts.after}</i></span>{next && <small>{next}</small>}</div>;
}

function indexedTextParts(text: string, startIndex: number) {
  const parts = text.split(/(\s+)/);
  let wordIndex = startIndex;
  return parts.map((part) => ({ part, wordIndex: !part || /^\s+$/.test(part) ? undefined : wordIndex++ }));
}

const WordText = memo(function WordText({ text, startIndex, currentWord, guided, onChoose }: { text: string; startIndex: number; currentWord: number; guided: boolean; onChoose: (index: number) => void }) {
  if (!guided) return <>{text}</>;
  return <>{indexedTextParts(text, startIndex).map(({ part, wordIndex }, index) => wordIndex === undefined ? <span key={index}>{part}</span> : <span key={index} data-reader-word={wordIndex} className={guided && wordIndex === currentWord ? "guided-word-active" : ""} onClick={() => onChoose(wordIndex)}>{part}</span>)}</>;
});

type VisualPdfDocument = {
  getPage: (pageNumber: number) => Promise<{
    getViewport: (options: { scale: number }) => { width: number; height: number };
    render: (options: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void>; cancel: () => void };
    cleanup?: () => void;
  }>;
  destroy: () => Promise<void>;
};

function PdfVisualPage({ pdf, pageNumber, lazy = false }: { pdf: VisualPdfDocument; pageNumber: number; lazy?: boolean }) {
  const host = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(!lazy);
  useEffect(() => {
    if (!lazy || !host.current || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "700px 0px" });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, [lazy]);
  useEffect(() => {
    const target = canvas.current;
    if (!target) return;
    if (!visible) { target.width = 1; target.height = 1; return; }
    let cancelled = false;
    let renderTask: { promise: Promise<void>; cancel: () => void } | undefined;
    pdf.getPage(pageNumber).then((page) => {
      if (cancelled || !canvas.current) return;
      const scale = Math.min(2, Math.max(1.15, window.devicePixelRatio || 1));
      const viewport = page.getViewport({ scale });
      const context = canvas.current.getContext("2d", { alpha: false });
      if (!context) return;
      canvas.current.width = Math.ceil(viewport.width); canvas.current.height = Math.ceil(viewport.height);
      renderTask = page.render({ canvas: canvas.current, canvasContext: context, viewport });
      return renderTask.promise.finally(() => page.cleanup?.());
    }).catch(() => undefined);
    return () => { cancelled = true; renderTask?.cancel(); };
  }, [pageNumber, pdf, visible]);
  return <div ref={host} className="reader-pdf-page"><canvas ref={canvas} aria-label={`Página ${pageNumber} do PDF`} /></div>;
}

function prepareDocument(value: ReaderDocument) {
  const starts = startsForPages(value.pages);
  const firstReadablePage = value.pages.findIndex((page) => page.trim().length > 0);
  const currentPage = value.currentPage === 0 && firstReadablePage > 0 ? firstReadablePage : value.currentPage;
  const currentWord = value.currentWord === 0 && currentPage > 0 ? starts[currentPage] ?? 0 : value.currentWord;
  return { ...value, currentPage, currentWord, paragraphs: value.paragraphs ?? (value.format === "TXT" ? structurePlainText(value.text) : value.text.split(/\n{2,}/).filter(Boolean)), settings: normalizeReaderSettings(value.settings) };
}

function startsForPages(pages: string[]) {
  let cursor = 0;
  return pages.map((page) => { const start = cursor; cursor += textWords(page).length; return start; });
}

function pageForWord(word: number, starts: number[]) {
  let page = 0;
  for (let index = 0; index < starts.length; index += 1) { if (starts[index] <= word) page = index; else break; }
  return page;
}

export function ReaderModule({ book, initialDocument, theme, appFont, onClose, onSession }: { book: ReaderBook; initialDocument: ReaderDocument; theme: "light" | "dark"; appFont: "original" | "serif" | "arial" | "courier"; onClose: () => void; onSession: (result: ReadingSessionResult) => void }) {
  const preparedInitial = useMemo(() => prepareDocument(initialDocument), [initialDocument]);
  const [document, setDocument] = useState<ReaderDocument>(preparedInitial);
  const [mode, setMode] = useState<"traditional" | "rsvp">("traditional");
  const [traditionalPlaying, setTraditionalPlaying] = useState(false);
  const [rsvpPlaying, setRsvpPlaying] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [visualPdf, setVisualPdf] = useState<VisualPdfDocument | null>(null);
  const startedAt = useRef(0);
  const initialPage = useRef(preparedInitial.currentPage);
  const initialWord = useRef(preparedInitial.currentWord);
  const holdIntervalRef = useRef<number | null>(null);
  const pagePointerStart = useRef<{ x: number; y: number } | null>(null);
  const readerContentRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncFrame = useRef<number | null>(null);
  const guidedScrollFrame = useRef<number | null>(null);
  const guidedScrollTimer = useRef<number | null>(null);
  const programmaticScroll = useRef(false);
  const manualScrollUntil = useRef(0);
  const finishing = useRef(false);
  const onCloseRef = useRef(onClose);
  const onSessionRef = useRef(onSession);
  const latestDocument = useRef<ReaderDocument>(preparedInitial);
  const latestMode = useRef<"traditional" | "rsvp">("traditional");
  const lastSavedProgress = useRef("");

  const persistProgress = useCallback(async (current: ReaderDocument) => {
    const progress = { currentWord: current.currentWord, currentPage: current.currentPage, settings: current.settings };
    const signature = JSON.stringify(progress);
    if (signature === lastSavedProgress.current) return;
    await saveReaderProgress(current.bookId, progress);
    lastSavedProgress.current = signature;
  }, []);

  const finish = useCallback(() => {
    if (finishing.current) return;
    finishing.current = true;
    const current = latestDocument.current;
    setTraditionalPlaying(false); setRsvpPlaying(false);
    if (holdIntervalRef.current !== null) window.clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = null;
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60_000));
    const wordsRead = Math.max(0, current.currentWord - initialWord.current);
    const result = { minutes: elapsedMinutes, pagesRead: Math.max(0, current.currentPage - initialPage.current), currentPage: current.currentPage, wordsRead, averageWpm: latestMode.current === "rsvp" && wordsRead ? Math.round(wordsRead / elapsedMinutes) : undefined, source: latestMode.current } as ReadingSessionResult;
    onCloseRef.current();
    onSessionRef.current(result);
    persistProgress(current).catch(() => undefined);
  }, [persistProgress]);

  useEffect(() => { startedAt.current = Date.now(); }, []);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onSessionRef.current = onSession; }, [onSession]);

  useEffect(() => {
    if (document.storageMode !== "image" || !document.pdfFile) return;
    let cancelled = false;
    let pdf: VisualPdfDocument | undefined;
    Promise.all([document.pdfFile.arrayBuffer(), import("pdfjs-dist/legacy/build/pdf.mjs")]).then(async ([buffer, pdfjs]) => {
      if (cancelled) return;
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      const loaded = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableAutoFetch: true, disableStream: true }).promise;
      pdf = loaded as unknown as VisualPdfDocument;
      if (!cancelled) setVisualPdf(pdf);
      else if (typeof pdf.destroy === "function") await pdf.destroy().catch(() => undefined);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      if (pdf && typeof pdf.destroy === "function") pdf.destroy().catch(() => undefined);
    };
  }, [document.pdfFile, document.storageMode]);

  useEffect(() => { latestDocument.current = document; }, [document]);
  useEffect(() => { latestMode.current = mode; }, [mode]);
  useEffect(() => {
    const timer = window.setInterval(() => { persistProgress(latestDocument.current).catch(() => undefined); }, 1800);
    return () => { window.clearInterval(timer); persistProgress(latestDocument.current).catch(() => undefined); };
  }, [persistProgress]);
  useEffect(() => {
    const requestFinish = () => finish();
    window.addEventListener("mybookshelf-reader-finish", requestFinish);
    return () => window.removeEventListener("mybookshelf-reader-finish", requestFinish);
  }, [finish]);
  useEffect(() => () => {
    if (scrollSyncFrame.current !== null) window.cancelAnimationFrame(scrollSyncFrame.current);
    if (guidedScrollFrame.current !== null) window.cancelAnimationFrame(guidedScrollFrame.current);
    if (guidedScrollTimer.current !== null) window.clearTimeout(guidedScrollTimer.current);
  }, []);

  const words = useMemo(() => textWords(document.text), [document.text]);
  const pageStarts = useMemo(() => startsForPages(document.pages), [document.pages]);
  const pageCount = document.storageMode === "image" ? document.images.length || document.pages.length : document.pages.length;
  const page = Math.min(Math.max(0, document.currentPage), Math.max(0, pageCount - 1));
  const paragraphs = useMemo(() => document.paragraphs ?? document.text.split(/\n{2,}/).filter(Boolean), [document.paragraphs, document.text]);
  const paragraphData = useMemo(() => {
    const starts = startsForPages(paragraphs);
    return paragraphs.map((text, index) => ({ text, start: starts[index], end: starts[index] + textWords(text).length }));
  }, [paragraphs]);
  useEffect(() => {
    if (mode !== "traditional" || document.storageMode !== "text" || document.settings.layout !== "pages" || !document.settings.guidedMode) return;
    const guidedPage = Math.min(Math.max(0, pageForWord(document.currentWord, pageStarts)), Math.max(0, pageCount - 1));
    if (guidedPage === document.currentPage) return;
    const frame = window.requestAnimationFrame(() => setDocument((current) => current.currentPage === guidedPage ? current : { ...current, currentPage: guidedPage }));
    return () => window.cancelAnimationFrame(frame);
  }, [document.currentPage, document.currentWord, document.settings.guidedMode, document.settings.layout, document.storageMode, mode, pageCount, pageStarts]);
  const syncScrollPosition = useCallback((node: HTMLDivElement) => {
    const rect = node.getBoundingClientRect();
    const sampleY = rect.top + Math.min(rect.height * .42, 300);
    const visibleBlock = globalThis.document.elementsFromPoint(rect.left + rect.width / 2, sampleY).find((element) => element instanceof HTMLElement && element.dataset.readerStart) as HTMLElement | undefined;
    const blockStart = Number(visibleBlock?.dataset.readerStart);
    const blockEnd = Number(visibleBlock?.dataset.readerEnd);
    const ratio = node.scrollTop / Math.max(1, node.scrollHeight - node.clientHeight);
    const blockRect = visibleBlock?.getBoundingClientRect();
    const blockRatio = blockRect ? Math.max(0, Math.min(1, (sampleY - blockRect.top) / Math.max(1, blockRect.height))) : 0;
    const nextWord = Number.isFinite(blockStart) && Number.isFinite(blockEnd) ? Math.round(blockStart + (blockEnd - blockStart) * blockRatio) : Math.round(ratio * Math.max(0, words.length - 1));
    setDocument((current) => {
      const nextPage = pageForWord(nextWord, pageStarts);
      return current.currentWord === nextWord && current.currentPage === nextPage ? current : { ...current, currentPage: nextPage, currentWord: nextWord };
    });
  }, [pageStarts, words.length]);

  const syncVisiblePosition = useCallback((node: HTMLDivElement) => {
    if (document.storageMode === "image") {
      const ratio = node.scrollTop / Math.max(1, node.scrollHeight - node.clientHeight);
      const nextPage = Math.round(ratio * Math.max(0, pageCount - 1));
      setDocument((current) => current.currentPage === nextPage ? current : { ...current, currentPage: nextPage });
      return;
    }
    syncScrollPosition(node);
  }, [document.storageMode, pageCount, syncScrollPosition]);

  const markManualNavigation = () => {
    programmaticScroll.current = false;
    manualScrollUntil.current = performance.now() + 1600;
    if (guidedScrollTimer.current !== null) window.clearTimeout(guidedScrollTimer.current);
    guidedScrollTimer.current = null;
  };

  const updateSettings = (patch: Partial<ReaderSettings>) => setDocument((current) => current ? { ...current, settings: normalizeReaderSettings({ ...current.settings, ...patch }) } : current);
  const chooseWord = useCallback((word: number) => setDocument((current) => ({ ...current, currentWord: Math.max(0, Math.min(words.length - 1, word)), currentPage: pageForWord(word, pageStarts) })), [pageStarts, words.length]);
  const moveWord = useCallback((amount: number) => setDocument((current) => {
    if (!current) return current;
    const currentWord = Math.max(0, Math.min(Math.max(0, words.length - 1), current.currentWord + amount));
    return { ...current, currentWord, currentPage: pageForWord(currentWord, pageStarts) };
  }), [pageStarts, words.length]);
  const movePage = (amount: number) => setDocument((current) => {
    if (!current) return current;
    const total = current.storageMode === "image" ? current.images.length || current.pages.length : current.pages.length;
    const currentPage = Math.max(0, Math.min(Math.max(0, total - 1), current.currentPage + amount));
    return { ...current, currentPage, currentWord: current.storageMode === "text" ? pageStarts[currentPage] ?? current.currentWord : current.currentWord };
  });
  const stopHold = () => { if (holdIntervalRef.current !== null) window.clearInterval(holdIntervalRef.current); holdIntervalRef.current = null; };
  const startHold = (amount: number) => {
    moveWord(amount); stopHold();
    const repeatEvery = Math.max(60, Math.round(60_000 / (document?.settings.wpm ?? 300)));
    holdIntervalRef.current = window.setInterval(() => moveWord(amount), repeatEvery);
  };

  useEffect(() => {
    if (!traditionalPlaying || mode !== "traditional" || document.storageMode !== "text" || !words.length || (document.settings.layout === "scroll" && !document.settings.guidedMode)) return;
    const delay = Math.max(75, Math.round(60_000 / document.settings.traditionalWpm));
    const timer = window.setInterval(() => {
      if ((latestDocument.current?.currentWord ?? 0) >= words.length - 1) { setTraditionalPlaying(false); return; }
      moveWord(1);
    }, delay);
    return () => window.clearInterval(timer);
  }, [document.settings.guidedMode, document.settings.layout, document.settings.traditionalWpm, document.storageMode, mode, moveWord, traditionalPlaying, words.length]);

  useEffect(() => {
    if (!traditionalPlaying || mode !== "traditional" || document.settings.layout !== "scroll" || document.settings.guidedMode) return;
    const node = readerContentRef.current;
    if (!node) return;
    let animation = 0;
    let previous = performance.now();
    let lastSync = previous;
    let intendedScrollTop = node.scrollTop;
    const pixelsPerSecond = traditionalScrollPixelsPerSecond(document.settings.traditionalWpm, document.settings.fontSize);
    const advance = (now: number) => {
      const elapsed = Math.min(1000, Math.max(0, now - previous));
      previous = now;
      intendedScrollTop += pixelsPerSecond * elapsed / 1000;
      node.scrollTop = intendedScrollTop;
      if (Math.abs(node.scrollTop - intendedScrollTop) > 2) intendedScrollTop = node.scrollTop;
      if (now - lastSync > 240) { syncVisiblePosition(node); lastSync = now; }
      if (node.scrollTop >= node.scrollHeight - node.clientHeight - 1) { syncVisiblePosition(node); setTraditionalPlaying(false); return; }
      animation = window.requestAnimationFrame(advance);
    };
    animation = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(animation);
  }, [document.settings.fontSize, document.settings.guidedMode, document.settings.layout, document.settings.traditionalWpm, mode, syncVisiblePosition, traditionalPlaying]);

  useEffect(() => {
    if (!rsvpPlaying || mode !== "rsvp" || !words.length) return;
    const delay = Math.max(60, Math.round(60_000 / document.settings.wpm));
    const timer = window.setInterval(() => {
      if ((latestDocument.current?.currentWord ?? 0) >= words.length - 1) { setRsvpPlaying(false); return; }
      moveWord(1);
    }, delay);
    return () => window.clearInterval(timer);
  }, [document.settings.wpm, mode, moveWord, rsvpPlaying, words.length]);

  useEffect(() => {
    if (mode !== "traditional" || document.settings.layout !== "scroll" || !document.settings.guidedMode || document.storageMode !== "text") return;
    if (performance.now() < manualScrollUntil.current) return;
    if (guidedScrollFrame.current !== null) window.cancelAnimationFrame(guidedScrollFrame.current);
    guidedScrollFrame.current = window.requestAnimationFrame(() => {
      guidedScrollFrame.current = null;
      const node = readerContentRef.current;
      const activeWord = globalThis.document.querySelector(`[data-reader-word="${document.currentWord}"]`) as HTMLElement | null;
      if (!node || !activeWord) return;
      const viewport = node.getBoundingClientRect();
      const word = activeWord.getBoundingClientRect();
      const comfortableTop = viewport.top + viewport.height * .28;
      const comfortableBottom = viewport.top + viewport.height * .68;
      if (word.top >= comfortableTop && word.bottom <= comfortableBottom) return;
      programmaticScroll.current = true;
      const target = node.scrollTop + word.top - viewport.top - node.clientHeight * .46;
      node.scrollTo({ top: Math.max(0, target), behavior: traditionalPlaying ? "smooth" : "auto" });
      if (guidedScrollTimer.current !== null) window.clearTimeout(guidedScrollTimer.current);
      guidedScrollTimer.current = window.setTimeout(() => { programmaticScroll.current = false; guidedScrollTimer.current = null; }, traditionalPlaying ? 460 : 60);
    });
    return () => { if (guidedScrollFrame.current !== null) window.cancelAnimationFrame(guidedScrollFrame.current); };
  }, [document.currentWord, document.settings.guidedMode, document.settings.layout, document.storageMode, mode, traditionalPlaying]);

  useEffect(() => {
    if (mode !== "traditional" || document.settings.layout !== "scroll" || document.storageMode !== "text") return;
    const paragraphIndex = paragraphData.findIndex(({ start, end }) => document.currentWord >= start && document.currentWord < end);
    programmaticScroll.current = true;
    const frame = window.requestAnimationFrame(() => {
      globalThis.document.querySelector(`[data-reader-paragraph="${Math.max(0, paragraphIndex)}"]`)?.scrollIntoView({ block: "center", behavior: "auto" });
      if (guidedScrollTimer.current !== null) window.clearTimeout(guidedScrollTimer.current);
      guidedScrollTimer.current = window.setTimeout(() => { programmaticScroll.current = false; guidedScrollTimer.current = null; }, 80);
    });
    return () => window.cancelAnimationFrame(frame);
    // Restore the saved position only when entering the continuous reader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.settings.layout, document.storageMode, mode]);

  const canGuide = document.storageMode === "text" && words.length > 0;
  const canAutoScroll = document.settings.layout === "scroll" && pageCount > 0;
  const canAutomate = canGuide || canAutoScroll;
  const currentWord = words[Math.min(document.currentWord, Math.max(0, words.length - 1))] ?? "";
  const globalFontFamily = appFont === "serif" ? "Georgia, serif" : appFont === "arial" ? "Arial, Helvetica, sans-serif" : appFont === "courier" ? '"Courier New", Courier, monospace' : "var(--font-serif), Georgia, serif";
  const appFontFamily = document.settings.fontOverride ? document.settings.fontFamily : globalFontFamily;
  const switchMode = (next: "traditional" | "rsvp") => { setTraditionalPlaying(false); setRsvpPlaying(false); setMode(next); };
  const pauseAll = () => { setTraditionalPlaying(false); setRsvpPlaying(false); };
  const visualPage = (index: number, lazy = false) => document.pdfFile ? (visualPdf ? <PdfVisualPage key={index} pdf={visualPdf} pageNumber={index + 1} lazy={lazy} /> : <div key={index} className="reader-pdf-page" />) : <img key={index} src={document.images[index]} alt={`Página ${index + 1}`} />;
  const focusToggle = (extraClass = "") => <button className={`reader-focus-toggle ${extraClass}`.trim()} title={focusMode ? "Sair do modo foco" : "Ativar modo foco"} aria-label={focusMode ? "Sair do modo foco" : "Ativar modo foco"} aria-pressed={focusMode} onClick={() => setFocusMode((current) => !current)}>⛶</button>;

  return <section className={`reader-shell reader-mode-${mode}${focusMode ? " reader-focus" : ""}`} data-theme={theme}>
    <header className="reader-header"><button className="reader-back-button" onClick={finish} aria-label="Voltar"><span className="reader-back-icon" aria-hidden="true">←</span></button><div><b>{book.title}</b><small>{book.author}</small></div><div className="reader-mode-switch"><button className={mode === "traditional" ? "active" : ""} onClick={() => switchMode("traditional")}>Leitura</button><button className={mode === "rsvp" ? "active" : ""} disabled={!canGuide} onClick={() => switchMode("rsvp")}>RSVP</button></div></header>
    {focusMode && focusToggle("reader-focus-exit")}
    {mode === "traditional" ? <>
      <div ref={readerContentRef} className={`reader-content reader-layout-${document.settings.layout}`} data-reader-weight={document.settings.fontWeight} style={{ fontFamily: appFontFamily, fontSize: document.settings.fontSize, fontWeight: document.settings.fontWeight }} onPointerDownCapture={markManualNavigation} onWheelCapture={markManualNavigation} onScroll={(event) => {
        if (document.settings.layout !== "scroll") return;
        const node = event.currentTarget;
        if (programmaticScroll.current) return;
        if (scrollSyncFrame.current !== null) return;
        scrollSyncFrame.current = window.requestAnimationFrame(() => { scrollSyncFrame.current = null; syncVisiblePosition(node); });
      }}>
        {document.settings.layout === "scroll" ? (document.storageMode === "image" ? Array.from({ length: pageCount }, (_, index) => visualPage(index, true)) : <article className={document.format === "TXT" ? "structured-text" : undefined}>{paragraphData.map(({ text, start, end }, index) => { const activeGuide = document.settings.guidedMode && document.currentWord >= start && document.currentWord < end; return <p data-reader-paragraph={index} data-reader-start={start} data-reader-end={end} className={/^(cap[ií]tulo|chapter|parte|livro|pr[oó]logo|ep[ií]logo)\b/i.test(text) ? "text-heading" : undefined} key={index}><WordText text={text} startIndex={start} currentWord={activeGuide ? document.currentWord : -1} guided={activeGuide} onChoose={chooseWord} /></p>; })}</article>) :
          <div className="reader-page" role="group" aria-label={`Página ${page + 1} de ${Math.max(1, pageCount)}`} tabIndex={0} onKeyDown={(event) => { if (event.key === "ArrowLeft") movePage(-1); if (event.key === "ArrowRight") movePage(1); }} onPointerDown={(event) => { pagePointerStart.current = { x: event.clientX, y: event.clientY }; }} onPointerUp={(event) => {
            const start = pagePointerStart.current; pagePointerStart.current = null; if (!start) return; const deltaX = event.clientX - start.x; const deltaY = event.clientY - start.y;
            if (Math.abs(deltaX) > 44 && Math.abs(deltaX) > Math.abs(deltaY)) movePage(deltaX < 0 ? 1 : -1); else if (Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) movePage(event.clientX < event.currentTarget.getBoundingClientRect().left + event.currentTarget.clientWidth / 2 ? -1 : 1);
          }}>{document.storageMode === "image" ? visualPage(page) : <p><WordText text={document.pages[page] ?? ""} startIndex={pageStarts[page] ?? 0} currentWord={document.settings.guidedMode ? document.currentWord : -1} guided={document.settings.guidedMode} onChoose={chooseWord} /></p>}</div>}
      </div>
      <footer className="reader-toolbar reader-traditional-toolbar"><div className="reader-automation-stack"><div className="reader-icon-controls"><button title="Iniciar leitura automática" aria-label="Iniciar leitura automática" onClick={() => setTraditionalPlaying(true)} disabled={!canAutomate || traditionalPlaying}>▶</button><button title="Pausar" aria-label="Pausar leitura automática" onClick={pauseAll} disabled={!traditionalPlaying}>Ⅱ</button><button title="Parar" aria-label="Parar leitura automática" onClick={pauseAll} disabled={!traditionalPlaying}>■</button><button title="Leitura guiada" aria-label="Alternar leitura guiada" className={document.settings.guidedMode ? "active" : ""} onClick={() => { setTraditionalPlaying(false); updateSettings({ guidedMode: !document.settings.guidedMode }); }} disabled={!canGuide}>◎</button></div><WpmControl label="Velocidade da leitura" value={document.settings.traditionalWpm} min={80} max={800} step={10} onChange={(traditionalWpm) => updateSettings({ traditionalWpm })} /></div><div className="reader-navigation">{document.settings.layout === "pages" && <button title="Página anterior" aria-label="Página anterior" onClick={() => movePage(-1)} disabled={page <= 0}>←</button>}<button title={document.settings.layout === "scroll" ? "Usar páginas" : "Usar rolagem"} aria-label={document.settings.layout === "scroll" ? "Usar páginas" : "Usar rolagem"} onClick={() => { setTraditionalPlaying(false); updateSettings({ layout: document.settings.layout === "scroll" ? "pages" : "scroll" }); }}>{document.settings.layout === "scroll" ? "▤" : "↕"}</button><span>{page + 1} / {Math.max(1, pageCount)}</span><ReaderSettingsPanel settings={document.settings} update={updateSettings} />{document.settings.layout === "pages" && <button title="Próxima página" aria-label="Próxima página" onClick={() => movePage(1)} disabled={page >= pageCount - 1}>→</button>}{focusToggle()}</div></footer>
    </> : <><div className="rsvp-stage" onContextMenu={(event) => event.preventDefault()}><button className="rsvp-zone rsvp-zone-left" aria-label="Retroceder uma palavra" onPointerDown={() => startHold(-1)} onPointerUp={stopHold} onPointerCancel={stopHold} onPointerLeave={stopHold} /><div className="rsvp-focus" data-reader-weight={document.settings.fontWeight} style={{ fontFamily: appFontFamily, fontWeight: document.settings.fontWeight, "--rsvp-font-size": `${Math.max(30, Math.round(document.settings.fontSize * 2.6))}px` } as React.CSSProperties}><span className="rsvp-guide top" /><RsvpWord word={currentWord} next={document.settings.rsvpMode === "context" ? words[document.currentWord + 1] : undefined} /><span className="rsvp-guide bottom" /></div><span className="rsvp-page-indicator">Página {page + 1} de {Math.max(1, pageCount)}</span><button className="rsvp-zone rsvp-zone-right" aria-label="Avançar uma palavra" onPointerDown={() => startHold(1)} onPointerUp={stopHold} onPointerCancel={stopHold} onPointerLeave={stopHold} /></div><footer className="reader-toolbar reader-rsvp-toolbar"><div className="reader-automation-stack"><div className="reader-icon-controls"><button title="Iniciar RSVP" aria-label="Iniciar RSVP" onClick={() => setRsvpPlaying(true)} disabled={rsvpPlaying}>▶</button><button title="Pausar" aria-label="Pausar RSVP" onClick={pauseAll} disabled={!rsvpPlaying}>Ⅱ</button><button title="Parar" aria-label="Parar RSVP" onClick={pauseAll} disabled={!rsvpPlaying}>■</button><button title="Mostrar próxima palavra" aria-label="Alternar próxima palavra" className={document.settings.rsvpMode === "context" ? "active" : ""} onClick={() => updateSettings({ rsvpMode: document.settings.rsvpMode === "single" ? "context" : "single" })}>◫</button></div><WpmControl label="Velocidade RSVP" value={document.settings.wpm} min={100} max={1000} step={25} onChange={(wpm) => updateSettings({ wpm })} /></div><div className="reader-navigation"><ReaderSettingsPanel settings={document.settings} update={updateSettings} />{focusToggle()}</div></footer></>}
  </section>;
}

function ReaderChoice({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value)?.label ?? options[0]?.label ?? "";
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeWithEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    globalThis.document.addEventListener("pointerdown", closeOutside, true);
    globalThis.document.addEventListener("keydown", closeWithEscape);
    return () => { globalThis.document.removeEventListener("pointerdown", closeOutside, true); globalThis.document.removeEventListener("keydown", closeWithEscape); };
  }, [open]);
  return <div ref={root} className="reader-choice"><button type="button" className="reader-choice-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}><span>{selected}</span><i aria-hidden="true">⌄</i></button>{open && <div className="reader-choice-options" role="listbox" aria-label={label}>{options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? "active" : ""} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}><span>{option.label}</span><i aria-hidden="true">{option.value === value ? "✓" : ""}</i></button>)}</div>}</div>;
}

function WpmControl({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDraft(String(value)));
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  const commit = () => {
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed / step) * step)) : value;
    setDraft(String(next));
    onChange(next);
  };
  return <label className="reader-speed"><span className="reader-wpm-value"><input aria-label={`${label} em WPM`} inputMode="numeric" type="number" min={min} max={max} step={step} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /><i>WPM</i></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ReaderSettingsPanel({ settings, update }: { settings: ReaderSettings; update: (patch: Partial<ReaderSettings>) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const fonts = [{ value: "app", label: "Original" }, { value: "Georgia, serif", label: "Serifada (Georgia)" }, { value: "Arial, Helvetica, sans-serif", label: "Arial" }, { value: '"Courier New", Courier, monospace', label: "Courier" }];
  const weights = [{ value: "400", label: "Normal" }, { value: "600", label: "Seminegrito" }, { value: "700", label: "Negrito" }];
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const closeWithEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    globalThis.document.addEventListener("pointerdown", closeOutside, true);
    globalThis.document.addEventListener("keydown", closeWithEscape);
    return () => { globalThis.document.removeEventListener("pointerdown", closeOutside, true); globalThis.document.removeEventListener("keydown", closeWithEscape); };
  }, [open]);
  return <div ref={root} className="reader-settings-wrap"><button onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Configurações de leitura">Aa</button>{open && <div className="reader-settings"><strong>Conforto de leitura</strong><div className="reader-setting-row"><span>Fonte</span><ReaderChoice label="Fonte do leitor" value={settings.fontOverride ? settings.fontFamily : "app"} options={fonts} onChange={(value) => update(value === "app" ? { fontOverride: false } : { fontFamily: value, fontOverride: true })} /></div><div className="reader-setting-row"><span>Peso</span><ReaderChoice label="Peso da fonte" value={String(settings.fontWeight)} options={weights} onChange={(value) => update({ fontWeight: Number(value) as 400 | 600 | 700 })} /></div><label className="reader-setting-row"><span>Tamanho</span><input type="range" min="14" max="34" value={settings.fontSize} onChange={(event) => update({ fontSize: Number(event.target.value) })} /></label></div>}</div>;
}
