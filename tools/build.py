#!/usr/bin/env python3
"""Construit dist/ pour Cloudflare Pages : liste blanche de fichiers, domaine, security.txt.

  python3 tools/build.py           production : refuse si un texte légal reste à compléter
  python3 tools/build.py --draft   aperçu : construit quand même, interdit à l'indexation
"""
import datetime, json, pathlib, re, shutil, sys

root = pathlib.Path(__file__).resolve().parent.parent
dist = root / "dist"
draft = "--draft" in sys.argv
cfg = json.loads((root / "cloudflare/site.json").read_text(encoding="utf-8"))
base = f"https://{cfg['domain']}/"
html = (root / "index.html").read_text(encoding="utf-8")

# ---- contrôles ----
problems = []
ph = re.compile(r'<span class="ph">(.*?)</span>', re.S)
def part(i, j):
    return html[html.index(f'id="{i}"'):html.index(f'id="{j}"') if j else len(html)]
# obligatoires dès la mise en ligne : en-tête légal, mentions, confidentialité, cookies
for name, a, b in (("version des textes", "legal", "mentions"), ("mentions légales", "mentions", "cgv"), ("confidentialité", "confidentialite", "cookies"), ("cookies", "cookies", "bezel")):
    left = ph.findall(part(a, b))
    if left:
        problems.append(f"{name} : {len(left)} champ(s) à compléter : " + ", ".join(left))
contact = cfg["security_contact"]
try:
    exp = datetime.date.fromisoformat(cfg["security_expires"])
    today = datetime.date.today()
    if not today < exp <= today + datetime.timedelta(days=365):
        problems.append("security_expires : date future à moins d'un an attendue")
except ValueError:
    problems.append("security_expires : date AAAA-MM-JJ attendue dans cloudflare/site.json")
if not re.fullmatch(r"(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https://\S+)", contact):
    problems.append("security_contact : mailto:… ou https://… attendu dans cloudflare/site.json")
if problems and not draft:
    sys.exit("Production refusée :\n- " + "\n- ".join(problems))
rest = len(ph.findall(html))
print(f"{rest} texte(s) entre crochets dans la page" + (f" ; brouillon, {len(problems)} point(s) bloquant(s)" if problems else ""))

# ---- copie (liste blanche) ----
shutil.rmtree(dist, ignore_errors=True)
dist.mkdir()
for f in ("index.html", "404.html", "404.css", "styles.css", "boot.js", "i18n.js", "models.js", "main.js", "demo.js"):
    shutil.copy(root / f, dist / f)
(dist / "i18n").mkdir()
for f in (root / "i18n").glob("[a-z][a-z].json"):
    shutil.copy(f, dist / "i18n" / f.name)
used = set()
for f in ("index.html", "404.html", "404.css", "styles.css", "main.js", "models.js", "demo.js"):
    used |= set(re.findall(r"assets/[\w./-]+\.\w+", (root / f).read_text(encoding="utf-8")))
used.add("assets/fonts/OFL.txt")
for a in sorted(used):
    (dist / a).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(root / a, dist / a)

# ---- domaine ----
old = re.search(r'<link rel="canonical" href="([^"]+)"', html).group(1)
out = html.replace(old, base)
headers = (root / "cloudflare/_headers").read_text(encoding="utf-8")
if draft:
    out = out.replace("</title>", '</title>\n  <meta name="robots" content="noindex" />', 1)
    headers = headers.replace("\n/*\n", "\n/*\n  X-Robots-Tag: noindex\n", 1)
(dist / "index.html").write_text(out, encoding="utf-8")
(dist / "_headers").write_text(headers, encoding="utf-8")
(dist / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {base}sitemap.xml\n", encoding="utf-8")
(dist / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>{base}</loc></url>\n</urlset>\n', encoding="utf-8")
if not any(p.startswith("security_") for p in problems):
    (dist / ".well-known").mkdir()
    (dist / ".well-known/security.txt").write_text(f"Contact: {contact}\nExpires: {exp.isoformat()}T00:00:00Z\nPreferred-Languages: fr, en\nCanonical: {base}.well-known/security.txt\n", encoding="utf-8")
print(sum(1 for f in dist.rglob("*") if f.is_file()), "fichiers dans dist/")
