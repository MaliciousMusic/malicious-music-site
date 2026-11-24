// Contrôles de lecture : node --test tests/site.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const read = (f) => fs.readFileSync(root + f, "utf8");
const html = read("index.html");
const JS = ["boot.js", "i18n.js", "models.js", "main.js", "demo.js"];
const DICTS = fs.readdirSync(root + "i18n").filter((f) => /^[a-z]{2}\.json$/.test(f));
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28 });

test("aucun puits dangereux dans les scripts", () => {
  for (const f of JS) assert.doesNotMatch(read(f), /\.(inner|outer)HTML|insertAdjacentHTML|document\.write|\beval\(|new Function|DOMParser|createContextualFragment|srcdoc|setTimeout\(\s*["'`]|postMessage|["'`]style["'`]\s*,/, f);
});
test("aucun script ni style en ligne, aucun gestionnaire on…", () => {
  for (const f of ["index.html", "404.html"]) {
    const h = read(f);
    assert.doesNotMatch(h, /<script(?![^>]*\bsrc=)/); assert.doesNotMatch(h, /<style\b/); assert.doesNotMatch(h, /\sstyle=/); assert.doesNotMatch(h, /\son[a-z]+=/); assert.doesNotMatch(h, /javascript:/i);
  }
});
test("aucune ressource tierce", () => {
  for (const f of ["index.html", "404.html", "404.css", "styles.css", ...JS]) {
    for (const m of read(f).matchAll(/(?:src|href|url\(|fetch\(|import)\s*=?\s*["'`(]*\s*((?:https?:)?\/\/[^"'`)\s]+)/g))
      assert.match(m[1], /^https:\/\/(maliciousmusic\.github\.io\/malicious-music-site\/|maliciousmusic\.org\/)$/, `${f} ${m[1]}`);
  }
});
test("CSP stricte, identique dans la page et dans l'en-tête", () => {
  const meta = html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  const head = read("cloudflare/_headers").match(/Content-Security-Policy: (.+)/)[1];
  assert.equal(head, meta + "; frame-ancestors 'none'");
  assert.doesNotMatch(head, /unsafe-|\*|data:|http:|https:/);
});
test("HSTS d'un an, non préchargé", () => {
  const h = read("cloudflare/_headers").match(/Strict-Transport-Security: (.+)/)[1];
  assert.match(h, /max-age=31536000/); assert.doesNotMatch(h, /preload/);
});
test("_headers : pas de règle en double, lignes et nombre sous la limite", () => {
  const l = read("cloudflare/_headers").split("\n"), r = l.filter((x) => /^[/h]/.test(x));
  assert.equal(new Set(r).size, r.length); assert.ok(r.length < 100); assert.ok(l.every((x) => x.length < 2000));
});
test("traductions : mêmes clés, texte seul, mêmes nombres, mêmes crochets", () => {
  const src = JSON.parse(read("i18n/_source.json"));
  assert.equal(DICTS.length, 21);
  for (const f of DICTS) {
    const d = JSON.parse(read("i18n/" + f));
    assert.deepEqual(Object.keys(d).sort(), [...src].sort(), f);
    for (const s of src) {
      const t = d[s], at = `${f} « ${s.slice(0, 50)} »`;
      assert.equal(typeof t, "string", at); assert.ok(t.trim(), at);
      assert.doesNotMatch(t, /[<>]|javascript:|https?:\/\//i, at);
      assert.doesNotMatch(t, /[\u200b\u202a-\u202e\u2060\u2066-\u2069\ufeff]/, at);
      const n = (x) => (x.replace(/3D/gi, "").match(/\d+/g) || []).sort();
      assert.deepEqual(n(t), n(s), at);
      for (const c of "[]") assert.equal(t.split(c).length, s.split(c).length, at);
    }
  }
});
test("_source.json à jour", () => {
  const before = read("i18n/_source.json"), r = spawnSync("python3", ["tools/i18n_extract.py"], { cwd: root });
  const after = read("i18n/_source.json"); fs.writeFileSync(root + "i18n/_source.json", before);
  if (r.status === 0) assert.equal(after, before);   // sans python3-bs4, contrôle sauté
});
test("rien ne laisse croire qu'on peut payer ou s'inscrire", () => {
  assert.doesNotMatch(html, /data-placeholder|href="#"/);
  const form = html.match(/<form class="box signup"[\s\S]*?<\/form>/)[0];
  assert.doesNotMatch(form, /\b(action|method)=/);
  for (const el of form.match(/<(input|select|button)\b[^>]*>/g)) assert.match(el, /\bdisabled\b/, el);
  assert.equal(html.match(/<button class="btn xl" type="button" disabled>BIENTÔT DISPONIBLE/g).length, 4);
  assert.ok(html.includes("Rien n'est encore en vente"));
});
test("ni clé, ni jeton, ni chemin personnel, dans les fichiers et l'historique", () => {
  const re = "sk_(live|test)_[0-9A-Za-z]{8}|rk_live_|AIza[0-9A-Za-z_-]{30}|gh[pousr]_[0-9A-Za-z]{30}|github_pat_[0-9A-Za-z]{20}|xox[baprs]-[0-9]|whsec_[0-9A-Za-z]{10}|AKIA[0-9A-Z]{16}|BEGIN [A-Z ]*PRIVATE KEY|/home/[a-z]+/";
  const bin = [":!*.png", ":!*.webp", ":!*.jpg", ":!*.woff2", ":!*.ttf", ":!tests/site.test.mjs"];
  assert.equal(git("log", "--all", "-E", "-i", `-G${re}`, "--format=%h", "--", ".", ...bin).trim(), "");
  assert.equal(spawnSync("git", ["grep", "-lEiI", re, "--", ".", ":!tests/site.test.mjs"], { cwd: root, encoding: "utf8" }).stdout, "");
  assert.doesNotMatch(git("ls-files"), /(^|\/)\.(env|dev\.vars)|\.map$|\.pem$|\.key$/m);
});
test("images sans position GPS ni EXIF", () => {
  for (const f of git("ls-files", "assets", "design").split("\n").filter((x) => /\.(png|jpg|webp)$/.test(x))) {
    const b = fs.readFileSync(root + f);
    assert.ok(!b.includes("Exif\0\0") && !b.includes("eXIf") && !b.includes("<x:xmpmeta"), f);
  }
});
test("production refusée tant que les textes légaux sont incomplets", () => {
  const legal = html.slice(html.indexOf('id="mentions"'), html.indexOf('id="cgv"'));
  const r = spawnSync("python3", ["tools/build.py"], { cwd: root, encoding: "utf8" });
  if (legal.includes('class="ph"')) { assert.notEqual(r.status, 0); assert.match(r.stderr, /mentions légales/); } else assert.equal(r.status, 0, r.stderr);
});
