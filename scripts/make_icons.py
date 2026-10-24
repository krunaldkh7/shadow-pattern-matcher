"""Generates the app icons in assets/ (cat silhouette on the warm tiled wall).

Run: python3 scripts/make_icons.py   (needs Pillow: pip install pillow)
The cat polyline is copied from src/game/shapes.ts.
"""
import os
from PIL import Image, ImageDraw

CAT = [{"closed": True, "pts": [[-0.5, -0.95], [-0.66, -0.62], [-0.66, -0.2], [-0.53, 0.1], [-0.36, 0.3], [-0.42, 0.52], [-0.42, 0.72], [-0.36, 0.98], [-0.18, 0.8], [0, 0.83], [0.18, 0.98], [0.23, 0.72], [0.25, 0.5], [0.15, 0.3], [0.1, 0.12], [0.2, -0.22], [0.26, -0.62], [0.32, -0.95]]},
       {"closed": False, "pts": [[-0.58, -0.9], [-0.84, -0.86], [-0.99, -0.62], [-0.96, -0.32], [-0.84, -0.18]]}]
TILE = (214, 192, 164, 255)
GROUT = (178, 156, 128, 255)
INK = (59, 43, 32, 255)
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets')


def tiles(img, size, width):
    d = ImageDraw.Draw(img)
    t = size // 4
    for i in range(5):
        d.line([(i * t, 0), (i * t, size)], fill=GROUT, width=width)
        d.line([(0, i * t), (size, i * t)], fill=GROUT, width=width)



def icon(size, background=True, color=INK, scale=0.34):
    img = Image.new('RGBA', (size, size), TILE if background else (0, 0, 0, 0))
    if background:
        tiles(img, size, max(2, size // 110))
    d = ImageDraw.Draw(img)
    cx, cy, w = size / 2, size * 0.53, int(size * 0.032)
    for s in CAT:
        pts = [(cx + x * size * scale, cy - y * size * scale) for x, y in s['pts']]
        if s['closed']:
            pts.append(pts[0])
        d.line(pts, fill=color, width=w, joint='curve')
        for qx, qy in (pts[0], pts[-1]):
            d.ellipse([qx - w / 2, qy - w / 2, qx + w / 2, qy + w / 2], fill=color)
    return img


os.makedirs(HERE, exist_ok=True)
out = lambda name: os.path.join(HERE, name)
icon(1024).convert('RGB').save(out('icon.png'))
icon(1024, background=False, scale=0.22).save(out('android-icon-foreground.png'))
icon(1024, background=False, color=(255, 255, 255, 255), scale=0.22).save(out('android-icon-monochrome.png'))
bg = Image.new('RGBA', (1024, 1024), TILE)
tiles(bg, 1024, 9)
bg.convert('RGB').save(out('android-icon-background.png'))
icon(48).convert('RGB').save(out('favicon.png'))
icon(512, background=False, scale=0.3).save(out('splash-icon.png'))
print('icons written to', os.path.normpath(HERE))
