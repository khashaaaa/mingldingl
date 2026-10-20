"""Play feature graphic 1024x500: relit bond medallion + gold Pirata One title on the World Floor."""
import sys, math, numpy as np
sys.path.insert(0, ".")
import forge as F
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage as ndi

OUT = sys.argv[1]
W, H = 2048, 1000
yy, xx = np.mgrid[0:H, 0:W].astype(float)
t = np.clip(1 - np.hypot(xx - W * 0.5, yy - H * 0.45) / (W * 0.6), 0, 1)
col = F.mix((6, 9, 18), (15, 20, 36), t)
gl = np.clip(1 - np.hypot(xx - W * 0.24, yy - H * 0.5) / (H * 0.62), 0, 1) ** 2.2 * 0.7
col = col + gl[..., None] * np.array([170, 90, 25]) * 0.55
e = np.clip((yy / H - 0.55) / 0.45, 0, 1) ** 2 * 0.7
col = col + e[..., None] * np.array([176, 50, 18]) * 0.7
im = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8)).convert("RGBA")
r = np.random.default_rng(4)
d = ImageDraw.Draw(im)
for _ in range(120):
    x, y = r.integers(0, W), r.integers(0, int(H * 0.7))
    a = int(r.integers(50, 160)); s = int(r.choice([1, 2, 2, 3]))
    if math.hypot(x - W * 0.24, y - H * 0.5) < H * 0.45:
        continue
    d.ellipse([x - s, y - s, x + s, y + s], fill=(a, a, int(a * .85), 255))
lay = Image.new("RGBA", (W, H), (0, 0, 0, 0)); dl = ImageDraw.Draw(lay)
for _ in range(90):
    x = r.uniform(0, W); y = H - abs(r.normal(0, H * 0.3)); s = float(r.choice([3, 4, 5, 8]))
    dl.ellipse([x - s, y - s, x + s, y + s], fill=(255, int(r.integers(120, 200)), 50, int(r.integers(120, 240))))
im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(2.5))); im.alpha_composite(lay.filter(ImageFilter.GaussianBlur(10)))

med = Image.open("src/medal_lit.png").convert("RGBA")
med = med.crop(med.getbbox()).resize((740, 740), Image.LANCZOS)
mx, my = int(W * 0.24 - 370), int(H / 2 - 370)
sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sh.paste((0, 0, 0, 255), (mx, my + 24), med.split()[3].point(lambda v: int(v * .7)))
im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(30))); im.alpha_composite(med, (mx, my))


def gold_text(txt, font, size, x0, cy):
    m = Image.new("L", (W, H), 0); dd = ImageDraw.Draw(m); f = ImageFont.truetype(F.FONTS[font], size)
    b = dd.textbbox((0, 0), txt, font=f)
    dd.text((x0 - b[0], cy - (b[3] - b[1]) / 2 - b[1]), txt, font=f, fill=255)
    mk = np.asarray(m).astype(float) / 255; dist = ndi.distance_transform_edt(mk > 0.5)
    h = ndi.gaussian_filter(np.sin(np.clip(dist / 12, 0, 1) * math.pi / 2) * 12, 1)
    gy, gx = np.gradient(h); n = np.dstack([-gx * 1.3, -gy * 1.3, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    c = F.ramp(np.clip(n @ F.L, 0, 1) ** 1.5, [(0, 40, 22, 6), (0.3, 120, 78, 12), (0.55, 200, 142, 26), (0.8, 244, 196, 64), (1, 255, 238, 176)])
    c = F.mix(c, (255, 248, 225), np.clip(np.clip(n @ F.Hh, 0, 1) ** 60 * 1.5, 0, 1))
    return Image.fromarray(np.dstack([np.clip(c, 0, 255), ndi.gaussian_filter(mk, 0.7) * 255]).astype(np.uint8), "RGBA"), mk, b[2] - b[0]


x0 = int(W * 0.50)
title, tm, tw = gold_text("MingldIngl", "pirata", 230, x0, int(H * 0.43))
g = Image.fromarray((tm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(26))
glow = Image.new("RGBA", (W, H), (255, 150, 40, 0)); glow.putalpha(g.point(lambda v: int(v * 0.45))); im.alpha_composite(glow)
sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sh.paste((0, 0, 0, 255), (0, 10), title.split()[3])
im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10))); im.alpha_composite(title)
d = ImageDraw.Draw(im); f = ImageFont.truetype(F.FONTS["yeseva"], 60)
d.text((x0 + 8, int(H * 0.61)), "Meet. Keep your word.", font=f, fill=(233, 223, 202, 235))
print("title right edge", x0 + tw, "of", W)
im.convert("RGB").resize((1024, 500), Image.LANCZOS).save(OUT)
