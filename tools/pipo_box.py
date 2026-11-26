#!/usr/bin/env python3
"""Dessine la blind box des Pipo en pixel art LCD deux tons : assets/pipo/box.png (boîte) et box-lid.png (couvercle),
même cadre pour qu'ils se superposent exactement."""
import pathlib
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

root = pathlib.Path(__file__).resolve().parent.parent
INK, LIGHT, T = (38, 51, 44, 255), (198, 217, 205, 255), (0, 0, 0, 0)
W, H = 88, 92
# petite police 3×5
FONT = {"P": ["111", "101", "111", "100", "100"], "I": ["111", "010", "010", "010", "111"], "O": ["111", "101", "101", "101", "111"],
        "B": ["110", "101", "110", "101", "110"], "L": ["100", "100", "100", "100", "111"], "N": ["101", "111", "111", "111", "101"],
        "D": ["110", "101", "101", "101", "110"], "X": ["101", "101", "010", "101", "101"], " ": ["000"] * 5, "?": ["111", "001", "011", "000", "010"]}
def text(d, x, y, s, col, k=1):
    for ch in s:
        for j, row in enumerate(FONT[ch]):
            for i, b in enumerate(row):
                if b == "1": d.rectangle([x + i * k, y + j * k, x + i * k + k - 1, y + j * k + k - 1], fill=col)
        x += 4 * k
QM = ["0111110", "1111111", "1100011", "0000111", "0001110", "0011100", "0011000", "0000000", "0011000", "0011000"]

# géométrie : face avant, côté droit en perspective, dessus
FX0, FX1, FY0, FY1 = 6, 60, 30, 88          # face avant
DX, DY = 18, -12                             # fuite du côté / dessus
def side(y0, y1): return [(FX1, y0), (FX1 + DX, y0 + DY), (FX1 + DX, y1 + DY), (FX1, y1)]

# ---------- boîte ----------
box = Image.new("RGBA", (W, H), T); d = ImageDraw.Draw(box)
# côté droit : encre tramée (ombre)
d.polygon(side(FY0, FY1), fill=INK)
m = Image.new("L", (W, H), 0); ImageDraw.Draw(m).polygon(side(FY0, FY1), fill=255)
inner = ndi.binary_erosion(np.asarray(m) > 0, iterations=1)
for y, x in zip(*np.nonzero(inner)):
    if (x + y) % 3 == 0: box.putpixel((int(x), int(y)), LIGHT)
d.polygon(side(FY0, FY1), outline=INK)
# face avant
d.rectangle([FX0, FY0, FX1, FY1], fill=LIGHT, outline=INK)
d.rectangle([FX0 + 2, FY0 + 2, FX1 - 2, FY1 - 2], outline=INK)
# silhouette mystère d'un Pipo (renard chanteur, tout en encre) avec un « ? » clair dessus
fox = Image.open(root / "assets" / "pipo" / "chanteur.png").convert("RGBA")
fh = 40; fox = fox.resize((round(fox.width * fh / fox.height), fh), Image.NEAREST)
sil = Image.new("RGBA", fox.size, T); sa = np.asarray(fox)[..., 3] > 0
sil_arr = np.zeros((*sa.shape, 4), np.uint8); sil_arr[sa] = INK; sil = Image.fromarray(sil_arr, "RGBA")
fx = (FX0 + FX1) // 2 - fox.width // 2; fy = FY0 + 6
box.alpha_composite(sil, (fx, fy))
for j, row in enumerate(QM):
    for i, b in enumerate(row):
        if b == "1": d.rectangle([fx + fox.width // 2 - 7 + i * 2, fy + 14 + j * 2, fx + fox.width // 2 - 6 + i * 2, fy + 15 + j * 2], fill=LIGHT)
# bandeau du bas : PIPO
d.rectangle([FX0 + 2, FY1 - 11, FX1 - 2, FY1 - 2], fill=INK)
text(d, (FX0 + FX1) // 2 - 8, FY1 - 9, "PIPO", LIGHT)
# petites étoiles « collector » sur le côté
for (x, y) in [(FX1 + 8, FY0 + 6), (FX1 + 12, FY0 + 22), (FX1 + 7, FY0 + 36)]:
    for dx, dy in [(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)]:
        box.putpixel((x + dx, y + dy), LIGHT)
box.save(root / "assets" / "pipo" / "box.png", optimize=True)

# ---------- couvercle (déborde un peu, avec un ruban adhésif) ----------
lid = Image.new("RGBA", (W, H), T); d = ImageDraw.Draw(lid)
o, LY0, LY1 = 2, FY0 - 2, FY0 + 9            # débord, haut et bas de la bande avant du couvercle
top = [(FX0 - o, LY0), (FX0 - o + DX, LY0 + DY), (FX1 + o + DX, LY0 + DY), (FX1 + o, LY0)]
d.polygon(top, fill=LIGHT, outline=INK)
d.polygon([(FX1 + o, LY0), (FX1 + o + DX, LY0 + DY), (FX1 + o + DX, LY1 + DY), (FX1 + o, LY1)], fill=INK, outline=INK)
d.rectangle([FX0 - o, LY0, FX1 + o, LY1], fill=LIGHT, outline=INK)
d.line([(FX0 - o + 1, LY1 - 2), (FX1 + o - 1, LY1 - 2)], fill=INK)
# ruban adhésif au milieu, sur le dessus et la bande avant
cx = (FX0 + FX1) // 2
for k in range(-3, 4):
    d.line([(cx + k, LY1), (cx + k, LY0)], fill=INK if abs(k) == 3 else LIGHT)
    d.line([(cx + k, LY0), (cx + k + DX, LY0 + DY)], fill=INK if abs(k) == 3 else LIGHT)
for t in range(0, 7, 2): lid.putpixel((cx - 1, LY0 + 2 + t // 2), INK)
text(d, FX0 + 2, LY0 + 3, "BLIND", INK); text(d, cx + 6, LY0 + 3, "BOX", INK)
lid.save(root / "assets" / "pipo" / "box-lid.png", optimize=True)
print("box ok")
