#!/usr/bin/env python3
"""Recompress transparent cutout PNGs for fast web loads.

The isnet pipeline emits large PNGs (~400KB avg, up to 1600px). The app only
ever displays them small (feed/builder tiles), so downscale to a sane max edge
and re-optimize in place, preserving the alpha channel. Keeps the .png filename
so no catalog references change.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CUTOUT_DIR = ROOT / "public" / "assets" / "cutouts"
MAX_EDGE = int(sys.argv[1]) if len(sys.argv) > 1 else 768


def main() -> int:
    pngs = sorted(CUTOUT_DIR.glob("*.png"))
    if not pngs:
        print("no cutouts found")
        return 1
    before_total = 0
    after_total = 0
    resized = 0
    for path in pngs:
        before = path.stat().st_size
        before_total += before
        try:
            with Image.open(path) as im:
                im = im.convert("RGBA")
                w, h = im.size
                longest = max(w, h)
                if longest > MAX_EDGE:
                    scale = MAX_EDGE / longest
                    im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
                    resized += 1
                # Quantize to a palette+alpha to shrink dramatically while keeping
                # crisp cutout edges; fall back to optimized RGBA if quantize fails.
                try:
                    q = im.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.NONE)
                    q.save(path, format="PNG", optimize=True)
                except Exception:
                    im.save(path, format="PNG", optimize=True)
        except Exception as exc:  # noqa: BLE001
            print(f"skip {path.name}: {exc}")
            after_total += before
            continue
        after_total += path.stat().st_size
    mb = 1024 * 1024
    print(f"optimized {len(pngs)} cutouts (resized {resized}); {before_total/mb:.1f}MB -> {after_total/mb:.1f}MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
