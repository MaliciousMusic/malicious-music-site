// ---------- Waveforms (hero + plugin mockup) ----------
const profiles = {
  mix:   { freq: 0.9,  amp: 1.0,  noise: 0.6 },
  vox:   { freq: 0.35, amp: 0.8,  noise: 0.25 },
  drums: { freq: 2.2,  amp: 0.9,  noise: 0.9 },
  bass:  { freq: 0.18, amp: 0.7,  noise: 0.1 },
  other: { freq: 0.6,  amp: 0.55, noise: 0.4 },
};

const canvases = [...document.querySelectorAll("canvas[data-wave]")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function resize(c) {
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.max(1, c.clientWidth * dpr);
  c.height = Math.max(1, c.clientHeight * dpr);
}

function draw(t) {
  for (const c of canvases) {
    const ctx = c.getContext("2d");
    const p = profiles[c.dataset.wave] || profiles.mix;
    const { width: w, height: h } = c;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = c.dataset.wave === "mix" ? "#f2f2f0" : "#ff2e4d";
    const bars = 64;
    const bw = w / bars;
    for (let i = 0; i < bars; i++) {
      const x = i / bars;
      const v =
        Math.abs(Math.sin(x * 12 * p.freq + t * 0.0012)) * (1 - p.noise) +
        Math.abs(Math.sin(i * 1.7 + t * 0.004 * p.freq)) * p.noise;
      const bh = Math.max(2, v * p.amp * h);
      ctx.fillRect(i * bw + bw * 0.2, (h - bh) / 2, bw * 0.6, bh);
    }
  }
  if (!reduceMotion) requestAnimationFrame(draw);
}

if (canvases.length) {
  canvases.forEach(resize);
  window.addEventListener("resize", () => canvases.forEach(resize));
  requestAnimationFrame(draw);
}

// ---------- Plugin mockup: mute / solo ----------
const stems = [...document.querySelectorAll(".stem")];
function refreshStems() {
  const anySolo = stems.some((s) => s.querySelector(".s").getAttribute("aria-pressed") === "true");
  for (const s of stems) {
    const muted = s.querySelector(".m").getAttribute("aria-pressed") === "true";
    const solo = s.querySelector(".s").getAttribute("aria-pressed") === "true";
    s.classList.toggle("is-muted", muted || (anySolo && !solo));
  }
}
stems.forEach((s) =>
  s.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
      refreshStems();
    })
  )
);

// ---------- Mobile nav ----------
const nav = document.querySelector(".nav");
const burger = document.querySelector(".burger");
if (burger) {
  burger.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
  });
  nav.querySelectorAll(".nav-links a").forEach((a) =>
    a.addEventListener("click", () => nav.classList.remove("open"))
  );
}

// ---------- Newsletter (placeholder, rien n'est envoyé) ----------
document.querySelectorAll("form.signup").forEach((f) =>
  f.addEventListener("submit", (e) => {
    e.preventDefault();
    f.querySelector(".msg").hidden = false;
    f.reset();
  })
);

// ---------- Reveal on scroll ----------
const io = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 })
  : null;
document.querySelectorAll(".reveal").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));

// ---------- Year ----------
document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
