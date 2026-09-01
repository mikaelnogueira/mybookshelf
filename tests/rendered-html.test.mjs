import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("o build contém a experiência MyBookshelf", async () => {
  const server = await readFile(new URL("../dist/server/index.js", import.meta.url), "utf8");
  const clientDir = new URL("../dist/client/assets/", import.meta.url);
  const clientFiles = (await readdir(clientDir)).filter((name) => name.startsWith("BookshelfApp-") && name.endsWith(".js"));
  assert.equal(clientFiles.length, 1);
  const client = await readFile(new URL(clientFiles[0], clientDir), "utf8");
  assert.match(server, /MyBookshelf/);
  assert.match(client, /Sua biblioteca viva/);
  assert.match(client, /Bom dia/);
  assert.match(client, /Boa tarde/);
  assert.match(client, /Boa noite/);
  assert.match(client, /Comece sua biblioteca/);
  assert.match(client, /Bem-vindo ao MyBookshelf/);
  assert.match(client, /Pular tutorial/);
  assert.match(client, /Rever tutorial/);
  assert.match(client, /Excluir livro/);
  assert.match(client, /mybookshelf-tutorial-v1/);
  assert.match(client, /mybookshelf-stats-initialized-v1/);
  assert.match(client, /mybookshelf-organizations-v1/);
  assert.match(client, /mybookshelf-web-first-user-v3/);
  assert.match(client, /mybookshelf-native-first-user-v3/);
  assert.match(client, /Adicionar primeiro livro/);
  assert.match(client, /Organização flexível/);
  assert.match(server, /Não foi possível excluir o livro agora/);
  assert.match(server, /Não foi possível salvar este item agora/);
  assert.match(server, /Não foi possível atualizar este item agora/);
  assert.match(server, /Não foi possível excluir este item agora/);
  assert.match(server, /As estatísticas serão inicializadas quando a conexão retornar/);
  assert.doesNotMatch(`${server}${client}`, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("mantém temas, saudação e organização manual consistentes", async () => {
  const [app, css, classification, organizationApi] = await Promise.all([
    readFile(new URL("../app/BookshelfApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../lib/bookClassification.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/organization/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(app, /window\.setInterval\(\(\) => setToday\(new Date\(\)\), 60_000\)/);
  assert.match(app, /greetingFor\(today\)/);
  assert.match(app, /className="eyebrow" suppressHydrationWarning/);
  assert.match(app, /<h1 suppressHydrationWarning>\{greetingFor\(today\)\}/);
  assert.match(app, /className="primary-button add-book-button"/);
  assert.match(app, /aria-label="Adicionar livro" aria-haspopup="dialog"/);
  assert.match(app, /className="add-label">Adicionar livro/);
  assert.match(app, /Salvar alterações/);
  assert.match(app, /metadados automáticos e nunca os substitui/);
  assert.doesNotMatch(css, /top-actions \.icon-button:first-child \{ display: none/);
  assert.match(css, /data-style="brutal"\] \.view-grid \.library-book-copy,[\s\S]*padding: 10px/);
  assert.match(css, /\.add-icon \{ display: inline-grid; place-items: center/);
  assert.match(css, /\.add-book-button \.add-label \{ display: none/);
  assert.match(css, /\.add-book-button \.add-icon \{ display: grid; place-items: center; width: 100%; height: 100%/);
  assert.match(classification, /Ficção científica/);
  assert.match(classification, /const tags = clean/);
  assert.match(organizationApi, /export async function PATCH/);
  assert.match(organizationApi, /export async function DELETE/);
});

test("as duas versões iniciam vazias e respeitam a área segura móvel", async () => {
  const [app, css, resetMigration] = await Promise.all([
    readFile(new URL("../app/BookshelfApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_first_user_full_reset.sql", import.meta.url), "utf8"),
  ]);
  assert.match(app, /useState<Book\[\]>\(\[\]\)/);
  assert.match(app, /\["reading", "read", "paused", "abandoned", "want"\]/);
  assert.match(app, /mobileStorePut\("library", "organizations", organizations\)/);
  assert.doesNotMatch(app, /indexedDB\.deleteDatabase\("mybookshelf-mobile-v1"\)/);
  assert.doesNotMatch(app, /tutorialStep !== null && !isNativeRuntime/);
  assert.doesNotMatch(app, /Você está a 28 páginas|184 páginas|76 dias com leitura/);
  assert.match(css, /view-carousel \.library-book \{ padding: 0;/);
  assert.match(css, /view-carousel \.library-book-copy \{ padding: 10px;/);
  assert.match(css, /--safe-top: max\(env\(safe-area-inset-top, 0px\), 12px\)/);
  assert.match(css, /top-actions \.icon-button, \.top-actions \.primary-button \{ display: grid; place-items: center;/);
  assert.match(resetMigration, /DELETE FROM `books`/);
  assert.match(resetMigration, /DELETE FROM `user_stats`/);
});

test("removeu todos os artefatos temporários do starter", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(page, /BookshelfApp/);
  assert.match(layout, /MyBookshelf/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", root)));
});

test("a versão 2.0 integra leitor, RSVP e notificações Android", async () => {
  const [app, reader, importer, notification, receiver, manifest, packageJson, gradle] = await Promise.all([
    readFile(new URL("../app/BookshelfApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ReaderModule.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/readerImport.ts", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/java/com/mybookshelf/app/ReadingNotificationPlugin.java", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/java/com/mybookshelf/app/ReadingNotificationReceiver.java", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8"),
  ]);
  assert.match(app, /#c7f36b", "#b7a0ff/);
  assert.match(app, /Importar arquivo do livro/);
  assert.match(app, /Anexar arquivo/);
  assert.match(app, /CapacitorApp\.addListener\("backButton"/);
  assert.match(reader, /"traditional" \| "rsvp"/);
  assert.match(reader, /wordParts/);
  assert.match(reader, /Alternar próxima palavra/);
  assert.match(importer, /pdfjs-dist/);
  assert.match(importer, /importEpub/);
  assert.match(importer, /mammoth\.extractRawText/);
  assert.match(notification, /2L \* 60L \* 60L \* 1000L/);
  assert.match(notification, /welcome_shown/);
  assert.match(receiver, /quote_index/);
  assert.match(manifest, /POST_NOTIFICATIONS/);
  assert.match(manifest, /RECEIVE_BOOT_COMPLETED/);
  assert.equal(JSON.parse(packageJson).version, "2.2.8");
  assert.match(gradle, /versionName "2.2.8"/);
  assert.match(gradle, /versionCode 27/);
});

test("a versão 2.1 preserva progresso e adiciona automação, edição e importação seletiva", async () => {
  const [reader, importer, types, css, app] = await Promise.all([
    readFile(new URL("../app/ReaderModule.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/readerImport.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/readerTypes.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/BookshelfApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(reader, />‹<|>›<|−10|\+10/);
  assert.match(reader, /startHold\(-1\)/);
  assert.match(reader, /startHold\(1\)/);
  assert.match(reader, /document\.settings\.wpm/);
  assert.match(reader, /traditionalPlaying/);
  assert.match(reader, /rsvpPlaying/);
  assert.match(reader, /aria-label="Iniciar leitura automática"/);
  assert.match(reader, /aria-label="Pausar leitura automática"/);
  assert.match(reader, /aria-label="Parar leitura automática"/);
  assert.match(reader, /guided-word-active/);
  assert.match(reader, /pageForWord/);
  assert.match(reader, /window\.setInterval\(\(\) => \{ persistProgress\(latestDocument\.current\)/);
  assert.match(css, /\.rsvp-zone \{[^}]*width: 50%/);
  assert.match(css, /\.rsvp-zone-left \{ left: 0; \}/);
  assert.match(css, /\.rsvp-zone-right \{ right: 0; \}/);
  assert.doesNotMatch(reader, /reader-colors|document\.settings\.background|document\.settings\.color/);
  assert.doesNotMatch(types, /background: string|color: string/);
  assert.match(types, /wpm: number/);
  assert.match(importer, /structurePlainText/);
  assert.match(importer, /text: decoded, paragraphs: structurePlainText\(decoded\)/);
  assert.match(reader, /fontFamily: appFontFamily/);
  assert.match(reader, /saveReaderProgress\(current\.bookId, progress\)/);
  assert.match(importer, /removeRepeatedPageArtifacts/);
  assert.match(reader, /onPointerUp/);
  assert.match(app, /searchGoogleBooksDirect/);
  assert.match(app, /researchBookMetadata/);
  assert.match(app, /Fonte do aplicativo/);
  assert.match(app, /data-font=\{appFont\}/);
  assert.match(css, /data-font="courier"/);
  assert.match(app, /document\.isbn/);
  assert.match(app, /metadata\?\.description/);
  assert.match(app, /searchMetadataCandidates/);
  assert.doesNotMatch(app, /`\/api\/books\/search\?\$\{query\}`/);
  assert.ok(app.indexOf('className="metadata-search-block"') < app.indexOf('<FileImportPanel onImported={addImported}'), "a busca deve aparecer antes da importação");
  assert.match(app, /function BookEditDialog/);
  assert.match(app, /manualCover: true/);
  assert.match(app, /foi adicionado à biblioteca/);
  assert.match(app, /Texto \(recomendada\)/);
  assert.match(app, /Imagem do PDF/);
  assert.match(app, /Exibe as páginas originais, sem OCR/);
  assert.match(app, /Importação Completa|>Completa</);
  assert.match(importer, /ReaderImportMode/);
  assert.match(importer, /extension === "pdf" \? 480 : 120/);
  assert.match(importer, /mode === "complete" && !content\.text\.trim\(\)/);
  assert.match(importer, /importPdfAsImages/);
  assert.match(importer, /pdfFile\s*\}/);
  assert.match(types, /traditionalWpm: number/);
  assert.match(types, /guidedMode: boolean/);
  assert.match(css, /reader-mode-switch button\.active, \.rsvp-controls button\.active \{ color: #10160e; background: var\(--accent\)/);
});

test("a correção 2.1.6 mantém o leitor responsivo, persistente e simplifica a edição", async () => {
  const [app, reader, storage, importer, css] = await Promise.all([
    readFile(new URL("../app/BookshelfApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ReaderModule.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/readerStorage.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/readerImport.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(reader, /reader-loading|Preparando sua leitura/);
  assert.doesNotMatch(reader, /saveReaderDocument/);
  assert.match(reader, /initialDocument: ReaderDocument/);
  assert.match(reader, /saveReaderProgress/);
  assert.match(reader, /const WordText = memo/);
  assert.match(storage, /DATABASE_VERSION = 4/);
  assert.match(storage, /readerProgress/);
  assert.match(storage, /delete lightweight\.originalFile/);
  assert.doesNotMatch(importer, /originalFile: file/);
  assert.match(app, /className="dialog-backdrop edit-book-backdrop"/);
  assert.match(app, /className="book-edit-summary-card"/);
  assert.match(app, /className="book-cover-pencil"/);
  assert.match(app, /aria-label="Alterar capa"/);
  assert.match(app, /className="book-status-options"/);
  assert.doesNotMatch(app, /<select value=\{draft\.status\}/);
  assert.match(app, /indexedDB\.open\("mybookshelf-mobile-v1", 4\)/);
  assert.match(app, /mybookshelf-native-library-v1/);
  assert.match(app, /readerProgress/);
  assert.doesNotMatch(app, /book-cover-edit-button|book-cover-remove-button|book-cover-actions/);
  assert.match(app, /Editar Sobre o livro/);
  assert.doesNotMatch(app, /Aqui você apenas seleciona/);
  assert.doesNotMatch(app, /className="inline-create"/);
  assert.doesNotMatch(app, /edit-organization-section/);
  assert.doesNotMatch(app, /<h2>Metadados<\/h2>/);
  assert.doesNotMatch(app, /Configurações de leitura<\/h2>/);
  assert.match(app, /localLibraryLoaded \? Promise\.resolve/);
  assert.match(app, /uniqueBooks/);
  assert.match(reader, /window\.requestAnimationFrame\(advance\)/);
  assert.match(reader, /pixelsPerSecond/);
  assert.match(reader, /const activeGuide = document\.settings\.guidedMode/);
  assert.match(reader, /data-reader-paragraph=.*scrollIntoView/);
  assert.doesNotMatch(reader, /data-reader-word=.*scrollIntoView/);
  assert.match(reader, /className="reader-automation-stack"/);
  assert.match(css, /\.book-edit-dialog \{ display: grid; grid-template-rows: auto minmax\(0, 1fr\) auto/);
  assert.match(css, /@media \(max-width: 700px\) \{ \.edit-book-backdrop \{ place-items: center/);
  assert.match(css, /\.book-overflow \{[^}]*background: transparent; border: 0;[^}]*box-shadow: none/);
  assert.match(css, /\.book-cover-pencil \{[^}]*background: transparent; border: 0/);
  assert.match(css, /data-style="brutal"\] \.library-book \.book-cover \{ border: 0; box-shadow: none/);
  assert.match(css, /\.reader-icon-controls button \{ border: 0; box-shadow: none/);
  assert.match(css, /\.reader-toolbar \{ grid-row: 2/);
  assert.doesNotMatch(reader, /<select/);
  assert.match(reader, /className="reader-choice-options"/);
  assert.match(reader, /PdfVisualPage/);
  assert.doesNotMatch(app, /window\.confirm/);
  assert.doesNotMatch(app, /type="date"/);
  assert.match(app, /className="dialog confirmation-dialog"/);
  assert.match(app, /className="themed-date-input"/);
  assert.match(css, /\.reader-choice-options/);
  assert.match(css, /\.confirmation-dialog/);
});

test("a versão 2.1.7 integra leitura guiada, rolagem, foco e RSVP", async () => {
  const [app, reader, css] = await Promise.all([
    readFile(new URL("../app/BookshelfApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ReaderModule.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /readerOpening \? "Abrindo…" : "▶ Abrir"/);
  assert.match(app, /onClick=\{onEdit\}>✎ Editar</);
  assert.match(reader, /programmaticScroll/);
  assert.match(reader, /manualScrollUntil/);
  assert.match(reader, /data-reader-word="\$\{document\.currentWord\}"/);
  assert.match(reader, /behavior: traditionalPlaying \? "smooth" : "auto"/);
  assert.match(reader, /syncVisiblePosition/);
  assert.match(reader, /const canAutoScroll = document\.settings\.layout === "scroll"/);
  assert.match(reader, /reader-focus-toggle/);
  assert.match(reader, /className="rsvp-page-indicator"/);
  assert.doesNotMatch(reader, /activeParagraphIndex/);
  assert.match(css, /\.reader-shell\.reader-focus/);
  assert.match(css, /\.detail-actions button \{[^}]*white-space: nowrap;/);
});

test("a versão 2.1.8 impede restauração antiga e contém todos os temas na largura móvel", async () => {
  const [css, manifest, backupRules, extractionRules] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/res/xml/backup_rules.xml", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/res/xml/data_extraction_rules.xml", import.meta.url), "utf8"),
  ]);
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:fullBackupContent="@xml\/backup_rules"/);
  assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  assert.match(backupRules, /<exclude domain="database" path="\." \/>/);
  assert.match(extractionRules, /<cloud-backup>[\s\S]*<device-transfer>/);
  assert.match(css, /html \{ width: 100%; max-width: 100%; overflow-x: hidden;/);
  assert.match(css, /\.app-shell \{[\s\S]*overflow-x: clip;/);
  assert.match(css, /\.global-search \{ flex: 1 1 0; min-width: 0; width: auto; \}/);
  assert.match(css, /\.detail-actions \{ width: 100%; \}\.detail-actions button \{ min-width: 0; max-width: 100%;[\s\S]*flex: 1 1 calc\(50% - 7px\); \}/);
});

test("a versão 2.1.9 fecha o leitor de imagem sem encerrar a interface Android", async () => {
  const [app, reader] = await Promise.all([
    readFile(new URL("../app/BookshelfApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ReaderModule.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(app, /const nativeBackState = useRef/);
  assert.match(app, /const state = nativeBackState\.current/);
  assert.match(app, /if \(state\.showReader\) \{[\s\S]*window\.dispatchEvent/);
  assert.match(app, /CapacitorApp\.addListener\("backButton", handleNativeBack\)/);
  assert.match(reader, /const finishing = useRef\(false\)/);
  assert.match(reader, /if \(finishing\.current\) return;/);
  assert.match(reader, /onCloseRef\.current\(\);\s*onSessionRef\.current\(result\);\s*persistProgress\(current\)\.catch/);
  assert.doesNotMatch(reader, /await persistProgress\(current\)/);
});

test("a versão 2.2 corrige fontes, escala, WPM e avanço guiado", async () => {
  const [app, reader, types, css] = await Promise.all([
    readFile(new URL("../app/BookshelfApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ReaderModule.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/readerTypes.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /type AppFont = "original" \| "serif" \| "arial" \| "courier"/);
  assert.match(app, /type InterfaceScale = "small" \| "medium" \| "large"/);
  assert.match(app, /data-interface-scale=\{interfaceScale\}/);
  assert.match(app, />Pequena<|>Média<|>Grande</);
  assert.match(reader, /label: "Original"/);
  assert.match(reader, /label: "Serifada \(Georgia\)"/);
  assert.match(reader, /label: "Arial"/);
  assert.match(reader, /label: "Courier"/);
  assert.doesNotMatch(reader, /label: "Palatino"|label: "Trebuchet"/);
  assert.match(reader, /function WpmControl/);
  assert.match(reader, /type="number" min=\{min\} max=\{max\}/);
  assert.match(reader, /guidedPage = .*pageForWord/);
  assert.match(reader, /className="reader-back-icon"/);
  assert.match(types, /"Courier New", Courier, monospace/);
  assert.match(css, /\.reader-content\[data-reader-weight="700"\]/);
  assert.match(css, /position: fixed;[\s\S]*max-height: min\(52dvh, 430px\)/);
  assert.match(css, /data-interface-scale="small"\] \{ --interface-scale: \.88; \}/);
  assert.match(css, /data-interface-scale="medium"\] \{ --interface-scale: 1; \}/);
  assert.match(css, /data-interface-scale="large"\] \{ --interface-scale: 1\.28; \}/);
  assert.match(css, /font-size: calc\(\d+(?:\.\d+)?px \* var\(--interface-scale, 1\)\)/);
  assert.doesNotMatch(css, /text-size-adjust/);
});

test("a versão 2.2 restaura a busca de metadados e não embute OCR não solicitado", async () => {
  const [app, importer, storage, metadataApi, mobileConfig, packageJson] = await Promise.all([
    readFile(new URL("../app/BookshelfApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/readerImport.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/readerStorage.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/books/search/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../vite.mobile.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const importedBookFlow = app.slice(
    app.indexOf("const addImported"),
    app.indexOf('return <div className="dialog-backdrop"', app.indexOf("const addImported")),
  );

  assert.match(app, /METADATA_TIMEOUT_MS = 12_000/);
  assert.match(app, /AbortController/);
  assert.match(app, /query\.set\("author", author\.trim\(\)\)/);
  assert.match(app, /searchGutendexDirect/);
  assert.match(app, /https:\/\/gutendex\.com\/books/);
  assert.match(app, /Promise\.all\(\[/);
  assert.doesNotMatch(app, /VITE_GOOGLE_BOOKS_API_KEY/);
  assert.match(app, /metadataSearchCache/);
  assert.doesNotMatch(app, /`\/api\/books\/search\?\$\{query\}`/);
  assert.doesNotMatch(importedBookFlow, /researchBookMetadata/);
  assert.match(importedBookFlow, /bestMetadataFor/);
  assert.match(importer, /URL\.createObjectURL\(file\)/);
  assert.doesNotMatch(importer, /importPdf\(buffer/);
  assert.match(importer, /page\.cleanup\(\)/);
  assert.match(importer, /allowBrowserPaint/);
  assert.doesNotMatch(importer, /shouldOcrPdfPage|createWorker|tesseract/i);
  assert.doesNotMatch(packageJson, /tesseract/i);
  assert.doesNotMatch(importer, /localAssetUrl|workerPath|langPath|gzip: false/);
  assert.match(storage, /ensureDocumentCapacity/);
  assert.match(storage, /navigator\.storage\?\.estimate/);
  assert.match(storage, /transaction\.onabort/);
  assert.doesNotMatch(metadataApi, /AbortController/);
  assert.match(metadataApi, /query\.set\("author", author\)/);
  assert.doesNotMatch(metadataApi, /GOOGLE_BOOKS_API_KEY/);
  assert.doesNotMatch(mobileConfig, /publicDir:/);

  await assert.rejects(access(new URL("../public/tesseract/worker.min.js", import.meta.url)));
  await assert.rejects(access(new URL("../public/tessdata/por.traineddata", import.meta.url)));
});

test("a versão 2.2.8 completa filtros, PDF visual e rolagem em WPM baixo", async () => {
  const [app, reader, readerTypes, importer, css, appleRoute, mainActivity, packageJson, gradle, serviceWorker, liveMetadata] = await Promise.all([
    readFile(new URL("../app/BookshelfApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ReaderModule.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/readerTypes.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/readerImport.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/books/apple/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../android/app/src/main/java/com/mybookshelf/app/MainActivity.java", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../android/app/build.gradle", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("./metadata-live.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(app, /searchAppleBooksDirect/);
  assert.match(app, /https:\/\/itunes\.apple\.com\/search/);
  assert.match(app, /searchWikipediaDirect/);
  assert.match(app, /https:\/\/pt\.wikipedia\.org\/w\/api\.php/);
  assert.match(app, /fetchMetadataJson<\{ results\?: AppleBook\[\] \}>\([^;]+8_000, 2\)/);
  assert.match(app, /metadataMatchScore/);
  assert.match(app, /function mergeMetadataResult/);
  assert.match(app, /async function enrichAppleBookResult/);
  assert.match(app, /CapacitorHttp\.get/);
  assert.match(appleRoute, /numberOfPages/);
  assert.match(appleRoute, /target\.hostname !== "books\.apple\.com"/);
  assert.match(app, /pages: primary\.pages \|\| pageSource\?\.pages \|\| 0/);
  assert.match(app, /const \[appleBase, googleBooks\] = await Promise\.all/);
  assert.match(app, /if \(appleWithGoogle\.some\(\(item\) => item\.pages > 0\)\) return appleWithGoogle/);
  assert.match(app, /const wikipedia = await credibleResults/);
  assert.match(app, /expiresAt: Date\.now\(\) \+ 30 \* 60_000/);
  assert.match(app, /const nativeBackLockedUntil = useRef\(0\)/);
  assert.match(app, /nativeBackLockedUntil\.current = now \+ 450/);
  assert.match(app, /nativeBackState\.current = \{ \.\.\.nativeBackState\.current, showReader: true, selectedBook: book \}/);
  assert.match(app, /const closeReaderToBook = useCallback/);
  assert.match(app, /window\.addEventListener\("mybookshelf-native-back", handleNativeBack\)/);
  assert.match(app, /CapacitorApp\.minimizeApp\(\)/);
  assert.doesNotMatch(app, /CapacitorApp\.exitApp\(\)/);
  assert.match(app, /document\.format === "PDF" && pageCount > 0 \? pageCount/);
  assert.match(app, /sessions: Array\.isArray\(book\.sessions\) \? book\.sessions : \[\]/);
  assert.match(app, /const previousSessions = Array\.isArray\(book\.sessions\) \? book\.sessions : \[\]/);
  assert.match(reader, /globalThis\.document\.addEventListener\("pointerdown", closeOutside, true\)/);
  assert.match(reader, /if \(!root\.current\?\.contains\(event\.target as Node\)\) setOpen\(false\)/);
  assert.match(reader, /const onCloseRef = useRef\(onClose\)/);
  assert.match(app, /Adicionados recentemente/);
  assert.match(app, /Adicionados anteriormente/);
  assert.match(app, /Páginas: crescente/);
  assert.match(app, /Páginas: decrescente/);
  assert.match(app, /Todas as categorias/);
  assert.match(app, /Gráfico em onda/);
  assert.match(app, /value: "90", label: "3 meses"/);
  assert.match(app, /function primaryTags/);
  assert.match(readerTypes, /return safeWpm \* safeFontSize \/ 300/);
  assert.match(reader, /let intendedScrollTop = node\.scrollTop/);
  assert.match(reader, /node\.scrollTop = intendedScrollTop/);
  assert.match(reader, /document\.pdfFile\.arrayBuffer\(\)/);
  assert.match(importer, /const pdfFile = file\.slice\(0, file\.size, file\.type \|\| "application\/pdf"\);/);
  assert.doesNotMatch(importer.match(/async function importPdfAsImages[\s\S]*?\n\}/)?.[0] ?? "", /createObjectURL/);
  assert.match(reader, /onCloseRef\.current\(\);\s*onSessionRef\.current\(result\)/);
  assert.match(reader, /focusToggle\(\)/);
  assert.match(mainActivity, /OnBackPressedCallback/);
  assert.match(mainActivity, /bridge\.triggerWindowJSEvent\("mybookshelf-native-back"\)/);
  assert.match(css, /\.reader-choice-options \{ position: absolute; top: auto;[\s\S]*bottom: calc\(100% \+ 6px\)/);
  assert.match(css, /\.reader-choice-trigger\[aria-expanded="true"\] \{[^}]*box-shadow: none;/);
  assert.match(css, /\.reader-choice-trigger:focus,[^}]*outline: 0/);
  assert.match(css, /\.reader-focus-toggle \{ position: static;/);
  assert.match(css, /\.wave-chart/);
  assert.doesNotMatch(css, /\.reader-choice-options \{ position: static/);
  assert.match(css, /data-interface-scale="large"\] \{ --interface-scale: 1\.28; \}/);
  assert.equal(JSON.parse(packageJson).version, "2.2.8");
  assert.match(gradle, /versionName "2.2.8"/);
  assert.match(gradle, /versionCode 27/);
  assert.match(serviceWorker, /mybookshelf-shell-v2-2-3/);
  assert.equal((liveMetadata.match(/^  \[/gm) ?? []).length, 30);
  assert.match(liveMetadata, /"somente título"/);
});
