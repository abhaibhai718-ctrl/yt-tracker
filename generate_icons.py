#!/usr/bin/env python3
"""
Generates icon-192.png and icon-512.png for the PWA.
Run once: python3 generate_icons.py
Requires: pip install Pillow
"""
from PIL import Image, ImageDraw, ImageFont
import os

def make_icon(size, path):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded rect background
    radius = size // 5
    bg_color = (15, 15, 12, 255)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=bg_color)

    # Play button triangle (YouTube-ish)
    cx, cy = size // 2, size // 2
    s = size // 3
    triangle = [
        (cx - s // 2, cy - s // 2),
        (cx - s // 2, cy + s // 2),
        (cx + s // 2, cy),
    ]
    draw.polygon(triangle, fill=(55, 138, 221, 255))  # #378ADD blue

    img.save(path)
    print(f"Saved {path} ({size}x{size})")

make_icon(192, 'icon-192.png')
make_icon(512, 'icon-512.png')
