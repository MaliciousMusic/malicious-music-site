const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
const INK = "38,51,44";
const allCanvases = [...document.querySelectorAll("canvas")];

// Models are drawn at low resolution and scaled up: real dot-matrix pixels
function fit(c) {
  const k = c.dataset.model ? 1 / 2.5 : 0.5;
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
const names = { home: "ACCUEIL", plugin: "PLUGIN", tarif: "TARIF", audioware: "AUDIOWARE", faq: "FAQ", contact: "CONTACT", legal: "MENTIONS LÉGALES" };
const scroller = document.getElementById("views");
const stTitle = document.getElementById("st-title");
const readout = document.getElementById("readout");
const device = document.getElementById("device");
const glassEl = document.getElementById("glass");
let current = "home";

// ---------------------------------------------------------
// Chassis: chrome body drawn edge to edge around the screen
// ---------------------------------------------------------
function hole(x, y, w, h) {
  const r = Math.min(54, w * 0.09, h * 0.14);
  const bw = Math.min(12, w * 0.016), bt = Math.min(14, h * 0.03), bb = Math.min(26, h * 0.055);
  const f = (n) => n.toFixed(1);
  return [
    `M${f(x + bw + r)} ${f(y + bt)}`,
    `Q${f(x + w / 2)} ${f(y - bt)} ${f(x + w - bw - r)} ${f(y + bt)}`,
    `Q${f(x + w - bw)} ${f(y + bt)} ${f(x + w - bw)} ${f(y + bt + r)}`,
    `Q${f(x + w + bw)} ${f(y + h / 2)} ${f(x + w - bw)} ${f(y + h - r)}`,
    `Q${f(x + w - bw)} ${f(y + h)} ${f(x + w - bw - r)} ${f(y + h)}`,
    `Q${f(x + w / 2)} ${f(y + h - 2 * bb)} ${f(x + bw + r)} ${f(y + h)}`,
    `Q${f(x + bw)} ${f(y + h)} ${f(x + bw)} ${f(y + h - r)}`,
    `Q${f(x - bw)} ${f(y + h / 2)} ${f(x + bw)} ${f(y + bt + r)}`,
    `Q${f(x + bw)} ${f(y + bt)} ${f(x + bw + r)} ${f(y + bt)}Z`,
  ].join("");
}
function layout() {
  const d = device.getBoundingClientRect(), g = glassEl.getBoundingClientRect();
  const W = d.width, H = d.height, x = g.left - d.left, y = g.top - d.top;
  const inner = hole(x, y, g.width, g.height);
  ["chassis", "bezel"].forEach((id) => document.getElementById(id).setAttribute("viewBox", `0 0 ${W} ${H}`));
  const body = `M0 0H${W}V${H}H0Z` + inner;
  document.getElementById("body").setAttribute("d", body);
  document.getElementById("body-sheen").setAttribute("d", body);
  document.getElementById("body-shade").setAttribute("d", body);
  const pat = document.getElementById("p-plate"), img = document.getElementById("plate-img");
  [pat, img].forEach((el) => { el.setAttribute("width", W); el.setAttribute("height", H); });
  document.getElementById("rim").setAttribute("d", inner);
  document.getElementById("rim-hi").setAttribute("d", hole(x - 4, y - 4, g.width + 8, g.height + 8));
  glassEl.style.clipPath = `path('${hole(0, 0, g.width, g.height)}')`;
  // encoche gravée en haut au centre, à la largeur du titre
  const tp = document.getElementById("title-plate").getBoundingClientRect();
  const tw = tp.width + 36, cx = tp.left - d.left + tp.width / 2, D = (g.top - d.top) * 0.8, f = (n) => n.toFixed(1);
  const a = cx - tw / 2, b = cx + tw / 2, k = D * 1.5;
  document.getElementById("recess").setAttribute("d",
    `M${f(a - k)} -4C${f(a - k * 0.4)} -4 ${f(a - k * 0.45)} ${f(D)} ${f(a)} ${f(D)}H${f(b)}C${f(b + k * 0.45)} ${f(D)} ${f(b + k * 0.4)} -4 ${f(b + k)} -4Z`);
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
scroller.addEventListener("scroll", updatePos, { passive: true });
posTrack.addEventListener("pointerdown", (e) => {
  const seek = (ev) => {
    const r = posTrack.getBoundingClientRect();
    scroller.scrollTop = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)) * (scroller.scrollHeight - scroller.clientHeight);
  };
  posTrack.setPointerCapture(e.pointerId); seek(e);
  posTrack.onpointermove = (ev) => ev.buttons && seek(ev);
});
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
  document.querySelectorAll("[data-key]").forEach((k) => (k.dataset.key === id ? k.setAttribute("aria-current", "page") : k.removeAttribute("aria-current")));
  stTitle.textContent = order.indexOf(id) + 1 + ". " + names[id];
  readout.textContent = String(order.indexOf(id) + 1).padStart(2, "0") + " " + names[id];
  updatePos();
  document.title = (id === "home" ? "" : names[id].charAt(0) + names[id].slice(1).toLowerCase() + " — ") + "Malicious Music";
  if (target && target !== view) target.scrollIntoView({ block: "start" });
}
window.addEventListener("hashchange", () => show(location.hash.slice(1)));
show(location.hash.slice(1));

const step = (d) => { location.hash = order[(order.indexOf(current) + d + order.length) % order.length]; };
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
setTimeout(togglePower, 650);

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
const syncPlay = () => { playBtn.textContent = player.playing ? "PAUSE" : "PLAY ▶"; playBtn.setAttribute("aria-pressed", String(player.playing)); };
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
function drawModel(c, t) {
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
