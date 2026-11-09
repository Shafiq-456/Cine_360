"""Audit all poster/backdrop JPGs in public/posters: validity, dimensions, darkness."""
from PIL import Image
import os, glob

d = "/home/z/my-project/public/posters"
rows = []
for f in sorted(glob.glob(os.path.join(d, "*.jpg"))):
    name = os.path.basename(f)
    try:
        im = Image.open(f)
        im.load()
        w, h = im.size
        # sample average brightness of a small thumb
        thumb = im.convert("L").resize((32, 32))
        px = list(thumb.getdata())
        avg = sum(px) / len(px)
        flag = ""
        if w < 500 or h < 500:
            flag = "LOWRES"
        if avg < 8:
            flag = (flag + " " if flag else "") + "DARK"
        rows.append((name, f"{w}x{h}", round(avg, 1), flag))
    except Exception as e:
        rows.append((name, "BROKEN", "-", str(e)[:40]))

for r in rows:
    print(f"{r[0]:45s} {r[1]:12s} bright={r[2]:>6} {r[3]}")
print(f"\nTotal JPGs: {len(rows)}")
