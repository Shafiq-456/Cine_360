"""Compose final movie posters & backdrops from raw AI art.

Posters  -> 900x1350 (2:3) with bottom gradient + clean title typography
Backdrops-> 1280x720 (16:9) pure art, no text (used blurred behind detail pages)

Inputs : scripts/tmp/posters_raw/{slug}.png / {slug}-backdrop.png
Outputs: public/posters/{slug}.jpg      / {slug}-backdrop.jpg
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont
import os, sys

RAW = "/home/z/my-project/scripts/tmp/posters_raw"
OUT = "/home/z/my-project/public/posters"

TITLE_FONT = "/usr/share/fonts/opentype/urw-base35/NimbusSansNarrow-Bold.otf"
META_FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

# slug -> (poster title, meta line, accent color)
FILMS = {
    "ramayana-rise-of-a-legend": ("Ramayana", "RISE OF A LEGEND", (255, 196, 84)),
    "nakhrewaalii": ("Nakhrewaalii", "", (255, 122, 168)),
    "pyre": ("Pyre", "", (168, 188, 208)),
    "gajab-raat": ("Gajab Raat", "", (255, 138, 61)),
    "mirzapur-the-movie": ("Mirzapur", "THE MOVIE", (232, 178, 74)),
    "paradise-lost": ("Paradise Lost", "", (120, 190, 190)),
    "raise-the-red-lantern": ("Raise the Red Lantern", "", (230, 70, 60)),
    "nurture": ("Nurture", "", (200, 208, 190)),
    "scene": ("Scene", "", (240, 170, 90)),
    "mookuthi-amman-2": ("Mookuthi Amman 2", "", (255, 196, 84)),
    "jailer-2": ("Jailer 2", "", (255, 150, 60)),
    "karuppu": ("Karuppu", "", (226, 62, 54)),
    "vishwanath-and-sons": ("Vishwanath & Sons", "", (232, 190, 110)),
    "mandaadi": ("Mandaadi", "", (110, 190, 220)),
    "thaai-kizhavi": ("Thaai Kizhavi", "", (240, 200, 120)),
    "haiku": ("Haiku", "", (150, 180, 230)),
    "dorothy": ("Dorothy", "", (140, 210, 210)),
    "sardar-2": ("Sardar 2", "", (90, 180, 255)),
    "cine360-first-light": ("First Light", "A CINE 360 ORIGINAL", (255, 196, 84)),
}


def cover(img, tw, th):
    """Scale + center-crop to exactly cover target box."""
    w, h = img.size
    s = max(tw / w, th / h)
    img = img.resize((round(w * s), round(h * s)), Image.LANCZOS)
    w, h = img.size
    x, y = (w - tw) // 2, (h - th) // 2
    return img.crop((x, y, x + tw, y + th))


def fit_font(text, path, max_w, start, floor, draw):
    size = start
    while size > floor:
        f = ImageFont.truetype(path, size)
        if draw.textlength(text, font=f) <= max_w:
            return f
        size -= 2
    return ImageFont.truetype(path, floor)


def text_with_shadow(base, xy, text, font, fill, shadow_alpha=200, blur=8, offset=3, anchor=None):
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text((xy[0] + offset, xy[1] + offset), text, font=font, fill=(0, 0, 0, shadow_alpha), anchor=anchor)
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    base.alpha_composite(layer)
    d2 = ImageDraw.Draw(base)
    d2.text(xy, text, font=font, fill=fill, anchor=anchor)


def poster(slug):
    title, subtitle, accent = FILMS[slug]
    src = os.path.join(RAW, f"{slug}.png")
    img = Image.open(src).convert("RGB")
    img = cover(img, 900, 1350)
    img = ImageEnhance.Contrast(img).enhance(1.04)
    img = ImageEnhance.Color(img).enhance(1.06)
    base = img.convert("RGBA")

    # bottom gradient for legibility
    grad = Image.new("L", (1, 1350), 0)
    for y in range(820, 1350):
        t = (y - 820) / 530.0
        grad.putpixel((0, y), int(235 * (t ** 1.35)))
    grad = grad.resize((900, 1350))
    black = Image.new("RGBA", (900, 1350), (0, 0, 0, 255))
    black.putalpha(grad)
    base.alpha_composite(black)

    draw = ImageDraw.Draw(base)
    M = 64            # side margin
    max_w = 900 - 2 * M
    y = 1350 - 96     # baseline zone bottom

    # meta line (bottom)
    meta_f = ImageFont.truetype(META_FONT, 21)
    text_with_shadow(base, (M, y), "CINE 360 PRESENTS", meta_f, (235, 238, 245, 235), blur=5, offset=2)

    # subtitle line (small caps above title) if present
    if subtitle:
        sub_f = ImageFont.truetype(META_FONT, 30)
        y -= 46
        text_with_shadow(base, (M, y), subtitle, sub_f, tuple(list(accent) + [255]), blur=6, offset=2)

    # main title (auto-fit, wrap to 2 lines when long)
    words = title.upper().split()
    size = 118
    lines = None
    while size >= 54:
        f = ImageFont.truetype(TITLE_FONT, size)
        # greedy wrap
        cur, attempt = [], []
        ok = True
        for w in words:
            trial = " ".join(cur + [w])
            if draw.textlength(trial, font=f) <= max_w:
                cur.append(w)
            else:
                if not cur:  # single word too wide
                    ok = False
                    break
                attempt.append(" ".join(cur))
                cur = [w]
                if len(attempt) > 1:
                    ok = False
                    break
        if ok and cur:
            attempt.append(" ".join(cur))
            lines = attempt
            break
        size -= 4
    if lines is None:
        f = ImageFont.truetype(TITLE_FONT, 54)
        lines = [title.upper()]
    f = ImageFont.truetype(TITLE_FONT, size)
    lh = int(size * 1.02)
    y -= 26
    for line in reversed(lines):
        text_with_shadow(base, (M, y - lh), line, f, (250, 251, 253, 255), shadow_alpha=230, blur=10, offset=4)
        y -= lh

    # accent rule above title
    y -= 26
    draw.rectangle([M, y, M + 130, y + 5], fill=tuple(list(accent) + [255]))

    out = os.path.join(OUT, f"{slug}.jpg")
    base.convert("RGB").save(out, "JPEG", quality=90, optimize=True)
    print(f"poster  {slug}.jpg")


def backdrop(slug):
    src = os.path.join(RAW, f"{slug}-backdrop.png")
    img = Image.open(src).convert("RGB")
    img = cover(img, 1280, 720)
    img = ImageEnhance.Contrast(img).enhance(1.03)
    out = os.path.join(OUT, f"{slug}-backdrop.jpg")
    img.save(out, "JPEG", quality=86, optimize=True)
    print(f"backdrop {slug}-backdrop.jpg")


if __name__ == "__main__":
    slugs = sys.argv[1:] or list(FILMS.keys())
    for s in slugs:
        raw_p = os.path.join(RAW, f"{s}.png")
        raw_b = os.path.join(RAW, f"{s}-backdrop.png")
        if s != "brahmastra" and os.path.exists(raw_p):
            poster(s)
        if os.path.exists(raw_b):
            backdrop(s)
    print("compose done")
