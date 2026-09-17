#!/usr/bin/env python3
"""يولّد أيقونة تطبيق العلم (فاتح/داكن/ملوّن) من الشعار الرسمي في كتالوج الأصول.

الاستخدام: python3 ios/scripts/make-app-icon.py   (يحتاج Pillow: pip3 install pillow)
الناتج: ios/Elm/Assets.xcassets/AppIcon.appiconset/AppIcon*.png ومعاينة docs/ios/screenshots/app-icon-preview.png
"""
from PIL import Image, ImageDraw, ImageFilter
import os, sys
S = 1024
SCR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(SCR, '..'))
OUT = os.path.join(ROOT, 'Elm/Assets.xcassets/AppIcon.appiconset')

logo = Image.open(os.path.join(ROOT, 'Elm/Assets.xcassets/OfficialLogo.imageset/logo.png')).convert('RGBA')
w, h = logo.size
px = logo.load()
# Keep only the Arabic wordmark: drop Latin subtitle (bottom-right) and the green rule.
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if a == 0: continue
        if x >= 505 and y >= 280: px[x, y] = (0, 0, 0, 0)        # "Al Elm"
        elif g > r + 30 and g > b + 30: px[x, y] = (0, 0, 0, 0)  # green rule
mark = logo.crop(logo.getbbox())
print('wordmark bbox', logo.getbbox(), mark.size)

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def background(top, bottom, size=S):
    bg = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(bg)
    for y in range(size):
        d.line([(0, y), (size, y)], fill=lerp(top, bottom, y / size))
    return bg

def compose(bg, mark_color, rule_color, target_w=0.70, mark_cy=0.465):
    icon = bg.convert('RGBA')
    mw, mh = mark.size
    tw = int(S * target_w); th = int(mh * tw / mw)
    m = mark.resize((tw, th), Image.LANCZOS)
    tint = Image.new('RGBA', m.size, mark_color + (255,))
    tint.putalpha(m.getchannel('A'))
    x = (S - tw) // 2; y = int(S * mark_cy - th / 2)
    icon.alpha_composite(tint, (x, y))
    if rule_color:
        d = ImageDraw.Draw(icon)
        rw = int(tw * 0.62); rh = 14; ry = y + th + 74
        d.rounded_rectangle([(S - rw) // 2, ry, (S + rw) // 2, ry + rh], radius=rh // 2, fill=rule_color + (255,))
    return icon

NAVY, NAVY_DEEP, INK_DEEP = (0x1a, 0x42, 0x82), (0x12, 0x28, 0x4b), (0x0b, 0x13, 0x22)
GOLD, GOLD_DARK = (0xcf, 0x9a, 0x16), (0xe0, 0xad, 0x2b)
WHITE = (255, 255, 255)

light = compose(background(NAVY, NAVY_DEEP), WHITE, GOLD).convert('RGB')
dark = compose(background(NAVY_DEEP, INK_DEEP), WHITE, GOLD_DARK).convert('RGB')
# Tinted: grayscale glyph on transparent — the system supplies the background and tint.
tinted = compose(Image.new('RGBA', (S, S), (0, 0, 0, 0)), WHITE, (0xb8, 0xb8, 0xb8))
light.save(f'{OUT}/AppIcon.png', optimize=True)
dark.save(f'{OUT}/AppIcon-Dark.png', optimize=True)
tinted.save(f'{OUT}/AppIcon-Tinted.png', optimize=True)

# Preview sheet: masked at iOS sizes on light and dark wallpapers.
def rounded(im, size):
    im = im.convert('RGBA').resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * 0.2237), fill=255)
    im.putalpha(mask.resize((size, size), Image.LANCZOS))
    return im
sheet = Image.new('RGB', (1400, 560), (0xfa, 0xf9, 0xf5))
ImageDraw.Draw(sheet).rectangle([700, 0, 1400, 560], fill=(0x0b, 0x13, 0x22))
x = 40
for size in (360, 180, 120, 60, 29):
    sheet.paste(rounded(light, size), (x, 100), rounded(light, size)); x += size + 40
x = 740
for size in (360, 180, 120, 60, 29):
    sheet.paste(rounded(dark, size), (x, 100), rounded(dark, size)); x += size + 40
sheet.save(os.path.join(ROOT, '..', 'docs/ios/screenshots/app-icon-preview.png'))
print('ok')
