#!/usr/bin/env python3
"""Generate PNG app icons (pure stdlib, no dependencies)."""
import struct
import zlib
import os

TOP = (13, 26, 20)     # dark phosphor panel
BOT = (6, 13, 9)       # near-black terminal
BAR = (0, 230, 118)    # phosphor green


def make_icon(size, path):
    margin = int(size * 0.26)
    x0, x1 = margin, size - margin
    bar_h = max(2, int(size * 0.055))
    gap = int(size * 0.11)
    start_y = int(size * 0.34)
    bars = []
    for i in range(3):
        y0 = start_y + i * (bar_h + gap)
        scale = 1.0 if i < 2 else 0.6
        bx1 = x0 + int((x1 - x0) * scale)
        bars.append((y0, y0 + bar_h, x0, bx1))

    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type 0 for this scanline
        t = y / (size - 1)
        r = int(TOP[0] + (BOT[0] - TOP[0]) * t)
        g = int(TOP[1] + (BOT[1] - TOP[1]) * t)
        b = int(TOP[2] + (BOT[2] - TOP[2]) * t)
        row_bars = [(a, c) for (yy0, yy1, a, c) in bars if yy0 <= y < yy1]
        for x in range(size):
            if any(a <= x < c for (a, c) in row_bars):
                raw += bytes(BAR)
            else:
                raw += bytes((r, g, b))

    def chunk(typ, data):
        return (struct.pack('>I', len(data)) + typ + data +
                struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff))

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)  # RGB, 8-bit
    idat = zlib.compress(bytes(raw), 9)
    png = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)
    print('wrote', path)


if __name__ == '__main__':
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pub = os.path.join(here, 'public')
    os.makedirs(pub, exist_ok=True)
    make_icon(192, os.path.join(pub, 'icon-192.png'))
    make_icon(512, os.path.join(pub, 'icon-512.png'))
