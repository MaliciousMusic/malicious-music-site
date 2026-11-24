// Site servi par l'émulateur local de Cloudflare Pages, puis Chrome : node --test tests/served.test.mjs
import test, { before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import http from "node:http";
import { chrome, sleep } from "./cdp.mjs";

const root = new URL("..", import.meta.url).pathname, U = "http://localhost:8799/";
let srv, b;
const open = [];
afterEach(async () => { for (const p of open.splice(0)) await p.close(); });
const page = async (o) => { const p = await b.page(o); open.push(p); return p; };
before(async () => {
  execFileSync("python3", ["tools/build.py", "--draft"], { cwd: root });
  srv = spawn("wrangler", ["pages", "dev", "dist", "--port", "8799", "--ip", "127.0.0.1"], { cwd: root, detached: true, stdio: "ignore", env: { ...process.env, WRANGLER_SEND_METRICS: "false", CI: "1" } });
  for (let i = 0; i < 60; i++) { try { if ((await fetch(U)).ok) break; } catch {} await sleep(500); }
  b = await chrome();
});
after(() => { b?.close(); try { process.kill(-srv.pid); } catch {} });

test("en-têtes sur la page, les fichiers et la 404", async () => {
  for (const p of ["", "main.js", "styles.css", "i18n/en.json", "assets/favicon.png", "nope"]) {
    const h = (await fetch(U + p)).headers;
    assert.match(h.get("content-security-policy"), /^default-src 'none'.*frame-ancestors 'none'$/, p);
    assert.equal(h.get("strict-transport-security"), "max-age=31536000", p);
    assert.equal(h.get("x-content-type-options"), "nosniff", p);
    assert.equal(h.get("x-frame-options"), "DENY", p);
    assert.equal(h.get("referrer-policy"), "strict-origin-when-cross-origin", p);
    assert.match(h.get("permissions-policy"), /microphone=\(\)/, p);
    assert.equal(h.get("cross-origin-opener-policy"), "same-origin", p);
    assert.equal(h.get("cross-origin-resource-policy"), "same-origin", p);
    assert.equal(h.get("access-control-allow-origin"), null, p);
    assert.equal(h.get("set-cookie"), null, p);
  }
  assert.equal((await fetch(U + "assets/og.jpg")).headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.equal((await fetch(U)).headers.get("x-robots-tag"), "noindex");
});
test("rien d'autre n'est publié", async () => {
  for (const p of ["admin", "wp-admin", "dashboard", "api/admin", ".git/config", ".env", ".dev.vars", "debug", "graphql", "swagger", "server-status", "README.md", "tools/build.py", "tools/i18n_check.py", "design/blender/parts.py", "cloudflare/site.json", "wrangler.toml", "tests/cdp.mjs", "i18n/_source.json", ".claude/launch.json", "assets/hw/jog.png", "main.js.map", "nope/nope"])
    assert.equal((await fetch(U + p)).status, 404, p);
  assert.notEqual((await fetch(U + "_headers")).status, 200);   // l'émulateur répond 502
});
test("pas de redirection vers l'extérieur", async () => {
  for (const p of ["/evil.example", "%2f%2fevil.example", "\\evil.example", "?next=//evil.example", "?retour=https:evil.example", "%5c%5cevil.example/..", "index.html"]) {
    const l = (await fetch(U + p, { redirect: "manual" })).headers.get("location");
    if (l) assert.equal(new URL(l, U).host, "localhost:8799", p + " → " + l);
  }
});
test("Chrome : 22 langues, toutes les pages, aucune erreur, aucun tiers, aucun cookie", { timeout: 120000 }, async () => {
  const p = await page(); await p.goto(U, 5500);
  assert.equal(await p.ev("JSON.stringify(Object.keys(localStorage))"), "[]");
  const langs = JSON.parse(await p.ev("JSON.stringify(Object.keys(I18N.LANGS))"));
  assert.equal(langs.length, 22);
  for (const l of langs) {
    await p.ev(`I18N.set("${l}")`);
    assert.equal(await p.ev("document.documentElement.lang"), l);
    for (const v of ["home", "plugin", "tarif", "audioware", "pyramide", "faq", "contact", "legal"]) {
      await p.ev(`location.hash="${v}"`); await sleep(40);
      assert.equal(await p.ev("document.querySelector('.view.active').id"), v);
      const cut = await p.ev("[...document.querySelectorAll('.view.active .btn, .view.active .notice, .view.active .msg')].filter(e=>e.offsetParent&&(e.scrollWidth>e.clientWidth+2||e.getBoundingClientRect().right>document.getElementById('views').getBoundingClientRect().right)).map(e=>e.textContent).join()");
      assert.equal(cut, "", l + " " + v);
    }
  }
  await p.ev("location.hash='home'"); await p.ev("document.getElementById('demo-run').click()"); await sleep(2500);
  assert.deepEqual(p.log, []);
  assert.deepEqual(p.req.filter((r) => !r.startsWith("GET " + U)), []);
  assert.equal((await p.c("Network.getAllCookies")).cookies.length, 0);
});
test("adresse et mémoire piégées : rien ne s'exécute, langue connue", async () => {
  const p = await page();
  await p.goto(U + "#<img src=x onerror=window.pwn=1>", 1500);
  assert.equal(await p.ev("document.querySelector('.view.active').id + window.pwn"), "homeundefined");
  for (const bad of ["constructor", "__proto__", "../evil", "toString"]) {
    await p.ev(`localStorage.setItem("mm-lang", ${JSON.stringify(bad)})`); await p.goto(U, 1200);
    assert.equal(await p.ev("I18N.lang"), "fr", bad);
  }
  assert.ok(await p.ev("(() => { try { document.createElement('b').innerHTML = '<i></i>'; return false; } catch { return true; } })()"), "Trusted Types actifs");
  assert.ok(!p.log.some((l) => l.startsWith("EXC")));
});
test("langue introuvable : le texte affiché reste cohérent", async () => {
  const p = await page(); await p.goto(U, 1500);
  await p.c("Network.setBlockedURLs", { urls: ["*i18n/de.json*"] });
  await p.ev(`I18N.set("de", true)`);
  assert.equal(await p.ev("document.documentElement.lang"), "fr");
});
test("formulaire : aucune requête, aucune donnée", async () => {
  const p = await page(); await p.goto(U + "#contact", 5500);
  const n = p.req.length;
  await p.ev("document.querySelector('form.signup').requestSubmit?.call(document.querySelector('form.signup'))").catch(() => {});
  await sleep(400);
  assert.deepEqual(p.req.slice(n).filter((r) => !r.startsWith("GET " + U + "i18n")), []);
  assert.ok(await p.ev("[...document.querySelectorAll('form.signup input, form.signup select, form.signup button')].every(e => e.disabled)"));
});
test("sans JavaScript : accueil, tarif et textes légaux lisibles", async () => {
  for (const o of [{ w: 1280, h: 800 }, { w: 390, h: 844, mobile: true }]) {
    const p = await page({ js: false, ...o }); await p.goto(U + "#mentions", 1500);
    const { nodes } = await p.c("Accessibility.getFullAXTree");
    const txt = nodes.map((n) => n.name?.value || "").join("\n");
    for (const s of ["MENTIONS LÉGALES", "POLITIQUE DE CONFIDENTIALITÉ", "Rien n'est encore en vente", "MALICIOUSMUSIC"]) assert.ok(txt.includes(s), s);
  }
});
test("écran lisible en petite fenêtre et au zoom 400 %", async () => {
  for (const [w, h] of [[320, 256], [640, 400], [844, 390], [390, 844], [320, 568]]) {
    for (const q of open.splice(0)) await q.close();
    const p = await page({ w, h }); await p.goto(U, 2500);
    const r = await p.ev("document.getElementById('views').clientHeight"), x = await p.ev("document.documentElement.scrollWidth - innerWidth");
    assert.ok(r >= 150, `${w}x${h} : ${r}px`); assert.ok(x <= 0, `${w}x${h} débordement ${x}`);
  }
});
test("clavier : focus visible partout, tout élément a un nom, langues au clavier", async () => {
  const p = await page(); await p.goto(U, 6000);
  for (let i = 0; i < 40; i++) {
    await p.key("Tab");
    const s = await p.ev("(()=>{const e=document.activeElement;if(e===document.body)return 'fin';const c=getComputedStyle(e);return (e.offsetWidth>0&&c.visibility!=='hidden'&&c.outlineStyle!=='none')?'ok':'KO '+e.outerHTML.slice(0,80)})()");
    if (s === "fin") break; assert.equal(s, "ok");
  }
  await p.ev("document.getElementById('lang-btn').click()"); await p.key("ArrowDown", "ArrowDown", 40); await p.key("Escape", "Escape", 27);
  assert.equal(await p.ev("document.activeElement.id + document.getElementById('lang-pop').hidden"), "lang-btntrue");
  const { nodes } = await p.c("Accessibility.getFullAXTree");
  assert.deepEqual(nodes.filter((n) => !n.ignored && ["button", "link", "textbox", "combobox", "slider", "checkbox", "radio", "option"].includes(n.role?.value) && !(n.name?.value || "").trim()).map((n) => n.role.value), []);
});
test("mouvement réduit : aucune animation sans fin", async () => {
  const p = await page({ reduce: true }); await p.goto(U, 5500);
  assert.equal(await p.ev("document.getAnimations().filter(a => a.effect.getTiming().iterations === Infinity && a.playState === 'running').map(a => a.animationName).join()"), "");
});
test("cadre d'un autre site refusé", async () => {
  const host = http.createServer((q, r) => { r.setHeader("content-type", "text/html"); r.end(`<iframe src="${U}"></iframe>`); }).listen(8798, "127.0.0.1");
  try {
    const p = await page(); await p.goto("http://127.0.0.1:8798/", 2000);
    const { frameTree } = await p.c("Page.getFrameTree");
    assert.equal(frameTree.frame.url, "http://127.0.0.1:8798/");
    assert.ok(p.log.some((l) => /frame-ancestors|X-Frame-Options|ERR_BLOCKED_BY_RESPONSE/.test(l)) || frameTree.childFrames?.[0].frame.unreachableUrl, JSON.stringify([p.log, frameTree.childFrames]));
  } finally { host.close(); }
});
