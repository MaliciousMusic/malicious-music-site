#!/usr/bin/env python3
"""Vérifie que chaque i18n/<code>.json couvre toutes les chaînes de i18n/_source.json, sans clé en trop, avec ses {variables}."""
import json, re, pathlib, sys
root = pathlib.Path(__file__).resolve().parent.parent / "i18n"
src = json.loads((root / "_source.json").read_text(encoding="utf-8"))
ok = True
for f in sorted(root.glob("[a-z][a-z].json")):
    d = json.loads(f.read_text(encoding="utf-8"))
    missing = [s for s in src if s not in d]
    extra = [k for k in d if k not in src]
    vars_bad = [s for s in src if s in d and set(re.findall(r"\{\w+\}", s)) != set(re.findall(r"\{\w+\}", d[s]))]
    empty = [s for s in src if s in d and not str(d[s]).strip()]
    status = "OK" if not (missing or extra or vars_bad or empty) else "ERREUR"
    ok &= status == "OK"
    print(f"{f.stem}: {status} ({len(d)} chaînes, manquantes {len(missing)}, en trop {len(extra)}, variables {len(vars_bad)}, vides {len(empty)})")
sys.exit(0 if ok else 1)
