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
  assert.match(server, /Não foi possível excluir o livro agora/);
  assert.doesNotMatch(`${server}${client}`, /codex-preview|Building your site|react-loading-skeleton/i);
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
