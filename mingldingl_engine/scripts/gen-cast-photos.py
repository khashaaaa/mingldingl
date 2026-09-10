#!/usr/bin/env python3
"""Generates the seeded cast's portraits: three frames per person, one face each.

reseed-dev-db.sql points every seeded profile at /uploads/photos/seed/c2/<slug>-{1,2,3}.jpg, but
uploads/ is gitignored (it is user-uploaded content), so a fresh clone has no cast photos and every
candidate card falls back to gen-seed-photos.py's letter placeholders.

Faces come from thispersondoesnotexist.com — StyleGAN output, photorealistic but depicting no real
person. That is deliberate: a fixture for a dating app must not put real, identifiable people's
faces on fabricated profiles. Do not swap this for a source of real photographs.

The three frames per person are the same face at different framings and grades, because the
progressive-reveal ladder opens photo 1 at level 1, photo 2 at level 2 and photo 3 at level 3 --
they have to read as three photographs of one person, not three different people.

Frames are square on purpose. The discover card covers its photo into a box that is landscape on a
tall phone, so a 3:4 portrait is scaled up ~1.5x and cropped to a nose; a square frame covers the
same box at ~0.95 and keeps the whole head.

    python3 scripts/gen-cast-photos.py [--force] [--out <dir>]

IMPORTANT: the generator cannot judge who it downloaded. FFHQ contains children. Look at every
face it writes and re-run for any that is not a consenting-adult-looking portrait -- these end up
on dating profiles. The committed cast was picked by hand for exactly this reason.
"""

import argparse
import sys
import time
import urllib.request
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image, ImageEnhance
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

SRC = "https://thispersondoesnotexist.com/random-person.jpeg"
ENGINE = Path(__file__).resolve().parent.parent / "src" / "MinglDingl.Engine"
DEFAULT_OUT = ENGINE / "uploads" / "photos" / "seed" / "c2"
SIZE = (900, 900)

# Must match the slugs reseed-dev-db.sql builds its PhotoUrls from.
SLUGS = [
    "batbold", "temuulen", "enkhbat", "ganzorig", "munkhbold", "tsogtbaatar", "erdenebat",
    "nomin", "sarnai", "anujin", "khulan", "misheel", "bolormaa", "tuvshin", "oyunaa",
    "delgermaa", "saruul", "narantuya", "altanzul",
]

# (zoom, x-bias, y-bias, warmth, brightness). Zoom 1.0 is the untouched source frame.
VARIANTS = [
    (1.00, 0.50, 0.50, 1.00, 1.00),
    (1.22, 0.50, 0.44, 1.05, 1.03),
    (1.06, 0.44, 0.53, 0.96, 0.99),
]


def fetch_face(attempt: int) -> Image.Image:
    req = urllib.request.Request(
        f"{SRC}?n={attempt}-{time.time_ns()}",
        headers={"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"},
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return Image.open(BytesIO(r.read())).convert("RGB")


def frame(img, zoom, xb, yb):
    w, h = img.size
    side = min(w, h) / zoom
    left = max(0, min(w - side, w * xb - side / 2))
    top = max(0, min(h - side, h * yb - side / 2))
    return img.crop((int(left), int(top), int(left + side), int(top + side))).resize(SIZE, Image.LANCZOS)


def grade(img, warmth, brightness):
    img = ImageEnhance.Brightness(img).enhance(brightness)
    img = ImageEnhance.Color(img).enhance(1.03)
    r, g, b = img.split()
    r = r.point(lambda v: min(255, int(v * warmth)))
    b = b.point(lambda v: min(255, int(v / warmth)))
    return Image.merge("RGB", (r, g, b))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="refetch people that already have photos")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = ap.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)

    written = skipped = 0
    for i, slug in enumerate(SLUGS, 1):
        if not args.force and (args.out / f"{slug}-1.jpg").exists():
            skipped += 1
            continue
        face = fetch_face(i)
        for n, (zoom, xb, yb, warmth, bright) in enumerate(VARIANTS, 1):
            grade(frame(face, zoom, xb, yb), warmth, bright).save(
                args.out / f"{slug}-{n}.jpg", "JPEG", quality=88)
        written += 1
        time.sleep(0.3)  # the source hands back a cached image if hit too fast

    print(f"{written} people written, {skipped} already present -> {args.out}")
    if written:
        print("Review every new face before using this cast: reject any that is not an adult.")


if __name__ == "__main__":
    main()
