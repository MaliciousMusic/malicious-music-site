// anti-clickjacking : le site refuse d'être affiché dans un cadre d'un autre site
if (window.top !== window.self) { try { window.top.location = window.self.location.href; } catch (e) { document.documentElement.style.display = "none"; } }
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
const INK = "38,51,44";
const allCanvases = [...document.querySelectorAll("canvas:not([data-demo-roll])")];

// Models are drawn at low resolution and scaled up: real dot-matrix pixels
function fit(c) {
  const k = c.dataset.model ? Math.min(dpr(), 1.5) : 0.5;
  const w = Math.max(1, Math.round(c.clientWidth * k));
  const h = Math.max(1, Math.round(c.clientHeight * k));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
}

// Only animate what is on screen
const visible = new Set(allCanvases);
if ("IntersectionObserver" in window) {
  visible.clear();
  const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))));
  allCanvases.forEach((c) => io.observe(c));
}

// ---------------------------------------------------------
// Views: the frame's keys switch what the screen shows
// ---------------------------------------------------------
const order = ["home", "plugin", "tarif", "audioware", "faq", "contact", "legal"];
const names = { home: "ACCUEIL", plugin: "PLUGIN", tarif: "TARIF", audioware: "AUDIOWARE", faq: "FAQ", contact: "CONTACT", legal: "INFOS LÉGALES", pyramide: "LA PYRAMIDE", geants: "LES GÉANTS", casque: "LE CASQUE" };
// pages produit : rangées sous Audioware dans la navigation
const parentOf = { pyramide: "audioware", geants: "audioware", casque: "audioware" };
const slot = (id) => order.indexOf(parentOf[id] || id);
const scroller = document.getElementById("views");
const stTitle = document.getElementById("st-title");
const readout = document.getElementById("readout");
const device = document.getElementById("device");
const glassEl = document.getElementById("glass");
let current = "home";

// ---------------------------------------------------------
// Chassis: chrome body drawn edge to edge around the screen
// ---------------------------------------------------------
// n = encoche en U qui descend dans le haut de l'écran : { cx, hw (demi-largeur du fond), depth }
function hole(x, y, w, h, n, jb) {
  const r = Math.min(54, w * 0.09, h * 0.14);
  const bw = Math.min(12, w * 0.016), bt = Math.min(14, h * 0.03), bb = Math.min(26, h * 0.055);
  const f = (v) => v.toFixed(1);
  // morsure : le coin bas-gauche de l'écran contourne la molette (cercle jb = {cx, cy, r})
  let bite = null;
  if (jb) {
    const yb = y + h, xl = x + bw, dy = yb - jb.cy, dx = xl - jb.cx;
    if (Math.abs(dy) < jb.r && Math.abs(dx) < jb.r) {
      const i1 = { x: jb.cx + Math.sqrt(jb.r * jb.r - dy * dy), y: yb };   // sortie sur le bord bas
      const i2 = { x: xl, y: jb.cy - Math.sqrt(jb.r * jb.r - dx * dx) };   // sortie sur le bord gauche
      if (i2.y < yb - 4 && i1.x > xl + 4 && i2.y > y + r) {
        const fl = Math.min(18, jb.r * 0.16);                                // congés de raccord
        const t1 = Math.atan2(i1.y - jb.cy, i1.x - jb.cx) - fl / jb.r;
        const t2 = Math.atan2(i2.y - jb.cy, i2.x - jb.cx) + fl / jb.r;
        const p = (t) => ({ x: jb.cx + jb.r * Math.cos(t), y: jb.cy + jb.r * Math.sin(t) });
        bite = { i1, i2, a1: p(t1), a2: p(t2), r: jb.r, fl };
      }
    }
  }
  let top;
  if (n) {
    const yt = y + bt, yb = yt + n.depth, k = n.depth * 1.7;   // k : longueur des épaules de l'encoche
    const a = n.cx - n.hw, b = n.cx + n.hw;
    top = [
      `L${f(a - k)} ${f(yt)}`,
      `C${f(a - k * 0.35)} ${f(yt)} ${f(a - k * 0.45)} ${f(yb)} ${f(a)} ${f(yb)}`,
      // fond de l'encoche : épouse l'arc du titre (plus haut au centre, plus bas sous les extrémités)
      n.r ? `A${f(n.r)} ${f(n.r)} 0 0 1 ${f(b)} ${f(yb)}` : `L${f(b)} ${f(yb)}`,
      `C${f(b + k * 0.45)} ${f(yb)} ${f(b + k * 0.35)} ${f(yt)} ${f(b + k)} ${f(yt)}`,
      `L${f(x + w - bw - r)} ${f(yt)}`,
    ].join("");
  } else {
    top = `Q${f(x + w / 2)} ${f(y - bt)} ${f(x + w - bw - r)} ${f(y + bt)}`;
  }
  return [
    `M${f(x + bw + r)} ${f(y + bt)}`,
    top,
    `Q${f(x + w - bw)} ${f(y + bt)} ${f(x + w - bw)} ${f(y + bt + r)}`,
    `Q${f(x + w + bw)} ${f(y + h / 2)} ${f(x + w - bw)} ${f(y + h - r)}`,
    `Q${f(x + w - bw)} ${f(y + h)} ${f(x + w - bw - r)} ${f(y + h)}`,
    ...(bite ? [
      `Q${f((x + w - bw - r + bite.i1.x + bite.fl) / 2)} ${f(y + h - 2 * bb)} ${f(bite.i1.x + bite.fl)} ${f(y + h)}`,
      `Q${f(bite.i1.x)} ${f(bite.i1.y)} ${f(bite.a1.x)} ${f(bite.a1.y)}`,
      `A${f(bite.r)} ${f(bite.r)} 0 0 0 ${f(bite.a2.x)} ${f(bite.a2.y)}`,
      `Q${f(bite.i2.x)} ${f(bite.i2.y)} ${f(x + bw)} ${f(bite.i2.y - bite.fl)}`,
      `Q${f(x - bw)} ${f((bite.i2.y - bite.fl + y + bt + r) / 2)} ${f(x + bw)} ${f(y + bt + r)}`,
    ] : [
      `Q${f(x + w / 2)} ${f(y + h - 2 * bb)} ${f(x + bw + r)} ${f(y + h)}`,
      `Q${f(x + bw)} ${f(y + h)} ${f(x + bw)} ${f(y + h - r)}`,
      `Q${f(x - bw)} ${f(y + h / 2)} ${f(x + bw)} ${f(y + bt + r)}`,
    ]),
    `Q${f(x + bw)} ${f(y + bt)} ${f(x + bw + r)} ${f(y + bt)}Z`,
  ].join("");
}
function layout() {
  const d = device.getBoundingClientRect(), g = glassEl.getBoundingClientRect();
  const W = d.width, H = d.height, x = g.left - d.left, y = g.top - d.top;
  const tp = document.getElementById("title-plate").getBoundingClientRect();
  const bt = Math.min(14, g.height * 0.03);
  // le titre est courbé (Blender) sur un cercle de rayon 1,9 × sa largeur : le fond de l'encoche
  // suit un cercle concentrique, décalé de la marge, pour que les deux courbes soient parallèles
  const m = 20, R = tp.width * 1.9, Rn = R - m, hw = tp.width / 2 + 26;
  const dropT = R - Math.sqrt(R * R - (tp.width / 2) ** 2);       // descente du bas du titre à ses extrémités
  const dropN = Rn - Math.sqrt(Rn * Rn - hw * hw);                  // descente du fond de l'encoche à ses extrémités
  const yc = tp.bottom - d.top - dropT + m;                         // fond de l'encoche sous le centre du titre
  const notch = { cx: tp.left - d.left + tp.width / 2, hw, depth: Math.max(24, yc + dropN - (y + bt)), r: Rn };
  const shifted = (dx, dy, extra = 0) => ({ cx: notch.cx + dx, hw: notch.hw + extra, depth: notch.depth + extra });
  const jr = document.querySelector(".console > .jog").getBoundingClientRect();
  const jog = { cx: jr.left - d.left + jr.width / 2, cy: jr.top - d.top + jr.height / 2, r: jr.width * 0.5 + 12 };
  const inner = hole(x, y, g.width, g.height, notch, jog);
  // hauteur mangée par la molette dans le coin bas-gauche : le contenu de l'écran s'arrête au-dessus
  // le trait sous la barre de statut s'interrompt là où il rencontre l'encoche du titre
  {
    const st = glassEl.querySelector(".status"), ly = st.offsetHeight - 1;              // y du trait (repère de l'écran)
    const yt = bt, yb = bt + notch.depth, k = notch.depth * 1.7, a = notch.cx - x - notch.hw;
    const bz = (t, p0, p1, p2, p3) => ((1 - t) ** 3) * p0 + 3 * ((1 - t) ** 2) * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3;
    let cross = a;
    for (let t = 0; t <= 1; t += 0.005) {                                              // épaule gauche de l'encoche
      if (bz(t, yt, yt, yb, yb) >= ly) { cross = bz(t, a - k, a - k * 0.35, a - k * 0.45, a); break; }
    }
    const gap = Math.max(0, notch.cx - x - cross) + 8;
    st.style.setProperty("--gap-l", Math.max(0, notch.cx - x - gap).toFixed(1) + "px");
    st.style.setProperty("--gap-r", Math.max(0, g.width - (notch.cx - x + gap)).toFixed(1) + "px");
  }
  glassEl.style.setProperty("--bite", Math.max(0, Math.round(y + g.height - (jog.cy - jog.r))) + "px");
  ["chassis", "bezel"].forEach((id) => document.getElementById(id).setAttribute("viewBox", `0 0 ${W} ${H}`));
  const body = `M0 0H${W}V${H}H0Z` + inner;
  document.getElementById("body").setAttribute("d", body);
  document.getElementById("body-sheen").setAttribute("d", body);
  document.getElementById("body-shade").setAttribute("d", body);
  const pat = document.getElementById("p-plate"), img = document.getElementById("plate-img");
  [pat, img].forEach((el) => { el.setAttribute("width", W); el.setAttribute("height", H); });
  document.getElementById("rim").setAttribute("d", inner);
  document.getElementById("rim-hi").setAttribute("d", hole(x - 4, y - 4, g.width + 8, g.height + 8, { ...notch, hw: notch.hw - 4, depth: notch.depth - 4 }, { ...jog, r: jog.r - 4 }));
  glassEl.style.clipPath = `path('${hole(0, 0, g.width, g.height, { ...notch, cx: notch.cx - x }, { cx: jog.cx - x, cy: jog.cy - y, r: jog.r })}')`;
}
layout();
if ("ResizeObserver" in window) new ResizeObserver(layout).observe(device); else window.addEventListener("resize", layout);
if (document.fonts) document.fonts.ready.then(layout);

// ---------------------------------------------------------
// Position bar + scroll pills
// ---------------------------------------------------------
const posTrack = document.getElementById("pos-track");
function updatePos() {
  const max = scroller.scrollHeight - scroller.clientHeight;
  posTrack.style.setProperty("--p", max > 0 ? (scroller.scrollTop / max).toFixed(4) : 0);
}
scroller.addEventListener("scroll", () => { if (!posTrack.classList.contains("dragging")) updatePos(); }, { passive: true });
// Glisser : la tirette suit le doigt ou la souris sans sauter, la page ne défile pas pendant le geste
(function () {
  const thumb = posTrack.querySelector("i");
  let grab = null; // décalage entre le pointeur et le centre de la tirette
  const seek = (clientX) => {
    const r = posTrack.getBoundingClientRect(), tw = thumb.offsetWidth;
    const p = Math.min(1, Math.max(0, (clientX - grab - r.left - tw / 2) / (r.width - tw)));
    posTrack.style.setProperty("--p", p.toFixed(4));
    scroller.scrollTop = p * (scroller.scrollHeight - scroller.clientHeight);
  };
  posTrack.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const t = thumb.getBoundingClientRect();
    grab = e.target === thumb ? e.clientX - (t.left + t.width / 2) : 0;
    posTrack.setPointerCapture(e.pointerId);
    posTrack.classList.add("dragging");
    seek(e.clientX);
  });
  posTrack.addEventListener("pointermove", (e) => { if (grab !== null) seek(e.clientX); });
  const stop = () => { grab = null; posTrack.classList.remove("dragging"); };
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => posTrack.addEventListener(ev, stop));
})();
document.getElementById("up").addEventListener("click", () => scroller.scrollBy({ top: -scroller.clientHeight * 0.7, behavior: "smooth" }));
document.getElementById("down").addEventListener("click", () => scroller.scrollBy({ top: scroller.clientHeight * 0.7, behavior: "smooth" }));

// ---------------------------------------------------------
// Backlight knob
// ---------------------------------------------------------
const knob = document.getElementById("backlight");
(function () {
  const set = (v) => {
    v = Math.min(1, Math.max(0, v));
    knob.dataset.v = v;
    knob.style.setProperty("--a", v * 270 - 135 + "deg");
    knob.setAttribute("aria-valuenow", Math.round(v * 100));
    glassEl.style.setProperty("--bl", (0.55 + v * 0.65).toFixed(3));
  };
  set(1); // rétroéclairage au maximum par défaut
  let y0 = null, v0 = 0;
  knob.addEventListener("pointerdown", (e) => { knob.setPointerCapture(e.pointerId); y0 = e.clientY; v0 = +knob.dataset.v; e.preventDefault(); });
  knob.addEventListener("pointermove", (e) => { if (y0 !== null) set(v0 + (y0 - e.clientY) / 160); });
  ["pointerup", "pointercancel"].forEach((ev) => knob.addEventListener(ev, () => (y0 = null)));
  knob.addEventListener("keydown", (e) => {
    const d = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05 }[e.key];
    if (d) { set(+knob.dataset.v + d); e.preventDefault(); }
  });
})();

function show(hash) {
  const target = hash && document.getElementById(hash);
  const view = target && target.closest(".view");
  const id = view ? view.dataset.view : "home";
  if (id !== current || !document.querySelector(".view.active")) {
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.dataset.view === id));
    current = id;
    scroller.scrollTop = 0;
  }
  document.querySelectorAll("[data-key]").forEach((k) => (k.dataset.key === (parentOf[id] || id) ? k.setAttribute("aria-current", "page") : k.removeAttribute("aria-current")));
  stTitle.textContent = slot(id) + 1 + ". " + I18N.t(names[id]);
  readout.textContent = String(slot(id) + 1).padStart(2, "0") + " " + I18N.t(names[id]);
  updatePos();
  const nm = I18N.t(names[id]);
  document.title = (id === "home" ? "" : nm.charAt(0) + nm.slice(1).toLowerCase() + " — ") + "Malicious Music";
  if (target && target !== view) target.scrollIntoView({ block: "start" });
}
window.addEventListener("hashchange", () => {
  show(location.hash.slice(1));
  // lecteurs d'écran / clavier : le focus suit la page affichée
  if (!document.activeElement || !document.activeElement.closest(".views")) scroller.focus({ preventScroll: true });
});
show(location.hash.slice(1));

const step = (d) => { location.hash = order[(slot(current) + d + order.length) % order.length]; };
document.getElementById("prev").addEventListener("click", () => step(-1));
document.getElementById("next").addEventListener("click", () => step(1));
document.querySelectorAll('a[href="#"]').forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));

// ---------------------------------------------------------
// Power-on splash
// ---------------------------------------------------------
const glass = document.getElementById("glass");
const power = document.getElementById("power");
const led = document.getElementById("led");
let bootTimer = null;
function endBoot() {
  clearTimeout(bootTimer);
  if (!glass.classList.contains("booting")) return;
  glass.classList.remove("booting");
  const v = document.querySelector(".view.active");
  if (v) { v.classList.remove("active"); void v.offsetWidth; v.classList.add("active"); }
}
function boot() {
  glass.classList.remove("off");
  glass.classList.remove("booting"); void glass.offsetWidth;
  glass.classList.add("booting");
  bootTimer = setTimeout(endBoot, 3800);
}
glass.addEventListener("pointerdown", endBoot);
window.addEventListener("keydown", endBoot);
function togglePower() {
  const on = power.getAttribute("aria-pressed") !== "true";
  power.setAttribute("aria-pressed", String(on));
  led.classList.toggle("on", on);
  if (on) boot(); else { clearTimeout(bootTimer); glass.classList.remove("booting"); glass.classList.add("off"); }
}
power.addEventListener("click", togglePower);
document.getElementById("power-x").addEventListener("click", togglePower);
// À l'ouverture : écran éteint, puis on « appuie » sur POWER et l'appareil démarre
glass.classList.add("off");
setTimeout(() => power.classList.add("blink"), 350);
setTimeout(() => { power.classList.remove("blink"); togglePower(); }, 1300);

// ---------------------------------------------------------
// Player state (LCD spectrum + stem mixer)
// ---------------------------------------------------------
const DURATION = 196; // 3:16
const player = { playing: true, pos: 0 };
const strips = [...document.querySelectorAll(".strip")].map((el) => ({ el, lv: el.querySelector(".lv"), m: el.querySelector(".m"), s: el.querySelector(".s") }));
const pressed = (b) => b.getAttribute("aria-pressed") === "true";
function stemLevel(i) {
  const st = strips[i];
  if (!st) return 0;
  const anySolo = strips.some((x) => pressed(x.s));
  const silent = pressed(st.m) || (anySolo && !pressed(st.s));
  st.el.classList.toggle("is-muted", silent);
  return silent ? 0 : st.lv.value / 100;
}
strips.forEach((st) => [st.m, st.s].forEach((b) => b.addEventListener("click", () => b.setAttribute("aria-pressed", String(!pressed(b))))));

const playBtn = document.getElementById("t-play");
const syncPlay = () => { playBtn.textContent = I18N.t(player.playing ? "PAUSE" : "PLAY ▶"); playBtn.setAttribute("aria-pressed", String(player.playing)); };
playBtn.addEventListener("click", () => { player.playing = !player.playing; syncPlay(); });
document.getElementById("t-stop").addEventListener("click", () => { player.playing = false; player.pos = 0; syncPlay(); });
document.getElementById("t-rew").addEventListener("click", () => { player.pos = 0; });

// ---------------------------------------------------------
// Home: stems as LCD bars
// ---------------------------------------------------------
const profiles = {
  mix:   { freq: 0.9,  amp: 1.0,  noise: 0.6 },
  vox:   { freq: 0.35, amp: 0.8,  noise: 0.25 },
  drums: { freq: 2.2,  amp: 0.9,  noise: 0.9 },
  bass:  { freq: 0.18, amp: 0.7,  noise: 0.1 },
  other: { freq: 0.6,  amp: 0.55, noise: 0.4 },
};
function drawWave(c, t) {
  const ctx = c.getContext("2d");
  const p = profiles[c.dataset.wave] || profiles.mix;
  const { width: w, height: h } = c;
  ctx.clearRect(0, 0, w, h);
  const cell = 3, bars = Math.max(16, Math.floor(w / cell)), rows = Math.max(3, Math.floor(h / cell));
  const bw = w / bars, rh = h / rows, d = Math.min(bw, rh) * 0.74;
  for (let i = 0; i < bars; i++) {
    const x = i / bars;
    const v = Math.abs(Math.sin(x * 12 * p.freq + t * 0.0012)) * (1 - p.noise) + Math.abs(Math.sin(i * 1.7 + t * 0.004 * p.freq)) * p.noise;
    const lit = Math.max(1, Math.round(v * p.amp * rows));
    const first = Math.floor((rows - lit) / 2);
    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = r >= first && r < first + lit ? `rgba(${INK},.92)` : `rgba(${INK},.08)`;
      ctx.fillRect(i * bw + (bw - d) / 2, r * rh + (rh - d) / 2, d, d);
    }
  }
}

// ---------------------------------------------------------
// Plugin: dot-matrix spectrum (4 stems x 8 columns)
// ---------------------------------------------------------
const COLS = 32, ROWS = 12;
const levels = new Array(COLS).fill(0), peaks = new Array(COLS).fill(0);
const stemFreq = [0.9, 2.6, 0.5, 1.3];
function drawLcd(c, t) {
  const ctx = c.getContext("2d");
  const { width: w, height: h } = c;
  ctx.clearRect(0, 0, w, h);
  const cw = w / COLS, rh = h / ROWS, d = Math.min(cw, rh) * 0.72;
  for (let i = 0; i < COLS; i++) {
    const s = Math.floor(i / 8), lv = stemLevel(s), f = stemFreq[s];
    let target = 0;
    if (player.playing) {
      target = lv * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.003 * f + i * 0.9) * Math.sin(t * 0.0011 * f + i * 2.3)));
      target *= 0.75 + 0.25 * Math.sin(i * 12.9898 + Math.floor(t / 90));
    }
    levels[i] += (target - levels[i]) * 0.25;
    peaks[i] = Math.max(peaks[i] - 0.006, levels[i]);
    const lit = Math.round(levels[i] * ROWS), pk = Math.round(peaks[i] * ROWS);
    for (let r = 0; r < ROWS; r++) {
      const on = r < lit || (r === pk && pk > 0);
      ctx.fillStyle = on ? `rgba(${INK},.92)` : `rgba(${INK},.09)`;
      ctx.fillRect(i * cw + (cw - d) / 2, h - (r + 1) * rh + (rh - d) / 2, d, d);
    }
  }
}
const timeEl = document.getElementById("lcd-time"), progEl = document.getElementById("lcd-prog");

// ---------------------------------------------------------
// Audioware: wireframe 3D models
// ---------------------------------------------------------
function circle(lines, c, u, v, r, n = 28, a0 = 0, a1 = Math.PI * 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([c[0] + r * (u[0] * Math.cos(a) + v[0] * Math.sin(a)), c[1] + r * (u[1] * Math.cos(a) + v[1] * Math.sin(a)), c[2] + r * (u[2] * Math.cos(a) + v[2] * Math.sin(a))]);
  }
  lines.push(pts);
}
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];

function buildPyramid() {
  const L = [];
  const w = (y) => (1.25 - y) / 2.25; // half-width at height y (apex at y = 1.25)
  const ring = (y) => { const a = w(y); L.push([[-a, y, -a], [a, y, -a], [a, y, a], [-a, y, a], [-a, y, -a]]); };
  const top = 0.55, shelf = -0.35;
  ring(-1); ring(shelf); ring(top);
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => L.push([[sx * w(-1), -1, sz * w(-1)], [sx * w(top), top, sz * w(top)]]));
  // platine au sommet
  circle(L, [0, top + 0.03, 0], X, Z, w(top) * 0.82);
  circle(L, [0, top + 0.03, 0], X, Z, w(top) * 0.3, 14);
  L.push([[w(top) * 0.95, top + 0.03, -w(top) * 0.9], [w(top) * 0.95, top + 0.12, -w(top) * 0.6], [w(top) * 0.35, top + 0.06, w(top) * 0.2]]);
  // vinyles rangés dans la base
  for (let f = -0.7; f <= 0.71; f += 0.2) {
    L.push([[f * w(-1), -1, w(-1)], [f * w(shelf), shelf, w(shelf)]]);
    L.push([[f * w(-1), -1, -w(-1)], [f * w(shelf), shelf, -w(shelf)]]);
  }
  // enceinte sur les faces latérales
  const sl = Math.hypot(1, 2.25), vy = [-1 / sl, 2.25 / sl, 0];
  [1, -1].forEach((s) => {
    const cy = -0.68, c = [s * w(cy), cy, 0], v = [s * vy[0], vy[1], 0];
    circle(L, c, Z, v, 0.24); circle(L, c, Z, v, 0.1, 14);
  });
  // sommet
  L.push([[-w(top), top, -w(top)], [0, 1.25, 0], [w(top), top, w(top)]]);
  L.push([[w(top), top, -w(top)], [0, 1.25, 0], [-w(top), top, w(top)]]);
  return L;
}
function buildBuds() {
  const L = [];
  [-0.58, 0.58].forEach((cx) => {
    const c = [cx, 0.42, 0], r = 0.44;
    circle(L, c, X, Y, r); circle(L, c, Z, Y, r); circle(L, c, X, Z, r);
    circle(L, [cx, 0.42, r], X, Y, 0.2, 18);
    const sr = 0.13;
    circle(L, [cx, 0.05, 0], X, Z, sr, 14); circle(L, [cx, -1, 0], X, Z, sr, 14);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; L.push([[cx + sr * Math.cos(a), 0.05, sr * Math.sin(a)], [cx + sr * Math.cos(a), -1, sr * Math.sin(a)]]); }
    circle(L, [cx, -1, 0], X, Z, sr * 1.9, 16);
  });
  return L;
}
function buildPhones() {
  const L = [];
  [-0.09, 0.09].forEach((z) => circle(L, [0, -0.05, z], X, Y, 0.82, 26, 0, Math.PI));
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI; L.push([[0.82 * Math.cos(a), -0.05 + 0.82 * Math.sin(a), -0.09], [0.82 * Math.cos(a), -0.05 + 0.82 * Math.sin(a), 0.09]]); }
  [-1, 1].forEach((s) => {
    const xi = s * 0.66, xo = s * 0.96, cy = -0.3, r = 0.42;
    circle(L, [xi, cy, 0], Y, Z, r); circle(L, [xo, cy, 0], Y, Z, r * 0.9); circle(L, [xo + s * 0.02, cy, 0], Y, Z, r * 0.45, 16);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; L.push([[xi, cy + r * Math.cos(a), r * Math.sin(a)], [xo, cy + r * 0.9 * Math.cos(a), r * 0.9 * Math.sin(a)]]); }
    L.push([[xo + s * 0.03, cy + 0.14, -0.04], [xo + s * 0.03, cy, 0.06], [xo + s * 0.03, cy, -0.06], [xo + s * 0.03, cy - 0.14, 0.04]]);
    L.push([[s * 0.82, -0.05, 0], [s * 0.82, cy + r * 0.2, 0]]);
  });
  return L;
}
const models = { pyramid: buildPyramid(), buds: buildBuds(), phones: buildPhones() };
// visionneuse 3D interactive des pages produit : glisser pour tourner, molette / pincement pour zoomer
document.querySelectorAll("canvas[data-orbit]").forEach((c) => {
  const v = (c._orbit = { ay: 0.6, ax: 0.36, zoom: 1, vy: 0, idle: 0 });
  const pts = new Map();
  let last = null, pinch = 0;
  c.addEventListener("pointerdown", (e) => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); last = [e.clientX, e.clientY]; v.vy = 0; v.held = true; v.idle = performance.now(); e.preventDefault(); });
  c.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) v.zoom = Math.min(2.2, Math.max(0.6, v.zoom * (d / pinch)));
      pinch = d; return;
    }
    const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY];
    v.ay += dx * 0.012; v.vy = dx * 0.012;
    v.ax = Math.min(1.25, Math.max(-0.35, v.ax + dy * 0.008));
    v.idle = performance.now();
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; v.held = pts.size > 0; if (pts.size) last = [...pts.values()][0]; };
  ["pointerup", "pointercancel"].forEach((ev) => c.addEventListener(ev, up));
  c.addEventListener("wheel", (e) => { e.preventDefault(); v.zoom = Math.min(2.2, Math.max(0.6, v.zoom * Math.exp(-e.deltaY * 0.0015))); v.idle = performance.now(); }, { passive: false });
  c.addEventListener("dblclick", () => { v.zoom = 1; v.ax = 0.36; });
});
function drawModel(c, t) {
  const v = c._orbit;
  if (v) {
    if (!v.held) { v.ay += v.vy; v.vy *= 0.94; }            // inertie
    if (performance.now() - v.idle > 2500) v.ay += 0.004;                  // reprend sa rotation tout seul
  }
  if (window.MM3D) return window.MM3D.draw(c, t, c.dataset.model, v);
  const ctx = c.getContext("2d");
  const { width: w, height: h } = c;
  ctx.clearRect(0, 0, w, h);
  const ay = t * 0.0006, ax = 0.32;
  const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
  const scale = Math.min(w, h) * 0.33, cam = 4.2;
  ctx.strokeStyle = `rgb(${INK})`; ctx.lineWidth = 1.15; ctx.lineJoin = "round";
  ctx.beginPath();
  for (const line of models[c.dataset.model]) {
    for (let i = 0; i < line.length; i++) {
      const [x0, y0, z0] = line[i];
      const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy;
      const y2 = y0 * cx - z1 * sx, z2 = y0 * sx + z1 * cx;
      const k = cam / (cam + z2);
      const px = w / 2 + x1 * k * scale, py = h * 0.45 - (y2 - 0.1) * k * scale;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
  }
  ctx.stroke();
}

// ---------------------------------------------------------
// Main loop
// ---------------------------------------------------------
let last = performance.now();
function frame(t) {
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  if (player.playing) player.pos = (player.pos + dt) % DURATION;
  const s = Math.floor(player.pos);
  timeEl.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  progEl.style.width = (player.pos / DURATION) * 100 + "%";
  for (const c of visible) {
    if (!c.clientWidth) continue;
    fit(c);
    if (c.dataset.wave) drawWave(c, t);
    else if (c.hasAttribute("data-lcd")) drawLcd(c, t);
    else if (c.dataset.model) drawModel(c, t);
  }
  if (!reduceMotion) requestAnimationFrame(frame);
}
if (reduceMotion) {
  const still = () => { allCanvases.forEach((c) => visible.add(c)); frame(performance.now() + 4000); };
  still(); window.addEventListener("resize", still); window.addEventListener("hashchange", () => setTimeout(still, 50));
} else requestAnimationFrame(frame);

// Newsletter (placeholder, rien n'est envoyé)
document.querySelectorAll("form.signup").forEach((f) =>
  f.addEventListener("submit", (e) => { e.preventDefault(); f.querySelector(".msg").hidden = false; f.reset(); })
);
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

// ---------------------------------------------------------
// Stylet : remplace le curseur de la souris (pas sur écran tactile)
// ---------------------------------------------------------
const stylus = document.getElementById("stylus");
if (window.matchMedia("(pointer: fine)").matches) {
  document.documentElement.classList.add("stylus-on");
  const isPen = (e) => e.pointerType === "mouse" || e.pointerType === "pen";
  window.addEventListener("pointermove", (e) => {
    if (!isPen(e)) return;
    stylus.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    stylus.classList.add("show");
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => stylus.classList.remove("show"));
  window.addEventListener("pointerdown", (e) => { if (isPen(e)) stylus.classList.add("down"); });
  ["pointerup", "pointercancel"].forEach((ev) => window.addEventListener(ev, () => stylus.classList.remove("down")));
}

// ---------------------------------------------------------
// Écran tactile : marque d'appui, glisser pour défiler
// ---------------------------------------------------------
function tapMark(x, y) {
  const r = glassEl.getBoundingClientRect();
  const m = document.createElement("span");
  m.className = "tap hold";
  m.style.left = x - r.left + "px";
  m.style.top = y - r.top + "px";
  glassEl.appendChild(m);
  return m;
}

let touch = null, glide = 0, swallowClick = false;
glassEl.addEventListener("pointerdown", (e) => {
  if (e.button > 0 || glassEl.classList.contains("off") || glassEl.classList.contains("booting")) return;
  const field = e.target.closest("input, select, textarea, label, summary, [data-orbit], .lang-pop");
  cancelAnimationFrame(glide);
  touch = {
    id: e.pointerId, x: e.clientX, y: e.clientY, y0: e.clientY, top0: scroller.scrollTop,
    scroll: e.pointerType !== "touch" && !field, moved: false, v: 0, t: performance.now(),
    mark: tapMark(e.clientX, e.clientY),
  };
});
window.addEventListener("pointermove", (e) => {
  if (!touch || e.pointerId !== touch.id) return;
  touch.mark.style.left = e.clientX - glassEl.getBoundingClientRect().left + "px";
  touch.mark.style.top = e.clientY - glassEl.getBoundingClientRect().top + "px";
  if (touch.scroll) {
    const dy = e.clientY - touch.y0;
    if (!touch.moved && Math.abs(dy) > 6) {
      touch.moved = true;
      glassEl.setPointerCapture(e.pointerId);
      glassEl.classList.add("scrolling");
    }
    if (touch.moved) {
      const now = performance.now();
      const prev = scroller.scrollTop;
      scroller.scrollTop = touch.top0 - dy;
      touch.v = 0.8 * touch.v + 0.2 * ((scroller.scrollTop - prev) / Math.max(1, now - touch.t));
      touch.t = now;
    }
  }
  touch.x = e.clientX; touch.y = e.clientY;
});
function release(e) {
  if (!touch || (e && e.pointerId !== touch.id)) return;
  const m = touch.mark;
  m.classList.remove("hold");
  m.addEventListener("animationend", () => m.remove());
  if (touch.moved) {
    swallowClick = true;
    glassEl.classList.remove("scrolling");
    let v = Math.max(-2.2, Math.min(2.2, touch.v)) * 16;
    const step = () => {
      if (Math.abs(v) < 0.4) return;
      scroller.scrollTop += v; v *= 0.93;
      glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  }
  touch = null;
}
window.addEventListener("pointerup", release);
window.addEventListener("pointercancel", release);
// un glisser n'est pas un clic : on ne suit pas le lien sous le stylet
glassEl.addEventListener("click", (e) => {
  if (swallowClick) { e.preventDefault(); e.stopPropagation(); swallowClick = false; }
}, true);
window.addEventListener("pointerdown", () => { swallowClick = false; }, true);

// ---------------------------------------------------------
// Charms au bout du stylet : cordons souples (Verlet) et charms lourds qui se cognent
// ---------------------------------------------------------
(function () {
  const box = document.getElementById("charms");
  if (!box) return;
  if (!document.documentElement.classList.contains("stylus-on")) { box.hidden = true; return; }
  const END = [0.8529, -0.8561];          // bout arrière du stylet par rapport à la pointe (× taille du stylet)
  const cordEls = [...box.querySelectorAll(".cord")], shadowEls = [...box.querySelectorAll(".cord-shadow")];
  const loopEl = box.querySelector(".loop"), knotEl = box.querySelector(".knot");
  const G = 3000, DRAG = 0.982, SUB = 4, ITER = 14;
  let unit = 30, charms = [];
  let mx = innerWidth / 2, my = innerHeight / 2, seen = false;
  const RING = 0.07;                                  // rayon de l'anneau de dragonne (× taille du stylet)
  const ringBottom = () => { const sw = stylus.offsetWidth || 170; return [mx + END[0] * sw, my + END[1] * sw + RING * sw * 0.85]; };
  const pivot = () => { const [x, y] = ringBottom(); return [x, y + 4]; };  // le nœud, juste sous la boucle

  function build() {
    unit = parseFloat(getComputedStyle(box).getPropertyValue("--u")) || 30;
    const [px, py] = pivot();
    charms = [...box.querySelectorAll(".charm")].map((img, i) => {
      const L = +img.dataset.len * unit, W = +img.dataset.size * unit * 1.9;
      const n = Math.max(4, Math.round(L / 7)), seg = L / n;
      const pts = [];
      for (let k = 0; k <= n; k++) pts.push({ x: px, y: py + k * seg, ox: px, oy: py + k * seg, w: k === 0 ? 0 : 1 });
      const hang = W * 0.42;                       // anneau → centre du charm
      const c = { x: px, y: py + L + hang, ox: px, oy: py + L + hang, w: 0.05 };   // bien plus lourd que le cordon
      img.style.width = img.style.height = W + "px";
      return { img, pts, c, seg, hang, W, r: W * 0.27 };
    });
  }
  build();
  window.addEventListener("resize", build);
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    if (!seen) { mx = e.clientX; my = e.clientY; seen = true; build(); }
    mx = e.clientX; my = e.clientY;
  }, { passive: true });


  function link(a, b, len, rigid) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
    if (!rigid && d <= len) return;                // un cordon peut se détendre, pas s'étirer
    const wsum = a.w + b.w; if (!wsum) return;
    const k = (d - len) / d / wsum;
    a.x += dx * k * a.w; a.y += dy * k * a.w;
    b.x -= dx * k * b.w; b.y -= dy * k * b.w;
  }
  let last = performance.now();
  function step(t) {
    const dt = Math.min(0.033, (t - last) / 1000) / SUB; last = t;
    const [px, py] = pivot();
    // la souris a « sauté » (sortie/retour dans la fenêtre) : on déplace toute la grappe sans l'affoler
    const p0 = charms[0] && charms[0].pts[0];
    if (p0 && Math.hypot(px - p0.x, py - p0.y) > 220) {
      const dx = px - p0.x, dy = py - p0.y;
      charms.forEach((ch) => [...ch.pts, ch.c].forEach((p) => { p.x += dx; p.y += dy; p.ox += dx; p.oy += dy; }));
    }
    for (let s = 0; s < SUB; s++) {
      for (const ch of charms) {
        for (const p of [...ch.pts, ch.c]) {
          if (!p.w) continue;
          const vx = (p.x - p.ox) * DRAG, vy = (p.y - p.oy) * DRAG;
          p.ox = p.x; p.oy = p.y;
          p.x += vx; p.y += vy + G * dt * dt;
        }
        ch.pts[0].x = ch.pts[0].ox = px; ch.pts[0].y = ch.pts[0].oy = py;
      }
      for (let it = 0; it < ITER; it++) {
        for (const ch of charms) {
          for (let k = 0; k < ch.pts.length - 1; k++) link(ch.pts[k], ch.pts[k + 1], ch.seg, false);
          link(ch.pts[ch.pts.length - 1], ch.c, ch.hang, true);
        }
        // les charms se cognent au lieu de se traverser
        for (let i = 0; i < charms.length; i++) for (let j = i + 1; j < charms.length; j++) {
          const a = charms[i].c, b = charms[j].c, min = charms[i].r + charms[j].r;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
          if (d < min) { const k = (min - d) / d * 0.22; a.x -= dx * k; a.y -= dy * k; b.x += dx * k; b.y += dy * k; }
        }
      }
    }
    box.classList.toggle("show", seen && stylus.classList.contains("show"));
    const [rx, ry] = ringBottom();
    loopEl.setAttribute("cx", rx); loopEl.setAttribute("cy", ry);
    knotEl.setAttribute("cx", px); knotEl.setAttribute("cy", py);
    charms.forEach((ch, i) => {
      // cordon : courbe lissée passant par les points
      const P = ch.pts;
      let d = `M${P[0].x.toFixed(1)} ${P[0].y.toFixed(1)}`;
      for (let k = 1; k < P.length - 1; k++) {
        const mxp = (P[k].x + P[k + 1].x) / 2, myp = (P[k].y + P[k + 1].y) / 2;
        d += `Q${P[k].x.toFixed(1)} ${P[k].y.toFixed(1)} ${mxp.toFixed(1)} ${myp.toFixed(1)}`;
      }
      const e = P[P.length - 1];
      d += `L${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
      cordEls[i].setAttribute("d", d); shadowEls[i].setAttribute("d", d);
      // charm : son anneau sur le bout du cordon, orienté vers son centre de gravité
      const ang = -Math.atan2(ch.c.x - e.x, ch.c.y - e.y);
      ch.img.style.transform = `translate(${e.x}px, ${e.y}px) rotate(${ang}rad) translate(${-ch.W / 2}px, ${-ch.W * 0.04}px)`;
    });
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
})();

// langue : on retraduit les textes produits par le JS, puis on démarre la traduction
I18N.onChange(() => { show(current); syncPlay(); });
setTimeout(() => I18N.init(), 0);

// ---------------------------------------------------------
// Sticker décollable : on l'attrape, il se soulève puis se décolle et tombe ;
// la colle reste sur le chrome. Un clic sur la colle le recolle.
// ---------------------------------------------------------
(function () {
  const st = document.getElementById("sticker"), glue = document.querySelector(".glue");
  if (!st || !glue) return;
  const BASE = "rotate(6deg)";
  let drag = null, fall = 0;
  const lift = (dx, dy, k) => {
    const d = Math.hypot(dx, dy), l = Math.min(1, d / 110);
    st.style.transform = `translate(${dx * k}px, ${dy * k}px) perspective(500px) rotateX(${(-dy * 0.22).toFixed(1)}deg) rotateY(${(dx * 0.22).toFixed(1)}deg) rotate(${6 + dx * 0.12}deg) scale(${1 + 0.07 * l})`;
    st.style.filter = `drop-shadow(${(4 + 10 * l).toFixed(1)}px ${(6 + 16 * l).toFixed(1)}px ${(6 + 14 * l).toFixed(1)}px rgba(0,0,0,${(0.35 + 0.2 * l).toFixed(2)}))`;
  };
  st.addEventListener("pointerdown", (e) => {
    if (e.button > 0) return;
    e.preventDefault(); e.stopPropagation();
    st.setPointerCapture(e.pointerId);
    st.classList.remove("snap"); st.classList.add("peeling");
    drag = { x: e.clientX, y: e.clientY, off: false, vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, t: performance.now() };
  });
  st.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y, now = performance.now(), dt = Math.max(1, now - drag.t);
    drag.vx = 0.7 * drag.vx + 0.3 * ((e.clientX - drag.lx) / dt) * 16; drag.vy = 0.7 * drag.vy + 0.3 * ((e.clientY - drag.ly) / dt) * 16;
    drag.lx = e.clientX; drag.ly = e.clientY; drag.t = now;
    if (!drag.off && Math.hypot(dx, dy) > 95) drag.off = true;     // la colle lâche
    // encore collé : il résiste (élastique) ; décollé : il suit le doigt
    lift(dx, dy, drag.off ? 1 : 0.35 + 0.004 * Math.hypot(dx, dy));
  });
  const end = (e) => {
    if (!drag) return;
    const d = drag; drag = null; st.classList.remove("peeling");
    if (!d.off) { st.classList.add("snap"); st.style.transform = ""; st.style.filter = ""; return; }
    // il tombe avec son élan et la gravité, en tournoyant
    let x = (e.clientX - d.x), y = (e.clientY - d.y), vx = d.vx, vy = d.vy, r = 6 + x * 0.12, vr = vx * 0.6 + (Math.random() - 0.5) * 6;
    cancelAnimationFrame(fall);
    const step = () => {
      vy += 1.1; vx *= 0.99; x += vx; y += vy; r += vr;
      st.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) scale(1.05)`;
      if (st.getBoundingClientRect().top < innerHeight + 40) fall = requestAnimationFrame(step);
      else { st.classList.add("gone"); glue.classList.add("tacky"); glue.title = "Recoller"; }
    };
    fall = requestAnimationFrame(step);
  };
  st.addEventListener("pointerup", end); st.addEventListener("pointercancel", end);
  glue.addEventListener("click", () => {
    if (!st.classList.contains("gone")) return;
    glue.classList.remove("tacky"); glue.removeAttribute("title");
    st.classList.remove("gone"); st.style.filter = "";
    st.style.transform = "translate(0, -60px) rotate(-14deg) scale(1.25)";
    requestAnimationFrame(() => requestAnimationFrame(() => { st.classList.add("snap"); st.style.transform = ""; }));
  });
})();
