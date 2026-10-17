#!/usr/bin/env python3
"""Key a black-background candidate to alpha, crop to content and write name.png/@2x/@3x
sized like scripts/export-art.py does (box from src/design/figma/art.json). Originals are
copied to review/replaced/ first. Usage: place.py <art name> <candidate png> [--dry OUTDIR]"""
import json, pathlib, shutil, sys
import numpy as np
from PIL import Image
from scipy import ndimage

R = pathlib.Path(__file__).resolve().parent
APP = R.parents[2]
ART = APP / "src/design/art"
spec = json.loads((APP / "src/design/figma/art.json").read_text())
# Per-art keying: lo/hi = luminance ramp of the fringe, conn = how dark a pixel must be to count as
# background when flood-filling from the frame edge (low for dark-bodied objects), fog = also
# treat low-saturation haze as background, band = first crop to the rows holding saturated colour.
P = {
    "honour_cartographer": dict(lo=12, hi=110, conn=110),
    "ally_horn": dict(lo=12, hi=110, conn=110),
    "rite_bowl_low": dict(lo=10, hi=40, conn=40),
    "naadam_pennants": dict(lo=12, hi=100, conn=110, defog=25, band=350 / 90),
    "fest_blossoms": dict(lo=12, hi=110, conn=110),
}

def key(path, lo=12, hi=110, conn=110, fog=False, band=0, defog=0):
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    if band:  # centre on the rows holding saturated colour, at the target aspect (band = w/h)
        rows = np.where((sat > 120).any(axis=1))[0]
        h = round(rgb.shape[1] / band); c = (rows.min() + rows.max()) // 2
        y0 = int(min(max(0, c - h // 2), rgb.shape[0] - h)); y1 = y0 + h
        rgb, sat = rgb[y0:y1], sat[y0:y1]
    lum = rgb.max(axis=2)
    if defog:  # haze is low-frequency: subtract a wide blur before measuring (alpha only, colours stay)
        base = np.dstack([ndimage.gaussian_filter(rgb[..., c], defog) for c in range(3)])
        lum = np.clip(rgb - base, 0, 255).max(axis=2)
    m = lum * np.clip((sat - 30) / 60, 0, 1) if fog else lum   # haze is dark and grey: it keys out
    dark = m < conn
    lab, n = ndimage.label(dark)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outer = np.isin(lab, list(border))           # dark region connected to the frame edge
    alpha = np.ones_like(lum)
    ramp = np.clip((m - lo) / (hi - lo), 0, 1)
    alpha[outer] = ramp[outer]
    out = rgb.copy()
    a = alpha[..., None]
    with np.errstate(divide="ignore", invalid="ignore"):
        un = np.where(a > 0, np.minimum(rgb / np.maximum(a, 1e-3), 255), 0)
    out[outer] = un[outer]                       # un-premultiply the fringe so it adds cleanly
    rgba = np.dstack([out, alpha * 255]).astype(np.uint8)
    im = Image.fromarray(rgba, "RGBA")
    if band:
        return im
    ys, xs = np.where(alpha > 0.02)
    pad = 4
    box = (max(0, xs.min() - pad), max(0, ys.min() - pad), min(im.width, xs.max() + pad + 1), min(im.height, ys.max() + pad + 1))
    return im.crop(box)

def place(name, cand, outdir=ART, backup=True):
    s = spec[name]
    img = key(cand, **P.get(name, {}))
    if backup:
        bk = R / "replaced"; bk.mkdir(exist_ok=True)
        for suf in ("", "@2x", "@3x"):
            src = ART / f"{name}{suf}.png"
            if src.exists() and not (bk / src.name).exists():
                shutil.copy(src, bk / src.name)
    for scale, suf in ((1, ""), (2, "@2x"), (3, "@3x")):
        box = (s["w"] * scale, s["h"] * scale)
        pick = min if s["fit"] == "contain" else max
        r = min(pick(box[0] / img.width, box[1] / img.height), 1.0)
        size = (max(1, round(img.width * r)), max(1, round(img.height * r)))
        img.resize(size, Image.LANCZOS).save(outdir / f"{name}{suf}.png", optimize=True)
    print(f"{name}: keyed {img.size} -> {size} ({s['fit']})")

if __name__ == "__main__":
    name, cand = sys.argv[1], sys.argv[2]
    if "--dry" in sys.argv:
        out = pathlib.Path(sys.argv[sys.argv.index("--dry") + 1]); out.mkdir(parents=True, exist_ok=True)
        place(name, cand, out, backup=False)
    else:
        place(name, cand)
