// =========================================================
// TRADUCTION : le français du HTML est la langue source.
// i18n/<code>.json = { "texte français": "traduction" }.
// Tous les nœuds texte et les attributs accessibles sont traduits ;
// les textes produits par le JS passent par I18N.t("…", {variables}).
// =========================================================
window.I18N = (() => {
  const LANGS = {
    fr: "Français", en: "English", es: "Español", de: "Deutsch", it: "Italiano", pt: "Português", nl: "Nederlands",
    pl: "Polski", sv: "Svenska", da: "Dansk", nb: "Norsk", fi: "Suomi", cs: "Čeština", ro: "Română", hu: "Magyar",
    el: "Ελληνικά", tr: "Türkçe", ru: "Русский", uk: "Українська", ja: "日本語", zh: "中文", ko: "한국어",
  };
  // textes produits par le JS (gardés ici pour l'extraction des chaînes)
  const JS_STRINGS = [
    "ACCUEIL", "PLUGIN", "TARIF", "AUDIOWARE", "FAQ", "CONTACT", "INFOS LÉGALES", "LA PYRAMIDE", "LES GÉANTS", "LE CASQUE",
    "PAUSE", "PLAY ▶", "ANALYSE DE {name}.MP3…", "PASSE 1/3 · RECOMPOSITION MIDI — LES STEMS SORTENT",
    "PASSE 1/3 · RECOMPOSITION MIDI — STEM {stem} → {n}/4", "PASSE 2/3 · TIMBRES & ARTICULATION", "PASSE 3/3 · MIX, ESPACE & MASTER",
    "TERMINÉ · COMPAREZ L'ORIGINAL ET LE RÉSULTAT", "AUDIO INDISPONIBLE SUR CE NAVIGATEUR", "↻ RELANCER", "▶ LANCER LA DÉMO",
    "LECTURE ARRÊTÉE · RELANCEZ OU CHANGEZ DE MORCEAU", "{name} · {bpm} BPM — PRÊT", "LECTURE ARRÊTÉE", "ANALYSE SPECTRALE…",
    "ÉCRAN ÉTEINT · LECTURE ARRÊTÉE", "Malicious Music — MP3 to Stems & Audioware", "Langue",
  ];
  const ATTRS = ["aria-label", "alt", "placeholder", "title"];
  const SKIP = "script, style, select#lang, [translate='no'], [data-i18n-skip]";
  const norm = (s) => s.replace(/\s+/g, " ").trim();
  let lang = "fr", dict = {};
  const subs = [];
  const src = new WeakMap();               // nœud → texte français d'origine
  const srcAttr = new WeakMap();

  const t = (s, vars) => {
    let r = (lang !== "fr" && dict[s]) || s;
    if (vars) r = r.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return r;
  };
  function texts(root, cb) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (!n.nodeValue.trim() || (n.parentElement && n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let n; (n = w.nextNode()); ) cb(n);
  }
  function attrs(root, cb) {
    root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(",")).forEach((el) => {
      if (el.closest("script, style, select#lang")) return;
      ATTRS.forEach((a) => { if (el.hasAttribute(a) && el.getAttribute(a).trim()) cb(el, a); });
    });
  }
  function apply() {
    texts(document.body, (n) => {
      if (!src.has(n)) src.set(n, n.nodeValue);
      const fr = src.get(n), key = norm(fr), out = t(key);
      n.nodeValue = out === key ? fr : fr.match(/^\s*/)[0] + out + fr.match(/\s*$/)[0];
    });
    attrs(document.body, (el, a) => {
      let m = srcAttr.get(el); if (!m) srcAttr.set(el, (m = {}));
      if (!(a in m)) m[a] = el.getAttribute(a);
      el.setAttribute(a, t(norm(m[a])));
    });
    document.querySelectorAll('meta[name="description"], meta[property="og:description"], meta[property="og:title"], meta[property="og:image:alt"]').forEach((el) => {
      if (!el.dataset.fr) el.dataset.fr = el.content;
      el.content = t(el.dataset.fr);
    });
    document.documentElement.lang = lang;
  }
  async function set(code, save) {
    if (!LANGS[code]) code = "fr";
    if (code !== "fr") {
      try { const r = await fetch(`i18n/${code}.json?v=1`); dict = r.ok ? await r.json() : {}; } catch (e) { dict = {}; }
    } else dict = {};
    lang = code;
    if (save) { try { localStorage.setItem("mm-lang", code); } catch (e) {} }
    apply();
    const sel = document.getElementById("lang"); if (sel) sel.value = code;
    subs.forEach((f) => f(code));
  }
  function detect() {
    try { const s = localStorage.getItem("mm-lang"); if (s && LANGS[s]) return s; } catch (e) {}
    for (const l of navigator.languages || [navigator.language || "fr"]) {
      const b = l.toLowerCase().split("-")[0], c = b === "no" || b === "nn" ? "nb" : b;
      if (LANGS[c]) return c;
    }
    return "en";
  }
  // collecte des chaînes source (utilisée pour produire les fichiers de traduction)
  function collect() {
    const out = new Set(JS_STRINGS);
    texts(document.body, (n) => out.add(norm(src.get(n) || n.nodeValue)));
    attrs(document.body, (el, a) => out.add(norm((srcAttr.get(el) || {})[a] || el.getAttribute(a))));
    document.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:image:alt"]').forEach((el) => out.add(el.dataset.fr || el.content));
    return [...out].filter((s) => /\p{L}/u.test(s));
  }
  function init() {
    const sel = document.getElementById("lang");
    if (sel) {
      sel.innerHTML = Object.entries(LANGS).map(([k, v]) => `<option value="${k}">${k.toUpperCase()} · ${v}</option>`).join("");
      sel.addEventListener("change", () => set(sel.value, true));
    }
    set(detect(), false);
  }
  return { t, set, init, collect, onChange: (f) => subs.push(f), get lang() { return lang; }, LANGS };
})();
