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
  assert.match(app, /className="primary-button add-book-button"/);
  assert.match(app, /Salvar alterações/);
  assert.match(app, /metadados automáticos e nunca os substitui/);
  assert.doesNotMatch(css, /top-actions \.icon-button:first-child \{ display: none/);
  assert.match(css, /data-style="brutal"\] \.view-grid \.library-book-copy,[\s\S]*padding: 10px/);
  assert.match(css, /\.add-icon \{ display: inline-grid; place-items: center/);
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
  assert.match(app, /indexedDB\.deleteDatabase\("mybookshelf-mobile-v1"\)/);
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
