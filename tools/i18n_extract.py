#!/usr/bin/env python3
"""Extrait les chaînes françaises à traduire (même logique que i18n.js) vers i18n/_source.json."""
import json, re, pathlib
from bs4 import BeautifulSoup, NavigableString, Comment

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
soup = BeautifulSoup(html, "html.parser")
norm = lambda s: re.sub(r"\s+", " ", s).strip()
js = (root / "i18n.js").read_text(encoding="utf-8")
block = re.search(r"const JS_STRINGS = \[(.*?)\];", js, re.S).group(1)
out = [json.loads(m) for m in re.findall(r'"(?:[^"\\]|\\.)*"', block)]

def skipped(el, attr=False):
    for p in [el] + list(el.parents):
        if getattr(p, "name", None) in ("script", "style", "head"):
            return True
        if p.name == "select" and p.get("id") == "lang":
            return True
        if not attr and (p.get("translate") == "no" or p.has_attr("data-i18n-skip")):
            return True
    return False

for s in soup.body.descendants:
    if isinstance(s, NavigableString) and not isinstance(s, Comment) and s.strip():
        if not skipped(s.parent):
            out.append(norm(s))
for el in soup.body.find_all(True):
    for a in ("aria-label", "alt", "placeholder", "title"):
        if el.has_attr(a) and el[a].strip() and not skipped(el, True):
            out.append(norm(el[a]))
for sel in ('meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:image:alt"]'):
    m = soup.select_one(sel)
    if m: out.append(m["content"])
seen, res = set(), []
for s in out:
    if s not in seen and re.search(r"[^\W\d_]", s):
        seen.add(s); res.append(s)
(root / "i18n" / "_source.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
print(len(res), "chaînes")
