"""Print every committed still's dimensions, size and ink share.

A flat frame prints ~1 distinct colour and 0 % ink; a real screen is thousands and 5–20 %. Run it
from `docs/qa-as2-home/` after a capture, and paste the table into the README.
"""

import os
import struct

from PIL import Image

for name in sorted(os.listdir(".")):
    if not name.endswith(".png"):
        continue
    raw = open(name, "rb").read()
    width, height = struct.unpack(">II", raw[16:24])
    image = Image.open(name).convert("RGB")
    thumb = image.resize((240, max(1, int(240 * height / width))))
    pixels = list(thumb.getdata())
    distinct = len(set(pixels))
    ink = sum(1 for p in pixels if not (p[0] > 245 and p[1] > 245 and p[2] > 245)) / len(pixels)
    print(
        f"{name:20s} {width}x{height}  {os.path.getsize(name) // 1024:5d}KB  "
        f"distinct={distinct:5d}  ink={ink * 100:5.1f}%"
    )
