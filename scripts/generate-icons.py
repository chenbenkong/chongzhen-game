#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regenerate every raster PWA / social-share asset for 「崇祯·宦海浮沉模拟器」.

Self-contained: requires **only Pillow** (no numpy, no cairo, no SVG rasteriser).
Run from the repository root:

    python scripts/generate-icons.py

Outputs (paths relative to the repository root):

    public/icons/favicon-32.png            32x32
    public/icons/apple-touch-icon.png     180x180   (opaque, iOS masks it itself)
    public/icons/icon-192.png             192x192
    public/icons/icon-512.png             512x512
    public/icons/icon-maskable-512.png    512x512   (full-bleed, adaptive safe zone)
    public/og-image.png                  1200x630   (Open Graph / Twitter card)

The vector source ``public/icons/favicon.svg`` is hand-authored and is NOT
generated here: this script re-draws the same design programmatically, so the
PNGs never depend on the SVG file.

Design: rounded-square seal, ink-black #0A0807 ground, thin antique-gold
#C5A55A inner frame, the character 明 (U+660E) centred in gold.  Everything is
drawn at 4x the target size and downscaled with LANCZOS for clean edges.
"""

from __future__ import annotations

import math
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ImportError:  # pragma: no cover - environment guard
    sys.stderr.write(
        "error: Pillow is required.  Install it with `python -m pip install Pillow`.\n"
    )
    raise

# --------------------------------------------------------------------------
# Palette
# --------------------------------------------------------------------------
INK = (10, 8, 7)            # #0A0807  deep ink-black ground
GOLD = (197, 165, 90)       # #C5A55A  antique gold
GOLD_BRIGHT = (201, 162, 39)  # #c9a227
PARCHMENT = (245, 230, 200)  # #F5E6C8  parchment text
SEAL_RED = (92, 58, 30)     # #5C3A1E  Chinese seal-red
GLOW_RED = (112, 34, 24)    # dark-red centre glow for the share card

GLYPH = "\u660e"            # 明
SS = 4                      # supersampling factor

# --------------------------------------------------------------------------
# Font resolution
# --------------------------------------------------------------------------
FONT_CANDIDATES = [
    r"C:\Windows\Fonts\simsun.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\STKAITI.TTF",
    "/System/Library/Fonts/Songti.ttc",
    "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc",
]

_FONT_CACHE: dict[int, ImageFont.FreeTypeFont] = {}


def resolve_font_path() -> str:
    """Return the first existing CJK font from FONT_CANDIDATES."""
    for path in FONT_CANDIDATES:
        if os.path.isfile(path):
            return path
    tried = "\n".join("  - " + p for p in FONT_CANDIDATES)
    raise RuntimeError(
        "No CJK font found.  Tried, in order:\n"
        + tried
        + "\nInstall one of them (any CJK serif/sans face works) or add its path "
        "to FONT_CANDIDATES in scripts/generate-icons.py."
    )


FONT_PATH = resolve_font_path()


def load_font(size: int) -> ImageFont.FreeTypeFont:
    """Load FONT_PATH at `size` px (cached; .ttc collections use face index 0)."""
    size = max(1, int(size))
    if size not in _FONT_CACHE:
        _FONT_CACHE[size] = ImageFont.truetype(FONT_PATH, size)
    return _FONT_CACHE[size]


def ink_size(font: ImageFont.FreeTypeFont, text: str) -> tuple[int, int]:
    """Bounding box of the actual painted ink (not the font's line metrics)."""
    box = font.getbbox(text)
    return box[2] - box[0], box[3] - box[1]


def fit_font(text: str, box_w: float, box_h: float) -> ImageFont.FreeTypeFont:
    """Largest font size whose painted ink fits inside box_w x box_h px."""
    size = 64
    for _ in range(16):
        font = load_font(size)
        w, h = ink_size(font, text)
        if w <= 0 or h <= 0:
            break
        nxt = max(1, int(round(size * min(box_w / w, box_h / h))))
        if nxt == size:
            break
        size = nxt
    return load_font(size)


def draw_ink_centered(
    draw: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    text: str,
    font: ImageFont.FreeTypeFont,
    fill,
) -> None:
    """Draw `text` so that its painted ink (not its em box) is centred on (cx, cy)."""
    box = draw.textbbox((0, 0), text, font=font)
    x = cx - (box[0] + box[2]) / 2.0
    y = cy - (box[1] + box[3]) / 2.0
    draw.text((x, y), text, font=font, fill=fill)


def _resample():
    return getattr(Image, "Resampling", Image).LANCZOS


# --------------------------------------------------------------------------
# Seal icon
# --------------------------------------------------------------------------
def render_seal(
    size: int,
    *,
    rounded: bool = True,
    glyph_ratio: float = 0.56,
    border_inset: float = 0.075,
) -> Image.Image:
    """Draw the 明 seal.

    rounded=True  -> ink-black rounded square on a transparent canvas.
    rounded=False -> full-bleed opaque ink-black square (maskable / iOS, where
                     the platform applies its own corner / circle mask).
    """
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = int(round(s * 0.19))
    if rounded:
        draw.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=INK + (255,))
    else:
        draw.rectangle([0, 0, s - 1, s - 1], fill=INK + (255,))

    # Thin antique-gold inner frame.
    inset = s * border_inset
    width = max(SS, int(round(s * 0.0062)))
    frame_radius = max(2, int(round(radius - inset))) if rounded else max(2, int(round(s * 0.10)))
    draw.rounded_rectangle(
        [inset, inset, s - 1 - inset, s - 1 - inset],
        radius=frame_radius,
        outline=GOLD + (255,),
        width=width,
    )

    # 明 centred, gold.
    font = fit_font(GLYPH, s * glyph_ratio, s * glyph_ratio)
    draw_ink_centered(draw, (s - 1) / 2.0, (s - 1) / 2.0, GLYPH, font, GOLD + (255,))

    return img.resize((size, size), _resample())


# --------------------------------------------------------------------------
# Open Graph share card (1200x630)
# --------------------------------------------------------------------------
def _radial_glow(width: int, height: int, peak: int = 190, reach: float = 0.92,
                 falloff: float = 2.3) -> Image.Image:
    """Smooth radial alpha mask, built small + bicubic-upscaled (Pillow only)."""
    gw, gh = 200, max(2, int(round(200 * height / width)))
    mask = Image.new("L", (gw, gh), 0)
    px = mask.load()
    cx, cy = (gw - 1) / 2.0, (gh - 1) / 2.0
    norm = math.hypot(cx, cy)
    for y in range(gh):
        dy = y - cy
        for x in range(gw):
            r = math.hypot(x - cx, dy) / norm
            t = 1.0 - r / reach
            if t > 0.0:
                px[x, y] = int(peak * (t ** falloff))
    mask = mask.resize((width, height), Image.BICUBIC)
    return mask.filter(ImageFilter.GaussianBlur(width * 0.035))


def render_og_image(width: int = 1200, height: int = 630) -> Image.Image:
    img = Image.new("RGB", (width, height), INK)

    # Subtle dark-red glow toward the centre.
    glow = Image.new("RGB", (width, height), GLOW_RED)
    img.paste(glow, (0, 0), _radial_glow(width, height))

    draw = ImageDraw.Draw(img, "RGBA")

    # Thin double gold border, inset ~24px.
    draw.rectangle(
        [24, 24, width - 25, height - 25], outline=GOLD + (150,), width=2
    )
    draw.rectangle(
        [35, 35, width - 36, height - 36], outline=GOLD + (85,), width=1
    )

    # Title.
    title = "崇祯 · 宦海浮沉"
    tfont = fit_font(title, (width - 24 * 2) - 120, 132)
    draw_ink_centered(draw, width / 2.0, 240, title, tfont, GOLD_BRIGHT)

    # Short gold rule between title and subtitle.
    draw.rectangle([width / 2 - 90, 322, width / 2 + 90, 323], fill=GOLD + (140,))

    # Subtitle.
    subtitle = "明末官场沉浮模拟器"
    sfont = fit_font(subtitle, 640, 44)
    draw_ink_centered(draw, width / 2.0, 372, subtitle, sfont, PARCHMENT)

    # Dim footer line.
    footer = "从科举童生到朝堂大员 · 1628\u20131644"
    ffont = fit_font(footer, 780, 26)
    draw_ink_centered(draw, width / 2.0, 526, footer, ffont, (126, 116, 100))

    return img


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
def main() -> int:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icons_dir = os.path.join(root, "public", "icons")
    public_dir = os.path.join(root, "public")
    os.makedirs(icons_dir, exist_ok=True)

    print("font      : %s" % FONT_PATH)

    # Rounded seal on transparency.
    # 32px is the hardest legibility case: give the glyph a little more ink and
    # pull the frame in slightly so 明 does not crowd it.
    rounded_targets = [
        (os.path.join(icons_dir, "favicon-32.png"), 32, 0.62, 0.085),
        (os.path.join(icons_dir, "icon-192.png"), 192, 0.56, 0.075),
        (os.path.join(icons_dir, "icon-512.png"), 512, 0.56, 0.075),
    ]
    for path, size, glyph_ratio, border_inset in rounded_targets:
        render_seal(size, glyph_ratio=glyph_ratio, border_inset=border_inset).save(
            path, "PNG", optimize=True
        )
        print("wrote     : %s (%dx%d)" % (os.path.relpath(path, root), size, size))

    # Full-bleed opaque square: iOS masks it itself.
    apple = os.path.join(icons_dir, "apple-touch-icon.png")
    render_seal(180, rounded=False, glyph_ratio=0.56, border_inset=0.085).save(
        apple, "PNG", optimize=True
    )
    print("wrote     : %s (180x180)" % os.path.relpath(apple, root))

    # Maskable: full-bleed ground, all content inside the central safe zone.
    maskable = os.path.join(icons_dir, "icon-maskable-512.png")
    render_seal(512, rounded=False, glyph_ratio=0.46, border_inset=0.15).save(
        maskable, "PNG", optimize=True
    )
    print("wrote     : %s (512x512)" % os.path.relpath(maskable, root))

    # Social share card.
    og = os.path.join(public_dir, "og-image.png")
    render_og_image().save(og, "PNG", optimize=True)
    print("wrote     : %s (1200x630)" % os.path.relpath(og, root))

    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
