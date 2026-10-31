#!/usr/bin/env python3
"""Draw Handy's app icon: two square windows on a light grey field."""

import struct
import zlib
from pathlib import Path


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def pixel(x: int, y: int, size: int) -> tuple[int, int, int, int]:
    px = (x + 0.5) / size
    py = (y + 0.5) / size
    field = (230, 230, 230, 255)
    bar = (176, 176, 176, 255)
    back = (90, 90, 90, 255)
    front = (58, 58, 58, 255)
    color = field
    if 0.14 <= px <= 0.70 and 0.16 <= py <= 0.76:
        color = bar if py < 0.28 else back
    if 0.30 <= px <= 0.86 and 0.30 <= py <= 0.88:
        color = bar if py < 0.42 else front
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
