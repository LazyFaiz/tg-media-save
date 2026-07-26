#!/usr/bin/env python3
"""Generate TG Media Saver PNG icons from scratch using Pillow.

Run without polluting the global environment (uv is ephemeral):

    uv run --with pillow python scripts/make_icons.py

Outputs:
    extension/icons/icon16.png, icon48.png, icon128.png
    assets/icon128.png, assets/icon512.png

The design mirrors assets/icon.svg: a Telegram-blue rounded square with a white
"download into tray" glyph. Edit the design here (or the SVG) and re-run.
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
BLUE = (34, 158, 217, 255)  # #229ED9 — Telegram blue
WHITE = (255, 255, 255, 255)


def draw(size: int) -> Image.Image:
    # Supersample 8x then downscale for smooth anti-aliased edges.
    S = size * 8
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded-square background.
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=BLUE)

    cx = S / 2
    # Arrow shaft.
    sw = S * 0.11
    d.rounded_rectangle([cx - sw / 2, S * 0.20, cx + sw / 2, S * 0.52], radius=int(sw / 2), fill=WHITE)
    # Arrow head (triangle).
    hh = S * 0.21
    d.polygon([(cx - hh, S * 0.50), (cx + hh, S * 0.50), (cx, S * 0.72)], fill=WHITE)
    # Tray (U bracket).
    bar = S * 0.075
    tl, tr = S * 0.24, S * 0.76
    tb, tt = S * 0.88, S * 0.74
    d.rounded_rectangle([tl, tb - bar, tr, tb], radius=int(bar / 2), fill=WHITE)  # bottom
    d.rounded_rectangle([tl, tt, tl + bar, tb], radius=int(bar / 2), fill=WHITE)  # left
    d.rounded_rectangle([tr - bar, tt, tr, tb], radius=int(bar / 2), fill=WHITE)  # right

    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    icons_dir = ROOT / "extension" / "icons"
    assets_dir = ROOT / "assets"
    icons_dir.mkdir(parents=True, exist_ok=True)
    assets_dir.mkdir(parents=True, exist_ok=True)

    for size in (16, 48, 128):
        out = icons_dir / f"icon{size}.png"
        draw(size).save(out)
        print("wrote", out)

    for size in (128, 512):
        out = assets_dir / f"icon{size}.png"
        draw(size).save(out)
        print("wrote", out)


if __name__ == "__main__":
    main()
