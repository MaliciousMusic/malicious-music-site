// Contrôles de lecture : node --test tests/site.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
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
  assert.equal(html.match(/<button class="btn xl" type="button" disabled>À VENIR/g).length, 4);
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
test("plus aucun texte entre crochets, dans aucune langue", () => {
  const body = html.slice(html.indexOf("<body"));
  assert.doesNotMatch(body.replace(/<[^>]+>/g, ""), /\[[^\]]*\]/);
  for (const f of DICTS) assert.doesNotMatch(read("i18n/" + f), /\[/, f);
});
test("statut annoncé : tarif prévu, concept, simulation, CGV projet", () => {
  for (const x of ["VOIR LE TARIF PRÉVU", "TARIF PRÉVU", "Tarif prévu, sans engagement : à venir.", "pas le rendu du plugin", "VST3 prévu, autres formats à venir.", "PROJET, À VENIR, SANS VENTE", "Plugin en développement"]) assert.ok(html.includes(x), x);
  assert.equal(html.match(/CONCEPT · À VENIR/g).length, 6);
  assert.doesNotMatch(html, /jamais besoin|COMMENCER|S'ABONNER|PRÉCOMMANDER|>EXPÉRIMENTAL · SANS RECHARGE/);
});
test("la production passe, et refuse dès qu'un champ d'identité manque", () => {
  const tmp = fs.mkdtempSync(os.tmpdir() + "/mm-build-");
  const run = (...a) => spawnSync("python3", ["tools/build.py", ...a], { cwd: tmp, encoding: "utf8" });
  for (const f of ["index.html", "404.html", "404.css", "styles.css", ...JS, "assets", "i18n", "tools", "cloudflare"]) fs.cpSync(root + f, tmp + "/" + f, { recursive: true });
  const cfg = JSON.parse(read("cloudflare/site.json"));
  try {
    const r = run(); assert.equal(r.status, 0, r.stderr);
    const out = fs.readFileSync(tmp + "/dist/index.html", "utf8");
    assert.doesNotMatch(out, /name="robots"|github\.io\/malicious-music-site/); assert.match(out, /canonical" href="https:\/\/maliciousmusic\.org\/"/);
    assert.doesNotMatch(fs.readFileSync(tmp + "/dist/404.html", "utf8"), /malicious-music-site/);
    assert.doesNotMatch(fs.readFileSync(tmp + "/dist/_headers", "utf8"), /^\/\*\n  X-Robots-Tag/m);
    assert.match(fs.readFileSync(tmp + "/dist/.well-known/security.txt", "utf8"), /^Contact: mailto:\S+@\S+\nExpires: \d{4}/);
    assert.match(out, /SIRET : <span[^>]*>853 801 488 00026/); assert.match(out, />853 801 488 RCS Clermont-Ferrand</); assert.match(out, /data-id="tva">TVA non applicable, article 293 B du CGI</);
    assert.doesNotMatch(out, /au capital de|TTC|TVA française incluse/);
    for (const k of ["raison", "statut", "siret", "immatriculation", "tva", "adresse", "telephone", "email", "directeur", "date"]) {
      for (const v of ["", "À CONFIRMER", "À VENIR"]) {
        fs.writeFileSync(tmp + "/index.html", html.replace(new RegExp(`(data-id="${k}"[^>]*>)[^<]*<`), `$1${v}<`));
        assert.notEqual(run().status, 0, k + v);
      }
    }
    fs.writeFileSync(tmp + "/index.html", html);
    fs.writeFileSync(tmp + "/cloudflare/site.json", JSON.stringify({ ...cfg, security_expires: "2020-01-01" })); assert.notEqual(run().status, 0);
  } finally { fs.rmSync(tmp, { recursive: true }); }
});
test("messages : 3 ans, Gmail annoncé, dans toutes les langues", () => {
  const k = "Si vous nous écrivez : votre adresse e-mail et votre message, reçus sur Gmail (Google) et gardés 3 ans.";
  assert.ok(html.includes(k));
  for (const f of DICTS) assert.match(JSON.parse(read("i18n/" + f))[k], /Gmail.*Google.*3|3.*Gmail.*Google/, f);
});
