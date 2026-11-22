const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
const allCanvases = [...document.querySelectorAll("canvas")];

function fit(c) {
  const w = Math.max(1, Math.round(c.clientWidth * dpr()));
  const h = Math.max(1, Math.round(c.clientHeight * dpr()));
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
}

// Only animate what is on screen
const visible = new Set(allCanvases);
if ("IntersectionObserver" in window) {
  visible.clear();
  const io = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? visible.add(e.target) : visible.delete(e.target))), { rootMargin: "100px" });
  allCanvases.forEach((c) => io.observe(c));
}

// ---------------------------------------------------------
// Player state (shared by the LCD and the transport keys)
// ---------------------------------------------------------
const DURATION = 196; // 3:16
const player = { playing: true, pos: 0 };
const strips = [...document.querySelectorAll(".strip")].map((el) => ({
  el,
  knob: el.querySelector(".knob"),
  m: el.querySelector(".m"),
  s: el.querySelector(".s"),
}));
const pressed = (b) => b.getAttribute("aria-pressed") === "true";
function stemLevel(i) {
  const st = strips[i];
  if (!st) return 0;
  const anySolo = strips.some((x) => pressed(x.s));
  const silent = pressed(st.m) || (anySolo && !pressed(st.s));
  st.el.classList.toggle("is-muted", silent);
  return silent ? 0 : parseFloat(st.knob.dataset.v);
}

// ---------------------------------------------------------
// Knobs
// ---------------------------------------------------------
document.querySelectorAll(".knob").forEach((k) => {
  const set = (v) => {
    v = Math.min(1, Math.max(0, v));
    k.dataset.v = v;
    k.style.setProperty("--a", v * 270 - 135 + "deg");
    k.setAttribute("aria-valuenow", Math.round(v * 100));
  };
  set(parseFloat(k.dataset.v || 0.75));
  let y0 = null, v0 = 0;
  k.addEventListener("pointerdown", (e) => { k.setPointerCapture(e.pointerId); y0 = e.clientY; v0 = +k.dataset.v; e.preventDefault(); });
  k.addEventListener("pointermove", (e) => { if (y0 !== null) set(v0 + (y0 - e.clientY) / 140); });
  ["pointerup", "pointercancel"].forEach((ev) => k.addEventListener(ev, () => (y0 = null)));
  k.addEventListener("keydown", (e) => {
    const d = { ArrowUp: 0.05, ArrowRight: 0.05, ArrowDown: -0.05, ArrowLeft: -0.05 }[e.key];
    if (d) { set(+k.dataset.v + d); e.preventDefault(); }
  });
});

// Mute / solo
strips.forEach((st) => [st.m, st.s].forEach((b) => b.addEventListener("click", () => b.setAttribute("aria-pressed", String(!pressed(b))))));

// Transport
const playBtn = document.getElementById("t-play");
if (playBtn) {
  const sync = () => { playBtn.innerHTML = player.playing ? "&#10074;&#10074;" : "&#9654;&#xFE0E;"; playBtn.setAttribute("aria-pressed", String(player.playing)); };
  playBtn.addEventListener("click", () => { player.playing = !player.playing; sync(); });
  document.getElementById("t-stop").addEventListener("click", () => { player.playing = false; player.pos = 0; sync(); });
  document.getElementById("t-rew").addEventListener("click", () => { player.pos = 0; });
}

// ---------------------------------------------------------
// Hero phosphor waveforms
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
  ctx.fillStyle = getComputedStyle(c).color;
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 6 * dpr();
  const bars = Math.max(24, Math.floor(w / (7 * dpr())));
  const bw = w / bars;
  for (let i = 0; i < bars; i++) {
    const x = i / bars;
    const v = Math.abs(Math.sin(x * 12 * p.freq + t * 0.0012)) * (1 - p.noise) + Math.abs(Math.sin(i * 1.7 + t * 0.004 * p.freq)) * p.noise;
    const bh = Math.max(2, v * p.amp * h);
    ctx.fillRect(i * bw + bw * 0.2, (h - bh) / 2, bw * 0.6, bh);
  }
}

// ---------------------------------------------------------
// LCD dot-matrix spectrum (4 stems x 8 columns)
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
    const s = Math.floor(i / 8);
    const lv = stemLevel(s);
    const f = stemFreq[s];
    let target = 0;
    if (player.playing) {
      target = lv * (0.35 + 0.65 * Math.abs(Math.sin(t * 0.003 * f + i * 0.9) * Math.sin(t * 0.0011 * f + i * 2.3)));
      target *= 0.75 + 0.25 * Math.sin(i * 12.9898 + Math.floor(t / 90)) ;
    }
    levels[i] += (target - levels[i]) * 0.25;
    peaks[i] = Math.max(peaks[i] - 0.006, levels[i]);
    const lit = Math.round(levels[i] * ROWS), pk = Math.round(peaks[i] * ROWS);
    for (let r = 0; r < ROWS; r++) {
      const on = r < lit || (r === pk && pk > 0);
      ctx.fillStyle = on ? "rgba(38,51,44,.92)" : "rgba(38,51,44,.09)";
      ctx.fillRect(i * cw + (cw - d) / 2 + (i % 8 === 0 ? 1 : 0), h - (r + 1) * rh + (rh - d) / 2, d, d);
    }
  }
}
const timeEl = document.getElementById("lcd-time"), progEl = document.getElementById("lcd-prog");

// ---------------------------------------------------------
// Wireframe 3D models (orange HUD)
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
  circle(L, [0, top + 0.03, 0], X, Z, 0.02, 6);
  L.push([[w(top) * 0.95, top + 0.03, -w(top) * 0.9], [w(top) * 0.95, top + 0.12, -w(top) * 0.6], [w(top) * 0.35, top + 0.06, w(top) * 0.2]]);
  // vinyles rangés dans la base (face avant et arrière)
  for (let f = -0.7; f <= 0.71; f += 0.14) {
    L.push([[f * w(-1), -1, w(-1)], [f * w(shelf), shelf, w(shelf)]]);
    L.push([[f * w(-1), -1, -w(-1)], [f * w(shelf), shelf, -w(shelf)]]);
  }
  // enceinte sur les faces latérales
  const sl = Math.hypot(1, 2.25), vy = [-1 / sl, 2.25 / sl, 0];
  [1, -1].forEach((s) => {
    const cy = -0.68, c = [s * w(cy), cy, 0], v = [s * vy[0], vy[1], 0];
    circle(L, c, Z, v, 0.24); circle(L, c, Z, v, 0.1, 14);
  });
  // sommet fantôme
  L.push([[-w(top), top, -w(top)], [0, 1.25, 0], [w(top), top, w(top)]]);
  L.push([[w(top), top, -w(top)], [0, 1.25, 0], [-w(top), top, w(top)]]);
  return L;
}

function buildBuds() {
  const L = [];
  [-0.58, 0.58].forEach((cx) => {
    const c = [cx, 0.42, 0], r = 0.44;
    circle(L, c, X, Y, r); circle(L, c, Z, Y, r); circle(L, c, X, Z, r);
    circle(L, [cx, 0.42 + r * 0.6, 0], X, Z, r * 0.8); circle(L, [cx, 0.42 - r * 0.6, 0], X, Z, r * 0.8);
    // grille haut-parleur
    circle(L, [cx, 0.42, r], X, Y, 0.2, 18); circle(L, [cx, 0.42, r], X, Y, 0.1, 12);
    // tige
    const sr = 0.13;
    circle(L, [cx, 0.05, 0], X, Z, sr, 14); circle(L, [cx, -0.5, 0], X, Z, sr, 14); circle(L, [cx, -1, 0], X, Z, sr, 14);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; L.push([[cx + sr * Math.cos(a), 0.05, sr * Math.sin(a)], [cx + sr * Math.cos(a), -1, sr * Math.sin(a)]]); }
    circle(L, [cx, -1, 0], X, Z, sr * 1.8, 16); // socle
  });
  return L;
}

function buildPhones() {
  const L = [];
  // arceau
  [-0.09, 0.09].forEach((z) => { circle(L, [0, -0.05, z], X, Y, 0.82, 26, 0, Math.PI); circle(L, [0, -0.05, z], X, Y, 0.7, 26, 0.25, Math.PI - 0.25); });
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; L.push([[0.82 * Math.cos(a), -0.05 + 0.82 * Math.sin(a), -0.09], [0.82 * Math.cos(a), -0.05 + 0.82 * Math.sin(a), 0.09]]); }
  // oreillettes
  [-1, 1].forEach((s) => {
    const xi = s * 0.66, xo = s * 0.96, cy = -0.3, r = 0.42;
    circle(L, [xi, cy, 0], Y, Z, r); circle(L, [xo, cy, 0], Y, Z, r * 0.9); circle(L, [xo + s * 0.02, cy, 0], Y, Z, r * 0.45, 16);
    circle(L, [xi - s * 0.06, cy, 0], Y, Z, r * 0.8);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; L.push([[xi, cy + r * Math.cos(a), r * Math.sin(a)], [xo, cy + r * 0.9 * Math.cos(a), r * 0.9 * Math.sin(a)]]); }
    // éclair : énergie sans recharge
    L.push([[xo + s * 0.03, cy + 0.14, -0.04], [xo + s * 0.03, cy, 0.06], [xo + s * 0.03, cy, -0.06], [xo + s * 0.03, cy - 0.14, 0.04]]);
    L.push([[s * 0.82, -0.05, 0], [s * 0.82, cy + r * 0.2, 0]]);
  });
  return L;
}

const models = { pyramid: buildPyramid(), buds: buildBuds(), phones: buildPhones() };
function drawModel(c, t) {
  const ctx = c.getContext("2d");
  const { width: w, height: h } = c;
  const L = models[c.dataset.model];
  ctx.clearRect(0, 0, w, h);
  const ay = t * 0.0006, ax = 0.32;
  const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
  const scale = Math.min(w, h) * 0.3, cam = 4.2;
  ctx.strokeStyle = "#ff7a2a"; ctx.lineWidth = 1.2 * dpr(); ctx.lineJoin = "round";
  ctx.shadowColor = "#ff5a00"; ctx.shadowBlur = 7 * dpr();
  ctx.beginPath();
  for (const line of L) {
    for (let i = 0; i < line.length; i++) {
      const [x0, y0, z0] = line[i];
      const x1 = x0 * cy + z0 * sy, z1 = -x0 * sy + z0 * cy;
      const y2 = y0 * cx - z1 * sx, z2 = y0 * sx + z1 * cx;
      const k = cam / (cam + z2);
      const px = w / 2 + x1 * k * scale, py = h * 0.47 - (y2 - 0.08) * k * scale;
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
  if (timeEl) {
    const s = Math.floor(player.pos);
    timeEl.textContent = Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    progEl.style.width = (player.pos / DURATION) * 100 + "%";
  }
  for (const c of visible) {
    fit(c);
    if (c.dataset.wave) drawWave(c, t);
    else if (c.hasAttribute("data-lcd")) drawLcd(c, t);
    else if (c.dataset.model) drawModel(c, t);
  }
  if (!reduceMotion) requestAnimationFrame(frame);
}
if (reduceMotion) { allCanvases.forEach((c) => visible.add(c)); frame(performance.now() + 4000); window.addEventListener("resize", () => frame(performance.now())); }
else requestAnimationFrame(frame);

// ---------------------------------------------------------
// CRT power button
// ---------------------------------------------------------
const power = document.getElementById("hero-power");
if (power) {
  power.addEventListener("click", () => {
    const on = power.getAttribute("aria-pressed") !== "true";
    power.setAttribute("aria-pressed", String(on));
    document.getElementById("hero-screen").classList.toggle("off", !on);
    document.getElementById("hero-led").classList.toggle("on", on);
  });
}

// Newsletter (placeholder, rien n'est envoyé)
document.querySelectorAll("form.signup").forEach((f) =>
  f.addEventListener("submit", (e) => { e.preventDefault(); f.querySelector(".msg").hidden = false; f.reset(); })
);

document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
