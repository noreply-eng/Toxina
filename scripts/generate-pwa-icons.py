"""Generate PWA icons, favicon, and iOS splash screens from the source icon."""
from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "icons" / "icon-source.png"
ICONS_DIR = ROOT / "public" / "icons"
SPLASH_DIR = ROOT / "public" / "splash"

THEME_COLOR = "#137fec"
BACKGROUND_COLOR = "#f6f7f8"


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def load_source() -> Image.Image:
    fallback = ROOT / "public" / "icons" / "icon-512.png"
    path = SRC if SRC.exists() else fallback
    if not path.exists():
        raise FileNotFoundError(f"Source icon not found: {path}")
    return Image.open(path).convert("RGBA")


def resize_icon(src: Image.Image, size: int) -> Image.Image:
    return src.resize((size, size), Image.Resampling.LANCZOS)


def create_maskable(src: Image.Image, size: int = 512) -> Image.Image:
    """Maskable icons need artwork inside the central 80% safe zone."""
    safe = int(size * 0.8)
    canvas = Image.new("RGBA", (size, size), (*hex_to_rgb(BACKGROUND_COLOR), 255))
    content = resize_icon(src, safe)
    offset = (size - safe) // 2
    canvas.paste(content, (offset, offset), content)
    return canvas


def create_splash(src: Image.Image, width: int, height: int) -> Image.Image:
    splash = Image.new("RGB", (width, height), hex_to_rgb(BACKGROUND_COLOR))
    icon_size = int(min(width, height) * 0.22)
    icon = resize_icon(src, icon_size)
    x = (width - icon_size) // 2
    y = (height - icon_size) // 2
    splash.paste(icon, (x, y), icon)
    return splash


def main() -> None:
    src = load_source()
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    SPLASH_DIR.mkdir(parents=True, exist_ok=True)

    icon_sizes = {
        "icon-72.png": 72,
        "icon-96.png": 96,
        "icon-128.png": 128,
        "icon-144.png": 144,
        "icon-152.png": 152,
        "icon-192.png": 192,
        "icon-384.png": 384,
        "icon-512.png": 512,
        "apple-touch-icon.png": 180,
    }

    for filename, size in icon_sizes.items():
        out = ICONS_DIR / filename
        resize_icon(src, size).save(out, "PNG", optimize=True)
        print(f"Wrote {out} ({size}x{size})")

    maskable = create_maskable(src)
    maskable_path = ICONS_DIR / "icon-maskable-512.png"
    maskable.save(maskable_path, "PNG", optimize=True)
    print(f"Wrote {maskable_path} (512x512 maskable)")

    favicon_sizes = [16, 32, 48]
    favicon_images = [resize_icon(src, s) for s in favicon_sizes]
    favicon_path = ROOT / "public" / "favicon.ico"
    favicon_images[0].save(
        favicon_path,
        format="ICO",
        sizes=[(s, s) for s in favicon_sizes],
        append_images=favicon_images[1:],
    )
    print(f"Wrote {favicon_path}")

    splashes = [
        ("apple-splash-1170-2532.png", 1170, 2532),
        ("apple-splash-1179-2556.png", 1179, 2556),
        ("apple-splash-1290-2796.png", 1290, 2796),
        ("apple-splash-750-1334.png", 750, 1334),
        ("apple-splash-2048-2732.png", 2048, 2732),
    ]

    for filename, width, height in splashes:
        out = SPLASH_DIR / filename
        create_splash(src, width, height).save(out, "PNG", optimize=True)
        print(f"Wrote {out} ({width}x{height})")

    if not SRC.exists():
        backup = ICONS_DIR / "icon-source.png"
        src.save(backup, "PNG", optimize=True)
        print(f"Saved source backup to {backup}")


if __name__ == "__main__":
    main()
