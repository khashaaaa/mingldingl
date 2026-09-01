#!/usr/bin/env python3
"""Generates the placeholder photos the dev seed data points at.

reseed-dev-db.sql writes PhotoUrls like /uploads/photos/seed/<slug>-1.jpg, but uploads/ is
gitignored (it is user-uploaded content), so nothing ever created those files and every seeded
profile, candidate card and business photo rendered as a broken image.

Rather than re-deriving the slugs from the SQL — where they would silently drift apart — this
reads the URLs the database actually holds and fills in whichever files are missing.

Usage:  python3 scripts/gen-seed-photos.py [--force]
Needs:  psql on PATH, Pillow (pip install Pillow), and a reseeded database.
"""

import argparse
import colorsys
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Pillow is required: pip install Pillow")

ENGINE = Path(__file__).resolve().parent.parent / "src" / "MinglDingl.Engine"
APPSETTINGS = ENGINE / "appsettings.Development.json"
SIZE = (640, 800)

# Mirrors lib/theme.ts, so the placeholders sit in the app's palette rather than fighting it.
INK = (237, 228, 211)


def connection_env():
    """Reuses the engine's own connection string so this cannot target the wrong database."""
    if not APPSETTINGS.exists():
        sys.exit(f"missing {APPSETTINGS} — copy it from the .example first")
    raw = json.loads(APPSETTINGS.read_text())["ConnectionStrings"]["DefaultConnection"]
    parts = dict(
        kv.split("=", 1) for kv in raw.split(";") if "=" in kv
    )
    env = dict(os.environ)
    env["PGPASSWORD"] = parts.get("Password", "")
    return env, [
        "-h", parts.get("Host", "127.0.0.1"),
        "-p", parts.get("Port", "5432"),
        "-U", parts.get("Username", "postgres"),
        "-d", parts.get("Database", "mingldingl"),
    ]


def seeded_photo_paths():
    env, conn = connection_env()
    sql = """
        SELECT jsonb_array_elements_text("PhotoUrls") FROM "Users"
        UNION
        SELECT jsonb_array_elements_text("PhotoUrls") FROM "BusinessPartners";
    """
    out = subprocess.run(
        ["psql", *conn, "-tAc", sql], env=env, capture_output=True, text=True
    )
    if out.returncode != 0:
        sys.exit(f"psql failed:\n{out.stderr.strip()}")
    paths = set()
    for url in out.stdout.splitlines():
        m = re.search(r"/uploads/(.+)$", url.strip())
        if m:
            paths.add(m.group(1))
    return sorted(paths)


def tint(seed: str):
    """Deterministic per-subject hue, so a given profile keeps the same placeholder."""
    h = int(hashlib.md5(seed.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    r, g, b = colorsys.hsv_to_rgb(h, 0.32, 0.30)
    return int(r * 255), int(g * 255), int(b * 255)


def label_for(rel: str) -> str:
    stem = Path(rel).stem
    name = re.sub(r"-\d+$", "", stem)
    return (name[:1] or "?").upper()


def draw(path: Path, rel: str):
    img = Image.new("RGB", SIZE, tint(rel))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 260
        )
    except OSError:
        font = ImageFont.load_default()
    d.text((SIZE[0] / 2, SIZE[1] / 2), label_for(rel), font=font, fill=INK, anchor="mm")
    d.rectangle([8, 8, SIZE[0] - 9, SIZE[1] - 9], outline=(184, 146, 63), width=3)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "JPEG", quality=82)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="rewrite files that already exist")
    args = ap.parse_args()

    paths = seeded_photo_paths()
    if not paths:
        sys.exit("no seeded photo URLs found — run reseed-dev-db.sql first")

    written = skipped = 0
    for rel in paths:
        target = ENGINE / "uploads" / rel
        if target.exists() and not args.force:
            skipped += 1
            continue
        draw(target, rel)
        written += 1

    print(f"{written} written, {skipped} already present ({len(paths)} referenced)")


if __name__ == "__main__":
    main()
