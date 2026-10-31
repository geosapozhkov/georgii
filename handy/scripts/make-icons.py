#!/usr/bin/env python3
"""Draw Handy's app icon: two windows on a dark desk."""

import struct
import zlib
from pathlib import Path


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def rounded(px: float, py: float, left: float, top: float, right: float, bottom: float, radius: float) -> bool:
    cx = min(max(px, left + radius), right - radius)
    cy = min(max(py, top + radius), bottom - radius)
    return (px - cx) ** 2 + (py - cy) ** 2 <= radius * radius


def mix(a: tuple[int, int, int, int], b: tuple[int, int, int, int], t: float) -> tuple[int, int, int, int]:
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(4))  # type: ignore[return-value]


def pixel(x: int, y: int, size: int) -> tuple[int, int, int, int]:
    px = (x + 0.5) / size
    py = (y + 0.5) / size
    ink = (16, 14, 12, 255)
    amber = (255, 176, 0, 255)
    paper = (244, 239, 230, 255)
    green = (125, 207, 182, 255)
    color = ink
    if rounded(px, py, 0.16, 0.18, 0.78, 0.84, 0.08):
        color = amber if py < 0.30 else paper
        if py < 0.30:
            color = amber
        else:
            color = (28, 25, 22, 255)
        if 0.22 < px < 0.72 and 0.40 < py < 0.46:
            color = amber
    if rounded(px, py, 0.34, 0.30, 0.90, 0.88, 0.07):
        color = green if py < 0.42 else (23, 21, 18, 255)
        if 0.42 < px < 0.82 and 0.50 < py < 0.55:
            color = paper
    # Soften the outer edge of the full-bleed icon.
    edge = min(px, py, 1 - px, 1 - py)
    if edge < 0.02:
        color = mix(ink, color, edge / 0.02)
    return color


def write_png(path: Path, size: int) -> None:
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(pixel(x, y, size))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


if __name__ == "__main__":
    public = Path(__file__).resolve().parents[1] / "public"
    write_png(public / "favicon.png", 32)
    write_png(public / "icon-192.png", 192)
    write_png(public / "icon-512.png", 512)
