// =========================================================
// AUDIOWARE EN 3D : modèles à faces pleines, ombrées en encre LCD
// (algorithme du peintre + élimination des faces arrière)
// window.MM3D.draw(canvas, t, name)
// =========================================================
(() => {
  const INK = [38, 51, 44], LCD = [192, 210, 199];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp = (a, b, k) => add(a, mul(sub(b, a), k));
  const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
  const TAU = Math.PI * 2;

  // matériaux : a = densité d'encre (0 = fond LCD, 1 = encre pleine)
  const M = {
    black: { a: 0.86, edge: 0.9 }, frame: { a: 0.92 }, fabric: { a: 0.62 }, wood: { a: 0.5 },
    glass: { a: 0.2, glass: true, edge: 0.95, ds: true }, deck: { a: 0.7 }, vinyl: { a: 0.95 }, label: { a: 0.25 },
    metal: { a: 0.35 }, bud: { a: 0.8 }, tip: { a: 0.55 }, cable: { a: 0.85 },
    shell: { a: 0.3 }, cushion: { a: 0.55 }, pad: { a: 0.45 },
  };

  // ---------------- primitives ----------------
  function face(L, pts, mat, ref, deco, ds) { L.push({ pts, mat, ref, deco, ds: ds || mat.ds }); }
  function quad(L, a, b, c, d, mat, ref, deco) { face(L, [a, b, c, d], mat, ref, deco); }
  function frame(u, v) { u = norm(u); v = norm(v); return [u, v, norm(cross(u, v))]; }
  // cylindre d'axe p0 → p1
  function cyl(L, p0, p1, r0, r1, n, mat, caps = true, capMat) {
    const ax = norm(sub(p1, p0)), t = Math.abs(ax[1]) < 0.9 ? Y : X, u = norm(cross(ax, t)), v = cross(ax, u);
    const ring = (p, r) => Array.from({ length: n }, (_, i) => { const a = (i / n) * TAU; return add(p, add(mul(u, r * Math.cos(a)), mul(v, r * Math.sin(a)))); });
    const A = ring(p0, r0), B = ring(p1, r1), mid = lerp(p0, p1, 0.5);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; quad(L, A[i], A[j], B[j], B[i], mat, lerp(p0, p1, 0.5)); }
    if (caps) { face(L, A.slice().reverse(), capMat || mat, mid); face(L, B, capMat || mat, mid); }
    return { A, B, u, v, ax };
  }
  function ellipsoid(L, c, [u, v, w], [ru, rv, rw], nu, nv, mat) {
    const P = (i, j) => { const th = (i / nu) * TAU, ph = (j / nv) * Math.PI - Math.PI / 2;
      return add(c, add(add(mul(u, ru * Math.cos(ph) * Math.cos(th)), mul(w, rw * Math.cos(ph) * Math.sin(th))), mul(v, rv * Math.sin(ph)))); };
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) face(L, [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], mat, c);
  }
  function torus(L, c, [u, v, w], R, r, nu, nv, mat) { // anneau dans le plan (u, v), axe w
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const P = (ii, jj) => { const a = (ii / nu) * TAU, b = (jj / nv) * TAU, rad = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
        return add(c, add(mul(rad, R + r * Math.cos(b)), mul(w, r * Math.sin(b)))); };
      const a = ((i + 0.5) / nu) * TAU, core = add(c, mul(add(mul(u, Math.cos(a)), mul(v, Math.sin(a))), R));
      face(L, [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], mat, core);
    }
  }
  function tube(L, path, r, n, mat) { // câble le long d'une polyligne
    let prevU = null;
    const rings = path.map((p, i) => {
      const tng = norm(sub(path[Math.min(i + 1, path.length - 1)], path[Math.max(i - 1, 0)]));
      let u = prevU ? norm(sub(prevU, mul(tng, dot(prevU, tng)))) : norm(cross(tng, Math.abs(tng[1]) < 0.9 ? Y : X));
      prevU = u; const v = cross(tng, u);
      return Array.from({ length: n }, (_, k) => { const a = (k / n) * TAU; return add(p, add(mul(u, r * Math.cos(a)), mul(v, r * Math.sin(a)))); });
    });
    for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < n; k++) {
      const q = (k + 1) % n; face(L, [rings[i][k], rings[i][q], rings[i + 1][q], rings[i + 1][k]], mat, lerp(path[i], path[i + 1], 0.5));
    }
  }
  const bez = (p0, p1, p2, p3, n) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, s = 1 - t;
    return add(add(mul(p0, s * s * s), mul(p1, 3 * s * s * t)), add(mul(p2, 3 * s * t * t), mul(p3, t * t * t))); });
  const circlePts = (c, u, v, r, n = 28) => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * TAU; return add(c, add(mul(u, r * Math.cos(a)), mul(v, r * Math.sin(a)))); });

  // ---------------- LA PYRAMIDE ----------------
  // apex en haut ; bas : rangements de vinyles ; milieu : enceinte sous tissu ; haut : capot vitré
  // (platine dessous) qui s'ouvre sur une charnière arrière
  const PY = { apex: 1.7, base: -1, store: -0.42, deck: 0.42 };
  const pw = (y) => (PY.apex - y) / (PY.apex - PY.base);
  const corner = (y, i) => { const a = pw(y), s = [[-1, -1], [1, -1], [1, 1], [-1, 1]][i]; return [s[0] * a, y, s[1] * a]; };
  function buildPyramid() {
    const L = [], C = [0, -0.2, 0];
    // socle
    const sb = 0.9, y0 = -1.12;
    const bs = [[-sb, y0, -sb], [sb, y0, -sb], [sb, y0, sb], [-sb, y0, sb]];
    for (let i = 0; i < 4; i++) quad(L, bs[i], bs[(i + 1) % 4], corner(PY.base, (i + 1) % 4), corner(PY.base, i), M.frame, [0, -1.05, 0]);
    face(L, bs.slice().reverse(), M.frame, [0, -0.9, 0]);
    // rangements : 3 cases par face, vinyles debout, en retrait
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, a0 = corner(PY.base, i), a1 = corner(PY.base, j), b0 = corner(PY.store, i), b1 = corner(PY.store, j);
      const outN = norm(cross(Y, sub(a1, a0))), inset = mul(outN, -0.16);
      const P = (k, top) => lerp(top ? b0 : a0, top ? b1 : a1, 0.06 + 0.88 * k);
      // montants d'angle et lèvres
      quad(L, a0, P(0, 0), P(0, 1), b0, M.frame, C); quad(L, P(1, 0), a1, b1, P(1, 1), M.frame, C);
      for (let k = 0; k < 3; k++) {
        const k0 = k / 3, k1 = (k + 1) / 3, g = 0.035;
        const o0 = P(k0 + (k ? g : 0), 0), o1 = P(k1 - (k < 2 ? g : 0), 0), o2 = P(k1 - (k < 2 ? g : 0), 1), o3 = P(k0 + (k ? g : 0), 1);
        const i0 = add(o0, inset), i1 = add(o1, inset), i2 = add(o2, inset), i3 = add(o3, inset);
        face(L, [i0, i1, i2, i3], M.frame, C, null, true);                       // fond de la case
        quad(L, o0, o1, i1, i0, M.frame, add(C, [0, 1, 0]));                      // plancher
        quad(L, i3, i2, o2, o3, M.frame, add(C, [0, -1, 0]));                     // plafond
        // bloc de disques (tranches) légèrement en retrait de l'ouverture
        const r0 = add(lerp(o0, i0, 0.25), [0, 0.02, 0]), r1 = add(lerp(o1, i1, 0.25), [0, 0.02, 0]);
        const r2 = add(lerp(o2, i2, 0.3), [0, -0.05, 0]), r3 = add(lerp(o3, i3, 0.3), [0, -0.05, 0]);
        const deco = [];
        for (let s = 1; s < 16; s++) { const f = s / 16; deco.push([lerp(r0, r1, f), lerp(r3, r2, f + 0.04)]); }
        face(L, [r0, r1, r2, r3], M.wood, C, deco, true);
        if (k < 2) { const d0 = P(k1 - g, 0), d1 = P(k1 + g, 0), d2 = P(k1 + g, 1), d3 = P(k1 - g, 1); // séparateurs
          quad(L, d0, d1, d2, d3, M.frame, C); quad(L, d1, add(d1, inset), add(d2, inset), d2, M.frame, C); quad(L, add(d0, inset), d0, d3, add(d3, inset), M.frame, C); }
      }
    }
    // enceinte habillée de tissu
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4, a0 = corner(PY.store, i), a1 = corner(PY.store, j), b0 = corner(PY.deck, i), b1 = corner(PY.deck, j);
      const deco = [];
      for (let s = 1; s < 12; s++) { const f = s / 12; deco.push([lerp(a0, b0, f), lerp(a1, b1, f)]); }
      for (let s = 1; s < 18; s++) { const f = s / 18; deco.push([lerp(a0, a1, f), lerp(b0, b1, f)]); }
      quad(L, a0, a1, b1, b0, { ...M.fabric, edge: 0.9, decoA: 0.22 }, C, deco);
    }
    // plateau de la platine sous le capot
    const dk = [0, 1, 2, 3].map((i) => corner(PY.deck, i));
    face(L, dk.slice().reverse(), M.deck, [0, PY.deck - 0.2, 0], null, true);
    cyl(L, [0, PY.deck, 0.03], [0, PY.deck + 0.04, 0.03], 0.29, 0.29, 26, M.metal, true, M.vinyl);
    cyl(L, [0.31, PY.deck, -0.27], [0.31, PY.deck + 0.07, -0.27], 0.05, 0.05, 10, M.metal);
    return L;
  }
  function pyramidDyn(t) {
    const L = [];
    // disque qui tourne : sillons + repère d'étiquette
    const c = [0, PY.deck + 0.045, 0.03], a = t * 0.0035, deco = [];
    for (const r of [0.26, 0.22, 0.18, 0.14]) { const pts = circlePts(c, X, Z, r, 26); for (let i = 0; i < pts.length - 1; i++) deco.push([pts[i], pts[i + 1]]); }
    deco.push([add(c, [Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04]), add(c, [Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1])]);
    face(L, circlePts(c, X, Z, 0.285, 26).slice(0, -1), { ...M.vinyl, decoA: 0.35, decoLight: true }, add(c, [0, -1, 0]), deco, true);
    face(L, circlePts(add(c, [0, 0.002, 0]), X, Z, 0.09, 16).slice(0, -1), M.label, add(c, [0, -1, 0]), null, true);
    // bras de lecture
    tube(L, [[0.31, PY.deck + 0.08, -0.27], [0.27, PY.deck + 0.09, -0.05], [0.13, PY.deck + 0.07, 0.12]], 0.014, 5, M.metal);
    // capot vitré : pyramide supérieure, charnière sur l'arête arrière
    const open = 0.5 - 0.5 * Math.cos(Math.min(1, Math.max(0, Math.sin(t * 0.00045) * 1.4 - 0.2)) * Math.PI);
    const ang = open * 0.75, hz = -pw(PY.deck), hy = PY.deck;
    const rot = (p) => { const y = p[1] - hy, z = p[2] - hz; return [p[0], hy + y * Math.cos(ang) + z * Math.sin(ang), hz - y * Math.sin(ang) + z * Math.cos(ang)]; };
    const base = [0, 1, 2, 3].map((i) => rot(add(corner(PY.deck, i), [0, 0.005, 0])));
    const apex = rot([0, PY.apex, 0]), ref = rot([0, PY.deck + 0.35, 0]);
    for (let i = 0; i < 4; i++) face(L, [base[i], base[(i + 1) % 4], apex], M.glass, ref);
    return L;
  }

  // ---------------- LES GÉANTS : écouteurs filaires XXL, couchés, câble jusqu'au jack ----------------
  function buildBuds() {
    const L = [], G = -0.62, ends = [];
    [-1, 1].forEach((s) => {
      const hc = [s * 0.58, G + 0.36, -0.32];
      // tête couchée : coque légèrement aplatie
      const fr = frame([1, 0, 0], [0, 1, 0]);
      ellipsoid(L, hc, fr, [0.4, 0.34, 0.4], 18, 10, M.bud);
      // embout (vers l'extérieur et un peu vers le haut)
      const dir = norm([s * 0.75, 0.55, -0.2]);
      const e0 = add(hc, mul(dir, 0.3)), e1 = add(hc, mul(dir, 0.5));
      cyl(L, e0, e1, 0.17, 0.2, 18, M.tip, false);
      const cap = cyl(L, e1, add(e1, mul(dir, 0.04)), 0.2, 0.15, 18, M.tip, true, M.metal);
      // tige qui descend vers l'avant, posée sur la table
      const sd = norm([-s * 0.3, -0.42, 1]), st0 = add(hc, mul(sd, 0.2)), st1 = add(hc, mul(sd, 0.78));
      cyl(L, st0, st1, 0.12, 0.1, 14, M.bud, true);
      ellipsoid(L, st1, frame(X, Y), [0.1, 0.1, 0.1], 10, 6, M.bud);
      ends.push(add(st1, mul(sd, 0.08)));
    });
    // câbles → séparateur en Y → câble unique → jack
    const yS = [0, G + 0.05, 0.72];
    ends.forEach((e, i) => tube(L, bez(e, add(e, [0, -0.06, 0.25]), add(yS, [(i ? 1 : -1) * 0.25, 0, -0.2]), yS, 14), 0.032, 6, M.cable));
    cyl(L, add(yS, [0, 0, -0.06]), add(yS, [0, 0, 0.1]), 0.055, 0.045, 10, M.bud);
    const j0 = [0.78, G + 0.06, 0.62];
    tube(L, bez(add(yS, [0, 0, 0.1]), [0.15, G + 0.04, 1.25], [0.85, G + 0.04, 1.2], j0, 22), 0.032, 6, M.cable);
    // prise jack 3,5 mm
    const jd = norm([0.05, 0.02, -1]), j1 = add(j0, mul(jd, 0.06)), j2 = add(j0, mul(jd, 0.34));
    cyl(L, j0, j1, 0.035, 0.06, 10, M.bud);
    cyl(L, j1, j2, 0.075, 0.075, 14, M.bud);
    const p0 = add(j2, mul(jd, 0.03)); cyl(L, j2, p0, 0.05, 0.05, 12, M.metal);
    const segs = [[0.06, M.metal], [0.012, M.bud], [0.05, M.metal], [0.012, M.bud], [0.05, M.metal]];
    let p = p0; for (const [len, m] of segs) { const q = add(p, mul(jd, len)); cyl(L, p, q, 0.028, 0.028, 10, m); p = q; }
    cyl(L, p, add(p, mul(jd, 0.03)), 0.028, 0.012, 10, M.metal);
    return L;
  }

  // ---------------- LE CASQUE (d'après la photo de référence) ----------------
  function buildPhones() {
    const L = [], R = 0.86, cy = 0.18, bw = 0.17, bt = 0.07, n = 22;
    // arceau : bande plate en arc
    const arc = (r, a0, a1, hw, th, mat, k) => {
      const P = (a, dr, dz) => [Math.cos(a) * (r + dr), cy + Math.sin(a) * (r + dr), dz];
      for (let i = 0; i < k; i++) {
        const a = a0 + ((a1 - a0) * i) / k, b = a0 + ((a1 - a0) * (i + 1)) / k, m = (a + b) / 2, ref = [Math.cos(m) * r, cy + Math.sin(m) * r, 0];
        quad(L, P(a, th, -hw), P(b, th, -hw), P(b, th, hw), P(a, th, hw), mat, ref);
        quad(L, P(a, -th, hw), P(b, -th, hw), P(b, -th, -hw), P(a, -th, -hw), mat, ref);
        quad(L, P(a, -th, -hw), P(b, -th, -hw), P(b, th, -hw), P(a, th, -hw), mat, ref);
        quad(L, P(a, th, hw), P(b, th, hw), P(b, -th, hw), P(a, -th, hw), mat, ref);
      }
    };
    arc(R, 0, Math.PI, bw, bt, M.shell, n);
    arc(R - 0.11, Math.PI * 0.3, Math.PI * 0.7, bw * 0.75, 0.035, M.pad, 8); // coussinet sous l'arceau
    [-1, 1].forEach((s) => {
      // coulisses crantées
      const x0 = s * R, top = cy, bot = cy - 0.42;
      const box = (xa, ya, yb, hx, hz, mat, deco) => {
        const p = (dx, y, dz) => [xa + dx, y, dz];
        const ref = [xa, (ya + yb) / 2, 0];
        quad(L, p(-hx, ya, hz), p(hx, ya, hz), p(hx, yb, hz), p(-hx, yb, hz), mat, ref, deco);
        quad(L, p(hx, ya, -hz), p(-hx, ya, -hz), p(-hx, yb, -hz), p(hx, yb, -hz), mat, ref, deco);
        quad(L, p(hx, ya, hz), p(hx, ya, -hz), p(hx, yb, -hz), p(hx, yb, hz), mat, ref);
        quad(L, p(-hx, ya, -hz), p(-hx, ya, hz), p(-hx, yb, hz), p(-hx, yb, -hz), mat, ref);
      };
      const ridges = []; for (let k = 1; k < 6; k++) { const y = top - 0.03 - k * 0.035; ridges.push([[x0 - 0.06, y, bw * 0.92], [x0 + 0.06, y, bw * 0.92]], [[x0 + 0.06, y, -bw * 0.92], [x0 - 0.06, y, -bw * 0.92]]); }
      box(x0, top, bot, 0.06, bw * 0.92, { ...M.shell, decoA: 0.5 }, ridges);
      // coque d'écouteur
      const c = [s * 0.86, -0.5, 0], ax = [s, 0, 0];
      const outer = add(c, mul(ax, 0.12)), inner = add(c, mul(ax, -0.1));
      cyl(L, inner, outer, 0.46, 0.44, 30, M.shell, false);
      // face extérieure bombée + commandes
      const plate = add(outer, mul(ax, 0.035)), u = [0, 0, 1], v = [0, 1, 0], deco = [];
      const ringPts = (r) => circlePts(plate, u, v, r, 26);
      [ringPts(0.27), ringPts(0.14)].forEach((pts) => { for (let i = 0; i < pts.length - 1; i++) deco.push([pts[i], pts[i + 1]]); });
      const at = (du, dv) => add(plate, add(mul(u, du * s), mul(v, dv)));
      deco.push([at(-0.025, 0.33), at(0.025, 0.33)], [at(0, 0.305), at(0, 0.355)]);           // +
      deco.push([at(-0.025, -0.33), at(0.025, -0.33)]);                                          // −
      deco.push([at(-0.04, 0.025), at(-0.04, -0.025), at(0.0, 0), at(-0.04, 0.025)], [at(0.02, 0.025), at(0.02, -0.025)], [at(0.04, 0.025), at(0.04, -0.025)]); // ▶||
      deco.push([at(-0.36, 0.02), at(-0.36, -0.02)], [at(-0.3, 0.02), at(-0.34, 0), at(-0.3, -0.02), at(-0.3, 0.02)]);   // ⏮
      deco.push([at(0.36, 0.02), at(0.36, -0.02)], [at(0.3, 0.02), at(0.34, 0), at(0.3, -0.02), at(0.3, 0.02)]);         // ⏭
      cyl(L, outer, plate, 0.44, 0.4, 30, M.shell, false);
      face(L, ringPts(0.4).slice(0, -1), { ...M.shell, decoA: 0.75 }, c, deco);
      // coussin d'oreille (tore) côté intérieur
      const cc = add(inner, mul(ax, -0.1));
      torus(L, cc, [[0, 0, 1], [0, 1, 0], ax], 0.32, 0.13, 26, 9, M.cushion);
      face(L, circlePts(add(cc, mul(ax, 0.06)), [0, 0, 1], [0, 1, 0], 0.22, 20).slice(0, -1), M.pad, c, null, true);
      // fourche qui relie coulisse et coque
      tube(L, [[x0, bot, 0], [x0 + s * 0.01, bot - 0.05, 0], [s * 0.86, -0.5 + 0.46, 0]], 0.04, 6, M.shell);
    });
    return L;
  }

  const MODELS = { pyramid: { L: buildPyramid(), dyn: pyramidDyn, s: 0.54, y: 0.28, ground: -1.12, gw: 1.25 }, buds: { L: buildBuds(), s: 0.95, y: -0.3, ground: -0.64, gw: 1.15 }, phones: { L: buildPhones(), s: 0.72, y: 0.02, ground: -1.0, gw: 1.0 } };

  // ---------------- rendu ----------------
  const LIGHT = norm([-0.45, 0.75, -0.55]);
  const mix = (k) => `rgb(${LCD.map((c, i) => Math.round(c + (INK[i] - c) * k)).join(",")})`;
  function draw(c, t, name, orbit) {
    const m = MODELS[name]; if (!m) return;
    const g = c.getContext("2d"), w = c.width, h = c.height;
    g.clearRect(0, 0, w, h);
    const ay = orbit ? orbit.ay : t * 0.00045 + 0.6, ax = orbit ? orbit.ax : 0.36;
    const cY = Math.cos(ay), sY = Math.sin(ay), cX = Math.cos(ax), sX = Math.sin(ax);
    const scale = Math.min(w * 0.36, h * 0.46) * m.s * (orbit ? orbit.zoom : 1), cam = 5;
    const view = (p) => { const x1 = p[0] * cY + p[2] * sY, z1 = -p[0] * sY + p[2] * cY; return [x1, p[1] * cX - z1 * sX, p[1] * sX + z1 * cX]; };
    const proj = (q) => { const k = cam / (cam + q[2]); return [w / 2 + q[0] * k * scale, h * 0.5 - (q[1] - m.y) * k * scale]; };
    // ombre portée au sol
    g.fillStyle = `rgba(${INK},.13)`; g.beginPath(); g.ellipse(w / 2, h * 0.5 - (m.ground - m.y) * scale * cX, scale * m.gw, scale * 0.28, 0, 0, TAU); g.fill();
    const items = [];
    const all = m.dyn ? m.L.concat(m.dyn(t)) : m.L;
    for (const f of all) {
      const V = f.pts.map(view);
      let n = norm(cross(sub(V[1], V[0]), sub(V[2], V[0])));
      const cen = mul(V.reduce((a, b) => add(a, b), [0, 0, 0]), 1 / V.length);
      if (dot(n, sub(cen, view(f.ref))) < 0) n = mul(n, -1);
      if (!f.ds && n[2] > 0.02) continue;                    // face arrière
      const facing = n[2] > 0 ? mul(n, -1) : n;
      items.push({ f, V, z: cen[2], lit: Math.max(0, dot(facing, LIGHT)), spec: Math.max(0, dot(facing, norm([0.2, 0.6, -1]))) });
    }
    items.sort((a, b) => b.z - a.z);
    g.lineJoin = "round";
    for (const it of items) {
      const { f, V } = it, mt = f.mat, P = V.map(proj);
      g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      const shade = mt.a * (0.5 + 0.5 * (1 - it.lit)) - (mt.glass ? 0 : 0.18 * it.spec ** 12);
      if (mt.glass) { g.fillStyle = `rgba(${INK},${(mt.a * (0.6 + 0.4 * (1 - it.lit))).toFixed(3)})`; g.fill(); }
      else { const col = mix(Math.max(0.04, Math.min(1, shade))); g.fillStyle = col; g.fill(); g.strokeStyle = col; g.lineWidth = 0.8; g.stroke(); }
      if (mt.edge) { g.strokeStyle = `rgba(${INK},${mt.edge})`; g.lineWidth = mt.glass ? 1.4 : 1.1; g.stroke(); }
      if (f.deco) {
        g.beginPath();
        for (const ln of f.deco) ln.forEach((p, i) => { const q = proj(view(p)); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
        g.strokeStyle = mt.decoLight ? `rgba(${LCD},${mt.decoA || 0.3})` : `rgba(${INK},${mt.decoA || 0.55})`; g.lineWidth = 0.9; g.stroke();
      }
    }
  }
  window.MM3D = { draw };
})();
