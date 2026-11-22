// Animated placeholder waveforms in the hero (MP3 -> stems)
const profiles = {
  mix:   { freq: 0.9, amp: 1.0,  noise: 0.6 },
  vox:   { freq: 0.35, amp: 0.8, noise: 0.25 },
  drums: { freq: 2.2, amp: 0.9,  noise: 0.9 },
  bass:  { freq: 0.18, amp: 0.7, noise: 0.1 },
  other: { freq: 0.6, amp: 0.55, noise: 0.4 },
};

const canvases = [...document.querySelectorAll("canvas[data-wave]")];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function resize(c) {
  const dpr = window.devicePixelRatio || 1;
  c.width = c.clientWidth * dpr;
  c.height = c.clientHeight * dpr;
}

function draw(t) {
  for (const c of canvases) {
    const ctx = c.getContext("2d");
    const p = profiles[c.dataset.wave];
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

canvases.forEach(resize);
window.addEventListener("resize", () => canvases.forEach(resize));
requestAnimationFrame(draw);

document.getElementById("year").textContent = new Date().getFullYear();
