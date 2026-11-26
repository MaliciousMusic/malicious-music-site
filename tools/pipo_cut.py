#!/usr/bin/env python3
"""Découpe la planche des Pipo (33 renards instrumentistes) en figurines détourées : assets/pipo/<id>.webp"""
import sys, json, pathlib
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

src = sys.argv[1]
root = pathlib.Path(__file__).resolve().parent.parent
out = root / "assets" / "pipo"; out.mkdir(parents=True, exist_ok=True)
im = Image.open(src).convert("RGB"); A = np.asarray(im).astype(np.int16)
H, W = A.shape[:2]
ROWS = [(50, 300), (323, 574), (597, 848), (871, 1122), (1146, H)]
LABELS = [[(120, 236), (325, 449), (590, 653), (804, 900), (1029, 1118), (1254, 1363), (1467, 1591), (1720, 1828)],
          [(122, 268), (347, 474), (583, 683), (803, 908), (980, 1185), (1268, 1344), (1494, 1578), (1661, 1875)],
          [(121, 253), (369, 437), (602, 668), (809, 920), (974, 1183), (1261, 1348), (1506, 1567), (1743, 1787)],
          [(157, 204), (350, 473), (597, 690), (828, 907), (1002, 1145), (1255, 1375), (1500, 1590), (1741, 1812)],
          [(131, 252)]]
NAMES = ["accordina", "accordeon", "banjo", "batterie", "bongos", "bouteille", "clarinette", "chanteur",
         "contrebasse", "cornemuse", "crecelle", "cymbale", "flute", "grelot", "guitare", "guitare-electrique",
         "harmonica", "harpe", "kazoo", "maracas", "orgue", "ocarina", "piano", "pipa",
         "pipo", "saxophone", "serpent", "synthe", "triangle", "trompette", "ukulele", "violon", "xylophone"]
# décalage du renard par rapport au centre du nom (étiquettes longues ou décalées)
DEGRAY = {"guitare-electrique", "pipa"}
REBUILD = {"pipa"}
FOX = {"contrebasse": -20, "flute": -10, "guitare-electrique": -5, "orgue": 0, "pipa": -5}
def cell(name):
    k = NAMES.index(name); r, c = (k // 8, k % 8) if k < 32 else (4, 0)
    (a, b), (y0, y1) = LABELS[r][c], ROWS[r]
    cx = (a + b) // 2 + FOX.get(name, 0)
    return cx, y0, y1, max(0, cx - 175), max(0, y0 - 30)

def fox_mask(name):
    """silhouette du renard seul : composante centrale, trous bouchés"""
    cx, y0, y1, x0, cy0 = cell(name)
    crop = A[cy0:min(H, y1 + 40), x0:min(W, cx + 175)]
    ink = (crop.min(2) < 228) | ((crop.max(2) - crop.min(2)) > 22)
    for (ty0, ty1) in [(28, 50), (301, 323), (575, 597), (849, 871), (1123, 1146)]:
        ink[max(0, ty0 - cy0 - 4):max(0, ty1 - cy0 + 4), :] = False
    lab, _ = ndi.label(ndi.binary_closing(ink, iterations=2), structure=np.ones((3, 3)))
    fy, fx = (y0 + y1) // 2 - cy0, cx - x0
    return ndi.binary_fill_holes(np.isin(lab, list(set(np.unique(lab[fy - 50:fy + 50, fx - 45:fx + 45])) - {0}))), crop

TPL, TPL_IMG = fox_mask("chanteur")
TPL_HEAD = TPL_IMG[:140].astype(np.float32).mean(2)

def aligned_template(crop):
    """recale le gabarit sur la tête du renard de la case (la tête n'est jamais cachée par l'instrument)"""
    g = crop.astype(np.float32).mean(2); best = (1e18, 0, 0)
    for dy in range(-14, 15, 2):
        for dx in range(-24, 25, 2):
            y0, x0 = 20 + dy, 40 + dx
            win = g[y0:y0 + 100, x0:x0 + 270]; ref = TPL_HEAD[20:120, 40:310]
            if win.shape != ref.shape: continue
            e = float(((win - ref) ** 2).mean())
            if e < best[0]: best = (e, dy, dx)
    _, dy, dx = best
    m = np.zeros(crop.shape[:2], bool)
    th, tw = TPL.shape
    for y in range(th):
        yy = y + dy
        if 0 <= yy < m.shape[0]:
            xs = np.nonzero(TPL[y])[0] + dx
            xs = xs[(xs >= 0) & (xs < m.shape[1])]
            m[yy, xs] = True
    return ndi.binary_dilation(m, iterations=2), dy, dx

i = 0
for r, (y0, y1) in enumerate(ROWS):
    for (a, b) in LABELS[r]:
        name = NAMES[i]; i += 1
        cx = (a + b) // 2 + FOX.get(name, 0)
        x0, x1 = max(0, cx - 175), min(W, cx + 175)
        cy0, cy1 = max(0, y0 - 30), min(H, y1 + 40)
        crop = A[cy0:cy1, x0:x1]
        ink = (crop.min(2) < 228) | ((crop.max(2) - crop.min(2)) > 22)          # tout ce qui n'est pas fond blanc
        # on exclut les étiquettes de texte (bandes des noms)
        for (ty0, ty1) in [(28, 50), (301, 323), (575, 597), (849, 871), (1123, 1146)]:
            ink[max(0, ty0 - cy0):max(0, ty1 - cy0), :] = False
        if name in DEGRAY:   # le piano voisin chevauche la case : renard = gabarit recalé, + l'instrument (couleurs franches ou noir)
            mx, mn = crop.max(2), crop.min(2)
            R, G, B = crop[..., 0], crop[..., 1], crop[..., 2]
            inst = ((mx - mn) > 40) | (mx < 70) if name == "guitare-electrique" else ((R - B > 45) & (R >= G))   # guitare noire ; pipa en bois
            for (ty0, ty1) in [(28, 50), (301, 323), (575, 597), (849, 871), (1123, 1146)]:
                inst[max(0, ty0 - cy0 - 4):max(0, ty1 - cy0 + 4), :] = False                   # pas les noms
            tpl, tdy, tdx = aligned_template(crop)
            inst &= ndi.binary_dilation(tpl, iterations=70)
            lab2, _ = ndi.label(inst | tpl, structure=np.ones((3, 3)))
            ink = np.isin(lab2, list(set(np.unique(lab2[tpl])) - {0})) & (tpl | inst)
            if name in REBUILD:   # renard masqué par le piano dans la planche : on repart du renard « chanteur » (même dessin)
                def head_c(img):
                    h = img[:140].astype(np.int16); m = (h[..., 0] - h[..., 2] > 90) & (h[..., 1] < 190)
                    ys, xs = np.nonzero(m); return int(ys.mean()), int(xs.mean())
                (ty, tx), (cy_, cx_) = head_c(TPL_IMG), head_c(crop)
                tdy, tdx = cy_ - ty, cx_ - tx
                tplm = np.zeros(crop.shape[:2], bool); base = np.full_like(crop, 255)
                th, tw = TPL_IMG.shape[:2]
                ys = slice(max(0, tdy), min(crop.shape[0], th + tdy)); xs = slice(max(0, tdx), min(crop.shape[1], tw + tdx))
                base[ys, xs] = TPL_IMG[ys.start - tdy:ys.stop - tdy, xs.start - tdx:xs.stop - tdx]
                tplm[ys, xs] = TPL[ys.start - tdy:ys.stop - tdy, xs.start - tdx:xs.stop - tdx]
                # le pipa : bois clair et chevilles rouge sombre, dans la diagonale de l'instrument (à droite du renard)
                R, G, B = crop[..., 0], crop[..., 1], crop[..., 2]
                wood = ((G > 150) & (B > 95) & (R - B > 30)) | ((R > 80) & (G < 75) & (B < 75) & (R - G > 25))
                zone = np.zeros_like(wood); zone[60:300, crop.shape[1] // 2 - 20:] = True
                pip = ndi.binary_opening(wood & zone, iterations=1)
                lab3, _ = ndi.label(pip, structure=np.ones((3, 3))); sizes = ndi.sum(pip, lab3, range(1, lab3.max() + 1))
                pip = np.isin(lab3, [k + 1 for k, sz in enumerate(sizes) if sz > 60])
                pip = ndi.binary_dilation(pip, iterations=1)
                crop = np.where(pip[..., None], crop, base); ink = tplm | pip
        ink = ndi.binary_closing(ink, iterations=2)
        lab, n = ndi.label(ink, structure=np.ones((3, 3)))
        # composante du renard : celle qui couvre le centre du corps
        fx, fy = cx - x0, (y0 + y1) // 2 - cy0
        core = lab[fy - 50:fy + 50, fx - 45:fx + 45]
        keep = set(np.unique(core)) - {0}
        mask = np.isin(lab, list(keep))
        mask = ndi.binary_fill_holes(mask)
        alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))
        rgba = Image.fromarray(crop.astype(np.uint8)).convert("RGBA"); rgba.putalpha(alpha)
        bb = rgba.getbbox(); rgba = rgba.crop(bb)
        rgba.thumbnail((260, 260), Image.LANCZOS)
        rgba.save(out / f"{name}.webp", quality=86, method=6)
print(i, "figurines")
