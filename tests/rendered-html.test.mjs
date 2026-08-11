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
  assert.match(client, /Boa noite, leitor/);
  assert.match(client, /Duna/);
  assert.match(client, /Bem-vindo ao MyBookshelf/);
  assert.match(client, /Pular tutorial/);
  assert.match(client, /Rever tutorial/);
  assert.match(client, /Excluir livro/);
  assert.match(client, /mybookshelf-tutorial-v1/);
  assert.match(client, /mybookshelf-stats-initialized-v1/);
  assert.match(client, /mybookshelf-organizations-v1/);
  assert.match(client, /mybookshelf-first-access-v2/);
  assert.match(client, /Adicionar primeiro livro/);
  assert.match(client, /Organização flexível/);
  assert.match(server, /Não foi possível excluir o livro agora/);
  assert.match(server, /Não foi possível salvar este item agora/);
  assert.match(server, /As estatísticas serão inicializadas quando a conexão retornar/);
  assert.doesNotMatch(`${server}${client}`, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("a Web inicia vazia e mantém a capa Glass sem padding", async () => {
  const [app, css, resetMigration] = await Promise.all([
    readFile(new URL("../app/BookshelfApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_first_access_reset.sql", import.meta.url), "utf8"),
  ]);
  assert.match(app, /isNativeRuntime\(\) \? seedBooks : \[\]/);
  assert.match(app, /\["reading", "read", "paused", "abandoned", "want"\]/);
  assert.match(css, /view-carousel \.library-book \{ padding: 0;/);
  assert.match(css, /view-carousel \.library-book-copy \{ padding: 10px;/);
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
