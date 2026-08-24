"""Vectoriza iconos planos de tres colores (fondo + dos figuras).

Uso:
    python scripts/raster_to_icon_svg.py imagen.png public/icons/icono-ultrasonido.svg
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np


def load_rgb(path: Path) -> np.ndarray:
    image = cv2.imread(str(path), cv2.IMREAD_UNCHANGED)
    if image is None:
        raise FileNotFoundError(f"No se pudo leer la imagen: {path}")

    if image.ndim == 2:
        return cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)

    if image.shape[2] == 4:
        bgr = image[:, :, :3].astype(np.float32)
        alpha = image[:, :, 3:4].astype(np.float32) / 255.0
        # El negro es el fondo natural del icono y evita halos claros.
        bgr = np.rint(bgr * alpha).astype(np.uint8)
    else:
        bgr = image[:, :, :3]

    return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)


def extract_palette_and_labels(
    rgb: np.ndarray, colors: int = 3
) -> tuple[np.ndarray, np.ndarray]:
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)
    samples = lab.reshape(-1, 3).astype(np.float32)

    # Muestrear mantiene el proceso rápido sin perder los colores dominantes.
    step = max(1, len(samples) // 200_000)
    cv2.setRNGSeed(7)
    _, _, centers_lab = cv2.kmeans(
        samples[::step],
        colors,
        None,
        (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.1),
        10,
        cv2.KMEANS_PP_CENTERS,
    )

    delta = lab.astype(np.float32)[:, :, None, :] - centers_lab[None, None, :, :]
    labels = np.argmin(np.sum(delta * delta, axis=3), axis=2).astype(np.uint8)
    centers_rgb = cv2.cvtColor(
        np.clip(np.rint(centers_lab), 0, 255).astype(np.uint8).reshape(1, colors, 3),
        cv2.COLOR_LAB2RGB,
    ).reshape(colors, 3)
    return centers_rgb, labels


def classify_palette(centers_rgb: np.ndarray) -> tuple[int, int, int]:
    hsv = cv2.cvtColor(centers_rgb.reshape(1, -1, 3), cv2.COLOR_RGB2HSV).reshape(-1, 3)
    background = int(np.argmin(hsv[:, 2]))
    foreground = [index for index in range(len(centers_rgb)) if index != background]
    white = min(foreground, key=lambda index: int(hsv[index, 1]))
    accent = next(index for index in foreground if index != white)
    return background, accent, white


def mask_to_path(mask: np.ndarray, simplify: float, min_area: float) -> str:
    mask = cv2.morphologyEx(
        mask, cv2.MORPH_CLOSE, np.ones((3, 3), dtype=np.uint8)
    )
    contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_NONE)
    commands: list[str] = []

    for contour in contours:
        if abs(cv2.contourArea(contour)) < min_area:
            continue

        perimeter = cv2.arcLength(contour, True)
        polygon = cv2.approxPolyDP(contour, max(0.6, simplify * perimeter), True)
        points = polygon[:, 0, :]
        if len(points) < 3:
            continue

        commands.append(f"M {points[0, 0]} {points[0, 1]}")
        commands.extend(f"L {x} {y}" for x, y in points[1:])
        commands.append("Z")

    return " ".join(commands)


def as_hex(rgb: np.ndarray) -> str:
    return "#" + "".join(f"{int(channel):02x}" for channel in rgb)


def build_svg(
    rgb: np.ndarray,
    simplify: float,
    min_area: float,
) -> tuple[str, tuple[str, str, str]]:
    height, width = rgb.shape[:2]
    palette, labels = extract_palette_and_labels(rgb)
    background_index, accent_index, white_index = classify_palette(palette)

    accent_path = mask_to_path(
        np.where(labels == accent_index, 255, 0).astype(np.uint8),
        simplify,
        min_area,
    )
    white_path = mask_to_path(
        np.where(labels == white_index, 255, 0).astype(np.uint8),
        simplify,
        min_area,
    )
    colors = (
        as_hex(palette[background_index]),
        as_hex(palette[accent_index]),
        as_hex(palette[white_index]),
    )

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title">
  <title id="title">Icono de ultrasonido</title>
  <rect width="{width}" height="{height}" fill="{colors[0]}"/>
  <path fill="{colors[1]}" fill-rule="evenodd" d="{accent_path}"/>
  <path fill="{colors[2]}" fill-rule="evenodd" d="{white_path}"/>
</svg>
"""
    return svg, colors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convierte un icono raster plano de tres colores a SVG."
    )
    parser.add_argument("input", type=Path, help="Imagen PNG/JPG de entrada")
    parser.add_argument("output", type=Path, help="Archivo SVG de salida")
    parser.add_argument(
        "--simplify",
        type=float,
        default=0.001,
        help="Simplificación relativa de contornos (predeterminado: 0.001)",
    )
    parser.add_argument(
        "--min-area",
        type=float,
        default=20.0,
        help="Área mínima de un contorno en píxeles (predeterminado: 20)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rgb = load_rgb(args.input)
    svg, colors = build_svg(rgb, args.simplify, args.min_area)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(svg, encoding="utf-8")
    print(f"SVG generado: {args.output}")
    print(f"Paleta detectada: fondo={colors[0]}, acento={colors[1]}, claro={colors[2]}")


if __name__ == "__main__":
    main()
