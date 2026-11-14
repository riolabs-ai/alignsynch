"""#971 — the before/after measurement: PNG pixel diff + body-DOM diff per route and width."""
import hashlib
import difflib
import os

from PIL import Image, ImageChops

OUT = "/home/jadenblack/.hermes/profiles/alignsynch-ops/cache/scratch/qa-971"

print("== pixels ==")
for width in (1440, 390):
    for route in ("login", "register"):
        a = f"{OUT}/971-before-{route}-{width}.png"
        b = f"{OUT}/971-after-{route}-{width}.png"
        ha = hashlib.sha256(open(a, "rb").read()).hexdigest()
        hb = hashlib.sha256(open(b, "rb").read()).hexdigest()
        ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
        diff = ImageChops.difference(ia, ib)
        bbox = diff.getbbox()
        changed = 0
        if bbox:
            changed = sum(1 for p in diff.getdata() if p != (0, 0, 0))
        # The hero region only: the left half, which is where the panel lives at 1440.
        hero = ia.crop((0, 0, ia.width // 2, ia.height))
        hero_b = ib.crop((0, 0, ib.width // 2, ib.height))
        hero_diff = ImageChops.difference(hero, hero_b)
        hero_changed = 0
        if hero_diff.getbbox():
            hero_changed = sum(1 for p in hero_diff.getdata() if p != (0, 0, 0))
        total = ia.width * ia.height
        print(
            f"/{route} @{width}: {ia.size} byte_identical={ha == hb} "
            f"changed_px={changed}/{total} ({100 * changed / total:.2f}%) "
            f"hero_half_changed={hero_changed}/{hero.width * hero.height} bbox={bbox}"
        )

print("\n== body DOM ==")
for width in (1440, 390):
    for route in ("login", "register"):
        a = open(f"{OUT}/971-before-{route}-{width}.html").read()
        b = open(f"{OUT}/971-after-{route}-{width}.html").read()
        if a == b:
            print(f"/{route} @{width}: body markup byte-identical ({len(a)} chars)")
            continue
        sm = difflib.SequenceMatcher(None, a, b)
        ratio = sm.ratio()
        # Split on tag boundaries so the diff reads as structure, not characters.
        at = a.replace("><", ">\n<").splitlines()
        bt = b.replace("><", ">\n<").splitlines()
        added = [l for l in difflib.unified_diff(at, bt, lineterm="", n=0) if l.startswith("+") and not l.startswith("+++")]
        removed = [l for l in difflib.unified_diff(at, bt, lineterm="", n=0) if l.startswith("-") and not l.startswith("---")]
        print(f"/{route} @{width}: differs — similarity {ratio:.4f}, {len(added)} added lines, {len(removed)} removed lines")
        for line in removed[:6]:
            print("   REMOVED", line[:200])
        for line in added[:10]:
            print("   ADDED  ", line[:200])
