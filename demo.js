// =========================================================
// DÉMO DE L'ACCUEIL : un MP3 → MIDI recomposé stem par stem → passes → mix fini
// Tout est synthétisé dans le navigateur (Web Audio, rendu hors ligne),
// rien n'est téléchargé. À remplacer par de vrais rendus du plugin.
// =========================================================
(() => {
  const root = document.getElementById("demo");
  if (!root || !(window.AudioContext || window.webkitAudioContext)) return;
  const canvas = root.querySelector("[data-demo-roll]");
  const ctx2d = canvas.getContext("2d");
  const statusEl = document.getElementById("demo-status");
  const runBtn = document.getElementById("demo-run");
  const abWrap = document.getElementById("demo-ab");
  const abBtns = [...abWrap.querySelectorAll("[data-ab]")];
  const pickBtns = [...root.querySelectorAll("[data-demo]")];
  const glass = document.getElementById("glass");
  const INK = "38,51,44";
  const SR = 32000;
  const STEMS = ["LEAD", "KEYS", "BASS", "DRUMS"];      // de haut en bas dans le piano roll
  const REVEAL = ["DRUMS", "BASS", "KEYS", "LEAD"];     // ordre dans lequel les stems sortent

  // ---------------------------------------------------------
  // Les 3 morceaux (4 mesures de 16 pas, en boucle)
  // ---------------------------------------------------------
  const DEMOS = [
    { name: "NEON DRIVE", bpm: 108, swing: 0, style: "synth",
      chords: [[57, 60, 64], [53, 57, 60], [52, 55, 60], [55, 59, 62]],
      bass: (bar) => { const r = [45, 41, 48, 43][bar]; return [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => [s, 2, i % 2 ? r + 12 : r]); },
      drums: { k: "x...x...x...x...", s: "....x.......x...", h: "..x...x...x...x." },
      lead: [[0, 3, 76], [4, 2, 72], [6, 2, 74], [8, 4, 76], [12, 4, 79], [16, 4, 77], [20, 2, 76], [22, 6, 72], [28, 4, 69],
             [32, 3, 72], [35, 3, 74], [38, 2, 76], [40, 8, 79], [48, 2, 79], [50, 2, 77], [52, 4, 76], [56, 4, 74], [60, 4, 71]] },
    { name: "BASEMENT 808", bpm: 140, swing: 0, style: "trap",
      chords: [[60, 63, 67], [56, 60, 63], [55, 58, 63], [58, 62, 65]],
      bass: (bar) => { const r = [36, 32, 39, 34][bar]; return [[0, 6, r], [7, 3, r], [10, 6, bar === 3 ? r + 2 : r]]; },
      drums: { k: "x......x..x.....", s: "........x.......", h: "x.x.x.x.x.xxx.x." },
      lead: [[0, 2, 75], [3, 2, 72], [6, 2, 70], [8, 6, 67], [16, 2, 75], [19, 2, 72], [22, 2, 68], [24, 6, 67],
             [32, 2, 75], [35, 2, 74], [38, 2, 70], [40, 6, 67], [48, 2, 70], [51, 2, 72], [54, 2, 74], [56, 8, 75]] },
    { name: "SUNDAY LOFI", bpm: 84, swing: 0.55, style: "lofi",
      chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
      bass: (bar) => { const r = [41, 40, 38, 36][bar]; return [[0, 5, r], [6, 2, r + 7], [10, 4, r + 12]]; },
      drums: { k: "x.....x...x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
      lead: [[0, 6, 72], [6, 2, 69], [8, 8, 67], [16, 4, 71], [20, 2, 72], [22, 2, 71], [24, 8, 67],
             [32, 4, 69], [36, 4, 72], [40, 6, 74], [46, 2, 72], [48, 6, 71], [54, 2, 67], [56, 8, 64]] },
  ];

  function build(demo) {
    const step = 60 / demo.bpm / 4, L = 64 * step;
    const at = (s) => s * step + (s % 2 ? demo.swing * step * 0.5 : 0);
    const notes = [];
    for (let bar = 0; bar < 4; bar++) {
      const b0 = bar * 16;
      demo.chords[bar].forEach((n) => notes.push({ stem: "KEYS", t: at(b0), d: 15.5 * step, n, v: 0.8 }));
      if (demo.style === "synth") demo.chords[bar].forEach((n) => notes.push({ stem: "KEYS", t: at(b0 + 10), d: 5.5 * step, n, v: 0.55 }));
      demo.bass(bar).forEach(([s, len, n]) => notes.push({ stem: "BASS", t: at(b0 + s), d: len * step * 0.95, n, v: 0.9 }));
      for (const [kind, pat] of Object.entries(demo.drums))
        [...pat].forEach((ch, s) => { if (ch === "x") notes.push({ stem: "DRUMS", kind, t: at(b0 + s), d: step, n: { k: 0, s: 1, h: 2 }[kind], v: kind === "h" ? (s % 4 === 2 ? 0.9 : 0.55) : 1 }); });
    }
    demo.lead.forEach(([s, len, n]) => notes.push({ stem: "LEAD", t: at(s), d: len * step * 0.92, n, v: 0.85 }));
    const range = {};
    STEMS.forEach((st) => { const ns = notes.filter((x) => x.stem === st).map((x) => x.n); range[st] = [Math.min(...ns), Math.max(...ns)]; });
    return { L, step, notes, range };
  }

  // ---------------------------------------------------------
  // Synthèse (rendu hors ligne) — versions : orig, raw (MIDI brut), timbre, final
  // ---------------------------------------------------------
  const hz = (n) => 440 * 2 ** ((n - 69) / 12);
  function noiseBuf(c) {
    const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
    let s = 22222; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; }
    return b;
  }
  function impulse(c, sec) {
    const len = Math.round(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6; }
    return b;
  }
  function osc(c, type, f, t, end, out, detune = 0) {
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune;
    o.connect(out); o.start(t); o.stop(end); return o;
  }
  function gainEnv(c, out, t, a, peak, hold, rel) {
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    if (hold > a) g.gain.setValueAtTime(peak, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(hold, a) + rel);
    g.connect(out); return g;
  }
  function panTo(c, out, p) { if (!c.createStereoPanner) return out; const sp = c.createStereoPanner(); sp.pan.value = p; sp.connect(out); return sp; }

  function voice(c, bus, x, t, ver, style, nz) {
    const raw = ver === "raw", fin = ver === "final" || ver === "orig";
    const f = hz(x.n), v = x.v;
    if (x.stem === "DRUMS") {
      if (x.kind === "k") {
        if (raw) { const g = gainEnv(c, bus.drums, t, 0.002, 0.35 * v, 0.01, 0.1); osc(c, "square", 62, t, t + 0.15, g); return; }
        const g = gainEnv(c, bus.drums, t, 0.003, (style === "trap" ? 0.8 : 1) * v, 0.01, style === "lofi" ? 0.28 : 0.4);
        const o = osc(c, "sine", 160, t, t + 0.5, g); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
        if (fin) { const cg = gainEnv(c, bus.drums, t, 0.001, 0.25 * v, 0.002, 0.02); const n = c.createBufferSource(); n.buffer = nz; n.connect(cg); n.start(t); n.stop(t + 0.03); }
        return;
      }
      const src = c.createBufferSource(); src.buffer = nz;
      if (x.kind === "s") {
        const bp = c.createBiquadFilter(); bp.type = raw ? "highpass" : "bandpass"; bp.frequency.value = raw ? 2500 : (style === "lofi" ? 1400 : 1900); bp.Q.value = 0.7;
        const g = gainEnv(c, fin ? panTo(c, bus.drums, 0.04) : bus.drums, t, 0.002, (raw ? 0.18 : 0.55) * v, 0.01, raw ? 0.06 : (style === "trap" ? 0.25 : 0.18));
        src.connect(bp).connect(g); src.start(t, Math.random() * 0.5); src.stop(t + 0.35);
        if (!raw) { const tg = gainEnv(c, bus.drums, t, 0.002, 0.3 * v, 0.005, 0.09); osc(c, "triangle", 190, t, t + 0.12, tg); }
        if (fin) { const sg = c.createGain(); sg.gain.value = 0.35; g.connect(sg).connect(bus.verb); }
        return;
      }
      const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = raw ? 5000 : 7200;
      const g = gainEnv(c, fin ? panTo(c, bus.drums, 0.3) : bus.drums, t, 0.001, (raw ? 0.06 : (style === "lofi" ? 0.12 : 0.18)) * v, 0.003, raw ? 0.02 : 0.045);
      src.connect(hp).connect(g); src.start(t, Math.random() * 0.5); src.stop(t + 0.1);
      return;
    }
    const end = t + x.d;
    if (raw) { // MIDI brut : formes d'onde nues, enveloppe plate
      const type = { BASS: "triangle", KEYS: "sine", LEAD: "square" }[x.stem];
      const lvl = { BASS: 0.32, KEYS: 0.08, LEAD: 0.06 }[x.stem];
      const g = gainEnv(c, bus.music, t, 0.005, lvl * v, x.d, 0.03); osc(c, type, f, t, end + 0.05, g); return;
    }
    if (x.stem === "BASS") {
      if (style === "trap") {
        const ws = c.createWaveShaper(); const cur = new Float32Array(256); for (let i = 0; i < 256; i++) { const u = i / 127.5 - 1; cur[i] = Math.tanh(u * 2.2); } ws.curve = cur;
        const g = gainEnv(c, bus.music, t, 0.004, 0.55 * v, x.d * 0.6, x.d * 0.5 + 0.1);
        const o = osc(c, "sine", f * 1.6, t, end + 0.3, ws); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); ws.connect(g); return;
      }
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = style === "synth" ? 6 : 1;
      lp.frequency.setValueAtTime(style === "lofi" ? 700 : 1400, t); lp.frequency.exponentialRampToValueAtTime(style === "lofi" ? 300 : 220, t + Math.min(0.25, x.d));
      const g = gainEnv(c, bus.music, t, 0.005, 0.3 * v, x.d * 0.8, 0.08);
      lp.connect(g); osc(c, style === "lofi" ? "triangle" : "sawtooth", f, t, end + 0.1, lp);
      const sg = gainEnv(c, bus.music, t, 0.005, 0.22 * v, x.d * 0.8, 0.08); osc(c, "sine", f, t, end + 0.1, sg);
      return;
    }
    if (x.stem === "KEYS") {
      if (style === "synth") {
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1900;
        const g = gainEnv(c, bus.music, t, 0.03, 0.05 * v, x.d, 0.35); lp.connect(g);
        [-9, 9].forEach((dt, i) => osc(c, "sawtooth", f, t, end + 0.4, fin ? panTo(c, lp, i ? 0.55 : -0.55) : lp, dt));
        if (fin) { const s = c.createGain(); s.gain.value = 0.5; g.connect(s).connect(bus.verb); }
        return;
      }
      const dec = style === "lofi" ? 1.6 : 1.1;
      const g = gainEnv(c, fin ? panTo(c, bus.music, (x.n % 3 - 1) * 0.35) : bus.music, t, 0.006, (style === "lofi" ? 0.09 : 0.07) * v, 0.02, Math.min(dec, x.d + 0.4));
      osc(c, "sine", f, t, end + 0.6, g, style === "lofi" ? -6 : 0);
      const h = c.createGain(); h.gain.value = style === "trap" ? 0.45 : 0.25; h.connect(g); osc(c, "sine", f * (style === "trap" ? 3 : 2), t, t + 0.5, h);
      if (fin) { const s = c.createGain(); s.gain.value = 0.45; g.connect(s).connect(bus.verb); }
      return;
    }
    // LEAD
    let g;
    if (style === "trap") {
      g = gainEnv(c, bus.music, t, 0.003, 0.11 * v, 0.01, Math.min(0.9, x.d + 0.3));
      osc(c, "sine", f, t, end + 0.5, g); const h = c.createGain(); h.gain.value = 0.35; h.connect(g); osc(c, "sine", f * 2, t, end + 0.3, h);
      const h4 = gainEnv(c, g, t, 0.002, 0.25, 0.005, 0.12); osc(c, "sine", f * 4, t, t + 0.2, h4);
    } else {
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = style === "lofi" ? 1500 : 3000;
      g = gainEnv(c, bus.music, t, 0.012, (style === "lofi" ? 0.13 : 0.07) * v, x.d, 0.12); lp.connect(g);
      const o = osc(c, style === "lofi" ? "triangle" : "sawtooth", f, t, end + 0.2, lp);
      if (style === "synth") osc(c, "square", f, t, end + 0.2, lp, 5);
      if (fin) { const lfo = c.createOscillator(), d = c.createGain(); lfo.frequency.value = 5.4; d.gain.value = 10; lfo.connect(d).connect(o.detune); lfo.start(t + 0.18); lfo.stop(end + 0.2); }
    }
    if (fin) { const s = c.createGain(); s.gain.value = 0.4; g.connect(s).connect(bus.delay); const r = c.createGain(); r.gain.value = 0.3; g.connect(r).connect(bus.verb); }
  }

  async function render(song, demo, ver, stem) {
    const L = song.L, len = Math.ceil(L * SR);
    const c = new OfflineAudioContext(2, len * 2, SR);
    const nz = noiseBuf(c);
    const out = c.createGain(); out.connect(c.destination);
    const bus = { drums: c.createGain(), music: c.createGain() };
    let master = out;
    if (ver === "final" || ver === "orig") {
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.006; comp.release.value = 0.16;
      const shelf = c.createBiquadFilter(); shelf.type = "highshelf"; shelf.frequency.value = 6000; shelf.gain.value = 3;
      master = c.createGain(); master.gain.value = 0.95; master.connect(comp).connect(shelf);
      if (ver === "orig") { // le MP3 de départ : terne, mono, compressé, saturé
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
        const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 110;
        const ws = c.createWaveShaper(); const cur = new Float32Array(512); for (let i = 0; i < 512; i++) { const u = i / 255.5 - 1; cur[i] = Math.tanh(u * 1.8) / Math.tanh(1.8); } ws.curve = cur;
        const mono = c.createGain(); mono.channelCount = 1; mono.channelCountMode = "explicit"; mono.channelInterpretation = "speakers"; mono.gain.value = 0.62;
        shelf.connect(hp).connect(lp).connect(ws).connect(mono).connect(out);
      } else shelf.connect(out);
      // ducking : la musique respire avec le kick
      const duck = c.createGain(); bus.music.connect(duck).connect(master); bus.drums.connect(master);
      song.notes.filter((x) => x.kind === "k").forEach((x) => [x.t, x.t + L].forEach((t) => {
        duck.gain.setValueAtTime(1, t); duck.gain.linearRampToValueAtTime(0.5, t + 0.012); duck.gain.linearRampToValueAtTime(1, t + 0.2);
      }));
      const conv = c.createConvolver(); conv.buffer = impulse(c, demo.style === "lofi" ? 1.6 : 2.3);
      bus.verb = c.createGain(); bus.verb.gain.value = 0.55; bus.verb.connect(conv).connect(master);
      const dl = c.createDelay(1); dl.delayTime.value = song.step * 3; const fb = c.createGain(); fb.gain.value = 0.33;
      const dlp = c.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 2600;
      bus.delay = c.createGain(); bus.delay.connect(dl); dl.connect(dlp).connect(fb).connect(dl);
      const dpan = panTo(c, master, 0.35); dlp.connect(dpan);
    } else { bus.music.connect(out); bus.drums.connect(out); out.gain.value = ver === "raw" ? 1 : 0.9; }
    const list = song.notes.filter((x) => !stem || x.stem === stem);
    for (const off of [0, L]) for (const x of list) voice(c, bus, x, x.t + off, ver, demo.style, nz);
    const full = await c.startRendering();
    // on garde la 2e boucle : les queues de la 1re y retombent, la boucle est sans couture
    const buf = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: SR });
    for (let ch = 0; ch < 2; ch++) buf.copyToChannel(full.getChannelData(ch).subarray(len, len * 2), ch);
    return buf;
  }

  // ---------------------------------------------------------
  // Lecture synchronisée de toutes les versions (crossfades)
  // ---------------------------------------------------------
  let ac = null, playing = null, lastBufs = null, sel = 0, run = 0, song = build(DEMOS[0]), peaks = null;
  const state = { phase: "idle", t0: 0, reveal: 0, gains: {} };

  function startAll(bufs) {
    stopAudio();
    const t0 = ac.currentTime + 0.06, nodes = {};
    for (const [k, b] of Object.entries(bufs)) {
      const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; s.loop = true; g.gain.value = 0;
      s.connect(g).connect(ac.destination); s.start(t0); nodes[k] = { s, g };
    }
    playing = { t0, nodes };
  }
  function mixTo(levels, sec = 0.04) {
    if (!playing) return;
    const now = ac.currentTime;
    for (const [k, n] of Object.entries(playing.nodes)) {
      const v = levels[k] || 0; n.g.gain.cancelScheduledValues(now); n.g.gain.setValueAtTime(n.g.gain.value, now); n.g.gain.linearRampToValueAtTime(v, now + sec);
      state.gains[k] = v;
    }
  }
  function stopAudio() {
    if (!playing) return;
    for (const n of Object.values(playing.nodes)) { try { n.s.stop(); } catch (e) {} }
    playing = null;
  }
  const pos = () => (playing ? ((ac.currentTime - playing.t0) % song.L + song.L) % song.L : 0);

  const wait = (ms, id) => new Promise((res, rej) => setTimeout(() => (id === run ? res() : rej("stop")), ms));
  const setStatus = (s) => { statusEl.textContent = s; };

  async function go() {
    const id = ++run;
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume().catch(() => {});
    const demo = DEMOS[sel]; song = build(demo); lastBufs = null;
    abWrap.hidden = true; runBtn.textContent = "↻ RELANCER";
    state.phase = "analyse"; state.reveal = 0; state.t0 = performance.now(); peaks = null; kick();
    setStatus(`ANALYSE DE ${demo.name.replace(" ", "_")}.MP3…`);
    try {
      const bufs = { orig: await render(song, demo, "orig") };
      if (id !== run) return;
      peaks = wavePeaks(bufs.orig, 360);
      startAll(bufs); mixTo({ orig: 1 }, 0.02);
      // on prépare les autres versions pendant qu'on écoute le mix d'origine
      const keys = [...REVEAL.map((st) => "raw-" + st), "timbre", "final"];
      const done = await Promise.all(keys.map((k) => k.startsWith("raw-") ? render(song, demo, "raw", k.slice(4)) : render(song, demo, k)));
      const others = Object.fromEntries(keys.map((k, i) => [k, done[i]]));
      if (id !== run) return;
      await wait(Math.max(0, 3200 - (performance.now() - state.t0)), id);
      const all = { ...bufs, ...others }, p = pos();
      stopAudio(); restartAt(all, p);          // reprise au même endroit, toutes versions synchronisées
      lastBufs = all;

      // PASSE 1 : le MIDI recomposé sort, stem par stem
      state.phase = "recompose"; state.t0 = performance.now();
      setStatus("PASSE 1/3 · RECOMPOSITION MIDI — LES STEMS SORTENT");
      mixTo({ orig: 0.35 }, 0.3);
      const D1 = Math.max(6000, song.L * 900);
      for (let i = 0; i < REVEAL.length; i++) {
        const lv = { orig: Math.max(0, 0.35 - (i + 1) * 0.09) };
        for (let j = 0; j <= i; j++) lv["raw-" + REVEAL[j]] = 1;
        await wait(i === 0 ? 300 : D1 / 4, id); mixTo(lv, 0.25);
        setStatus(`PASSE 1/3 · RECOMPOSITION MIDI — STEM ${REVEAL[i]} → ${i + 1}/4`);
      }
      await wait(D1 / 4, id);
      // PASSE 2 : vrais timbres et articulation
      state.phase = "timbre"; state.t0 = performance.now();
      setStatus("PASSE 2/3 · TIMBRES & ARTICULATION");
      mixTo({ timbre: 1 }, 1.4);
      await wait(Math.max(4500, song.L * 650), id);
      // PASSE 3 : mix, espace, master
      state.phase = "mix"; state.t0 = performance.now();
      setStatus("PASSE 3/3 · MIX, ESPACE & MASTER");
      mixTo({ final: 1 }, 1.6);
      await wait(Math.max(4500, song.L * 650), id);
      state.phase = "done";
      setStatus("TERMINÉ · COMPAREZ L'ORIGINAL ET LE RÉSULTAT");
      abWrap.hidden = false; setAB("final");
    } catch (e) { if (e !== "stop") { setStatus("AUDIO INDISPONIBLE SUR CE NAVIGATEUR"); console.error(e); } }
  }
  function restartAt(bufs, offset) {
    const t0 = ac.currentTime + 0.06, nodes = {};
    for (const [k, b] of Object.entries(bufs)) {
      const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = b; s.loop = true; g.gain.value = state.gains[k] || 0;
      s.connect(g).connect(ac.destination); s.start(t0, offset % b.duration); nodes[k] = { s, g };
    }
    playing = { t0: t0 - offset, nodes };
  }
  function setAB(k) {
    abBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.ab === k)));
    if (!playing) return;
    mixTo(k === "orig" ? { orig: 1 } : { final: 1 }, 0.05);
    state.phase = k === "orig" ? "done-orig" : "done";
  }
  function stop(msg) {
    run++; stopAudio();
    if (state.phase !== "idle") { state.phase = state.phase.startsWith("done") ? "stopped" : "idle"; }
    runBtn.textContent = "▶ LANCER LA DÉMO";
    if (msg) setStatus(msg);
    abBtns.forEach((b) => b.setAttribute("aria-pressed", "false"));
    kick();
  }

  runBtn.addEventListener("click", () => { go(); });
  abBtns.forEach((b) => b.addEventListener("click", () => {
    if (!playing && lastBufs) { // relance la comparaison sans refaire les passes
      state.gains = {}; restartAt(lastBufs, 0); runBtn.textContent = "↻ RELANCER";
      setStatus("TERMINÉ · COMPAREZ L'ORIGINAL ET LE RÉSULTAT"); kick();
    }
    setAB(b.dataset.ab);
  }));
  document.getElementById("demo-stop").addEventListener("click", () => stop("LECTURE ARRÊTÉE · RELANCEZ OU CHANGEZ DE MORCEAU"));
  pickBtns.forEach((b) => b.addEventListener("click", () => {
    sel = +b.dataset.demo;
    pickBtns.forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    stop(); lastBufs = null; state.phase = "idle"; abWrap.hidden = true; song = build(DEMOS[sel]); peaks = null;
    setStatus(`${DEMOS[sel].name} · ${DEMOS[sel].bpm} BPM — PRÊT`);
    kick();
  }));
  window.addEventListener("hashchange", () => { if (playing && !document.getElementById("home").classList.contains("active")) stop("LECTURE ARRÊTÉE"); });

  // ---------------------------------------------------------
  // Dessin : forme d'onde du MP3 + piano roll 4 stems
  // ---------------------------------------------------------
  function wavePeaks(buf, n) {
    const d = buf.getChannelData(0), out = new Float32Array(n), step = Math.floor(d.length / n);
    let mx = 0;
    for (let i = 0; i < n; i++) { let m = 0; for (let j = i * step; j < (i + 1) * step; j += 4) m = Math.max(m, Math.abs(d[j])); out[i] = m; mx = Math.max(mx, m); }
    for (let i = 0; i < n; i++) out[i] /= mx || 1;
    return out;
  }
  const ease = (x) => Math.min(1, Math.max(0, x));
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const g = ctx2d; g.clearRect(0, 0, w, h);
    const ink = (a) => `rgba(${INK},${a})`;
    const gut = Math.min(64, Math.max(44, w * 0.075)), meterW = 10, x0 = gut, x1 = w - meterW - 8, tw = x1 - x0;
    const waveH = Math.round(h * 0.2), laneTop = waveH + 10, laneH = (h - laneTop) / STEMS.length;
    const ph = state.phase, p = pos() / song.L, el = (performance.now() - state.t0) / 1000;
    g.font = `${Math.max(15, Math.min(22, h * 0.09))}px VT323, monospace`; g.textBaseline = "middle";

    // MIX.MP3
    g.fillStyle = ink(0.9); g.fillText("MIX.MP3", 2, waveH / 2);
    const scan = ph === "analyse" ? ease(el / 3) : 1;
    if (peaks) {
      const n = peaks.length;
      for (let i = 0; i < n; i++) {
        const fx = i / n; if (ph === "idle") break;
        const a = fx <= scan ? 0.85 : 0.25, hh = Math.max(1, peaks[i] * (waveH / 2 - 2));
        g.fillStyle = ink(a); g.fillRect(x0 + fx * tw, waveH / 2 - hh, Math.max(1, tw / n - 0.5), hh * 2);
      }
    } else {
      g.fillStyle = ink(0.25); for (let x = x0; x < x1; x += 3) g.fillRect(x, waveH / 2, 2, 1);
    }
    g.fillStyle = ink(0.8); g.fillRect(0, waveH + 4, w, 1.5);

    // couloirs des stems
    const order = { DRUMS: 0, BASS: 1, KEYS: 2, LEAD: 3 };
    const rec = ph === "recompose" ? ease(el / (Math.max(6000, song.L * 900) / 1000)) : 0;
    const shown = (x) => {
      if (ph === "idle" || ph === "analyse") return 0;
      if (ph !== "recompose") return 1;
      const k = rec * 4 - order[x.stem];               // chaque stem se révèle de gauche à droite à son tour
      return ease((k - x.t / song.L) * 6);
    };
    const level = {};
    STEMS.forEach((st, i) => {
      const y = laneTop + i * laneH;
      g.fillStyle = ink(0.9); g.fillText(st, 2, y + laneH / 2);
      g.fillStyle = ink(0.18); for (let x = x0; x < x1; x += 4) g.fillRect(x, y + laneH - 1, 2, 1);
      for (let b = 1; b < 4; b++) g.fillRect(x0 + (b / 4) * tw, y + 2, 1, laneH - 4);
    });
    const now = pos();
    for (const x of song.notes) {
      const a = shown(x); if (a <= 0) continue;
      const i = STEMS.indexOf(x.stem), y = laneTop + i * laneH, [lo, hi] = song.range[x.stem];
      const pad = 5, ih = laneH - pad * 2, rows = Math.max(1, hi - lo + 1);
      const nh = Math.max(4, Math.min(9, ih / 3.2));
      const ny = y + pad + (hi > lo ? (hi - x.n) / (hi - lo) : 0.5) * (ih - nh);
      const nx = x0 + (x.t / song.L) * tw, nw = Math.max(3, (x.d / song.L) * tw - 1);
      const on = playing && now >= x.t && now < x.t + Math.max(x.d, 0.12);
      if (on) level[x.stem] = Math.max(level[x.stem] || 0, x.v);
      if (ph === "recompose") {              // MIDI brut : contours, fraîchement détectés
        g.strokeStyle = ink(0.9 * a); g.lineWidth = 1.5; g.strokeRect(nx + 0.5, ny + 0.5, nw - 1, nh - 1);
        if (on) { g.fillStyle = ink(0.8); g.fillRect(nx, ny, nw, nh); }
      } else {
        const fill = ph === "timbre" ? 0.35 + 0.45 * x.v : 0.88;
        g.fillStyle = ink(on ? 1 : fill); g.fillRect(nx, ny, nw, nh);
        if (on && ph !== "timbre") { g.strokeStyle = ink(0.5); g.lineWidth = 1; g.strokeRect(nx - 2.5, ny - 2.5, nw + 5, nh + 5); }
      }
    }
    // vumètres par stem
    STEMS.forEach((st, i) => {
      const y = laneTop + i * laneH, lv = level[st] || 0; meter[st] = Math.max(lv, (meter[st] || 0) * 0.9);
      const mh = laneH - 8, seg = 5, n = Math.floor(mh / seg), lit = Math.round(meter[st] * n * (ph === "mix" || ph.startsWith("done") ? 1 : 0.75));
      for (let s = 0; s < n; s++) { g.fillStyle = ink(s < lit ? 0.9 : 0.15); g.fillRect(w - meterW - 2, y + laneH - 4 - (s + 1) * seg, meterW, seg - 2); }
    });
    // tête de lecture / balayage d'analyse
    if (playing) { const px = x0 + p * tw; g.fillStyle = ink(0.95); g.fillRect(px, 0, 2, h); }
    if (ph === "idle") {
      g.fillStyle = ink(0.55); g.textAlign = "center";
      g.fillText(`${DEMOS[sel].name} · ${DEMOS[sel].bpm} BPM · 4 STEMS`, x0 + tw / 2, laneTop + (h - laneTop) / 2);
      g.textAlign = "left";
    }
    if (ph === "analyse") {
      g.fillStyle = ink(0.12); g.fillRect(x0, laneTop, tw * scan, h - laneTop);
      g.fillStyle = ink(0.7); g.textAlign = "center"; g.fillText("ANALYSE SPECTRALE…", x0 + tw / 2, laneTop + (h - laneTop) / 2); g.textAlign = "left";
    }
  }
  const meter = {};
  let raf = 0;
  function loop() {
    raf = 0;
    if (glass.classList.contains("off") && playing) stop("ÉCRAN ÉTEINT · LECTURE ARRÊTÉE");
    draw();
    if (playing || state.phase === "analyse") raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(loop); }
  window.addEventListener("resize", kick);
  if (document.fonts) document.fonts.ready.then(kick);
  window.addEventListener("hashchange", () => setTimeout(kick, 60));
  kick();
})();
