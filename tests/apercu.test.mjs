// Aperçu GitHub Pages : contenu suivi par git, sous /malicious-music-site/, moins les exclusions de _config.yml
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chrome, sleep } from "./cdp.mjs";

const root = new URL("..", import.meta.url).pathname, P = "/malicious-music-site/", U = "http://localhost:8797" + P;
const exclude = fs.readFileSync(root + "_config.yml", "utf8").match(/exclude: \[(.+)\]/)[1].split(/,\s*/);
// Jekyll ne publie ni les exclusions, ni les noms qui commencent par . ou _
const files = new Set(execFileSync("git", ["ls-files", "-c", "-o", "--exclude-standard"], { cwd: root, encoding: "utf8" }).split("\n").filter((f) => f && !f.split("/").some((x) => /^[._]/.test(x)) && !exclude.includes(f.split("/")[0])));
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".woff2": "font/woff2" };
let srv, b;
before(async () => {
  srv = http.createServer((q, r) => {
    let f = decodeURI(q.url.split("?")[0]).replace(P, ""); if (f === "") f = "index.html";
    const ok = q.url.startsWith(P) && files.has(f), name = ok ? f : "404.html";
    r.writeHead(ok ? 200 : 404, { "content-type": TYPES[path.extname(name)] || "application/octet-stream" }); r.end(fs.readFileSync(root + name));
  }).listen(8797, "127.0.0.1");
  b = await chrome();
});
after(() => { b?.close(); srv.close(); srv.closeAllConnections(); });

test("seuls les fichiers du site sont publiés", () => {
  const top = new Set([...files].map((f) => f.split("/")[0]));
  assert.deepEqual([...top].sort(), ["404.css", "404.html", "assets", "boot.js", "demo.js", "i18n", "i18n.js", "index.html", "main.js", "models.js", "robots.txt", "sitemap.xml", "styles.css"]);
});
test("page complète sous le sous-dossier, 22 langues, sans erreur, non indexée", { timeout: 90000 }, async () => {
  const p = await b.page(); await p.goto(U, 5500);
  for (const l of JSON.parse(await p.ev("JSON.stringify(Object.keys(I18N.LANGS))"))) { await p.ev(`I18N.set("${l}")`); assert.equal(await p.ev("document.documentElement.lang"), l); }
  await p.ev("I18N.set('en')"); await p.ev("location.hash='mentions'"); await sleep(500);
  const t = await p.ev("document.getElementById('legal').innerText");
  for (const x of ["853 801 488 RCS Clermont-Ferrand", "VAT not applicable", "GitHub, Inc.", "verymaliciousmusic@gmail.com"]) assert.ok(t.includes(x), x);
  assert.match(await p.ev("document.querySelector('meta[name=robots]').content"), /noindex/);
  assert.deepEqual(p.log, []); assert.deepEqual(p.req.filter((r) => !r.startsWith("GET " + U)), []);
});
test("404 habillée, liens vers le bon dossier", async () => {
  const p = await b.page(); await p.goto(U + "nope/nope", 800);
  assert.equal(await p.ev("getComputedStyle(document.body).display + [...document.links].map(a => a.pathname).join()"), "grid" + P + "," + P);
});
