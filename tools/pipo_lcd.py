#!/usr/bin/env python3
"""Recalcule les Pipo couleur (design/pipo/*.webp) en pixel art LCD deux tons, comme le bar de l'écran de chargement :
encre pour les contours et les zones sombres, vert clair pour les zones claires, fond transparent. → assets/pipo/<id>.png"""
import pathlib, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

root = pathlib.Path(__file__).resolve().parent.parent
src, out = root / "design" / "pipo", root / "assets" / "pipo"
out.mkdir(parents=True, exist_ok=True)
INK, LIGHT = (38, 51, 44), (198, 217, 205)
H = int(sys.argv[1]) if len(sys.argv) > 1 else 84          # hauteur en pixels LCD

for f in sorted(src.glob("*.webp")):
    im = Image.open(f).convert("RGBA")
    a = np.asarray(im.split()[3]).astype(np.float32) / 255
    rgb = np.asarray(im.convert("RGB")).astype(np.float32) / 255
    L = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    # traits fins (yeux, nez, cordes) : on épaissit le sombre avant de réduire pour qu'ils survivent
    L_img = Image.fromarray((L * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))
    w = max(8, round(im.width * H / im.height))
    Ls = np.asarray(L_img.resize((w, H), Image.BOX)).astype(np.float32) / 255
    As = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((w, H), Image.BOX)).astype(np.float32) / 255
    shape = As > 0.45
    shape = ndi.binary_opening(shape, structure=np.ones((2, 2))) | (As > 0.8)
    dark = shape & (Ls < 0.66)                                   # fourrure orange, instruments, traits
    edge = shape & ~ndi.binary_erosion(shape, structure=np.ones((3, 3)))   # contour extérieur
    # le renard (orange, crème, rose, pattes brunes) d'un côté, l'instrument de l'autre :
    # un liseré clair sépare un instrument sombre d'une fourrure sombre
    hsv = np.asarray(im.convert("RGB").convert("HSV")).astype(np.float32) / 255
    hue, sat, val = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    fox = ((hue > 6) & (hue < 50) & (sat > 0.22) & (val > 0.35)) | ((val > 0.74) & (sat < 0.38))
    inst = (a > 0.6) & ~ndi.binary_opening(fox, iterations=1)
    inst = ndi.binary_opening(inst, iterations=1)
    inst_s = np.asarray(Image.fromarray((inst * 255).astype(np.uint8)).resize((w, H), Image.BOX)).astype(np.float32) / 255 > 0.5
    ring = ndi.binary_dilation(inst_s, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]])) & ~inst_s
    sep = ring & dark & ndi.binary_erosion(shape, structure=np.ones((3, 3)))
    ink = (dark & ~sep) | edge
    # nettoyage : pas de pixel clair isolé dans l'encre, ni de pixel d'encre seul dans le clair
    light = shape & ~ink
    n_ink = ndi.convolve(ink.astype(int), np.ones((3, 3), int), mode="constant") - ink
    ink |= light & (n_ink >= 7)
    ink &= ~(~edge & (ndi.convolve(ink.astype(int), np.ones((3, 3), int), mode="constant") - 1 == 0))
    rgba = np.zeros((H, w, 4), np.uint8)
    rgba[shape & ~ink] = (*LIGHT, 255)
    rgba[ink] = (*INK, 255)
    Image.fromarray(rgba, "RGBA").save(out / (f.stem + ".png"), optimize=True)
print(len(list(out.glob("*.png"))), "Pipo LCD")
