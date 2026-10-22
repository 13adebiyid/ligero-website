"""Create and verify lossless, full-aspect responsive WebP derivatives of member stills.

Usage (Pillow comes from uv's cache; nothing is installed):
    uv run --offline --with pillow python scripts/build-member-images.py          # build + verify
    uv run --offline --with pillow python scripts/build-member-images.py --check  # verify only

Output: members/media/<stem>-<width>.webp for each width smaller than the source.
Originals are never modified. Pixels are resized with Lanczos in the source mode
(no crop, no rotation), encoded losslessly, and EXIF/XMP/ICC are copied unchanged
(orientation is therefore preserved and pixels are not pre-rotated).
"""
import importlib
import sys
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
speed = importlib.import_module("build-speed-images")
ROOT = HERE.parent
IMAGES = ROOT / "images"
OUT = ROOT / "members" / "media"
STEMS = [f"{kind}-still-{n}" for kind in ("gift", "fashion") for n in range(1, 5)]
WIDTHS = (720, 1440, 2160)


def target_size(size, width):
    return width, max(1, round(size[1] * width / size[0]))


def plan():
    """Yield (source, target, width) for every derivative that is not an upscale."""
    for stem in STEMS:
        source = IMAGES / f"{stem}.webp"
        if not source.is_file():
            yield source, None, None
            continue
        with Image.open(source) as image:
            original_width = image.size[0]
        for width in WIDTHS:
            if width < original_width:
                yield source, OUT / f"{stem}-{width}.webp", width


def resized(image, width):
    return image.resize(target_size(image.size, width), Image.LANCZOS)


def build(source, target, width):
    with Image.open(source) as original:
        original.load()
        meta = speed.metadata(original)
        options = {"lossless": True, "exact": True, "quality": 100, "method": 6}
        if meta["exif"]:
            options["exif"] = meta["exif"]
        if meta["xmp"]:
            options["xmp"] = speed.normalise_xmp(meta["xmp"])
        if meta["icc"]:
            options["icc_profile"] = meta["icc"]
        OUT.mkdir(parents=True, exist_ok=True)
        resized(original, width).save(target, "WEBP", **options)


def verify(source, target, width):
    with Image.open(source) as original, Image.open(target) as copy:
        original.load()
        copy.load()
        problems = []
        expected = resized(original, width)
        if copy.format != "WEBP":
            problems.append(f"format {copy.format}")
        if copy.size != expected.size:
            problems.append(f"size {copy.size} != {expected.size}")
        elif expected.convert("RGBA").tobytes() != copy.convert("RGBA").tobytes():
            problems.append("RGBA pixels differ from Lanczos resize of source")
        want, got = speed.metadata(original), speed.metadata(copy)
        for key in ("exif", "icc", "orientation"):
            if want[key] and want[key] != got[key]:
                problems.append(f"{key} metadata not preserved")
        if want["xmp"] and speed.normalise_xmp(want["xmp"]) != speed.normalise_xmp(got["xmp"]):
            problems.append("xmp metadata not preserved")
        return problems, copy.size


def main():
    check_only = "--check" in sys.argv[1:]
    failed = False
    expected_names = set()
    for source, target, width in plan():
        if target is None:
            print(f"MISSING original {source.name}")
            failed = True
            continue
        expected_names.add(target.name)
        if not check_only:
            build(source, target, width)
        if not target.is_file():
            print(f"MISSING derivative {target.name}")
            failed = True
            continue
        problems, size = verify(source, target, width)
        failed = failed or bool(problems)
        status = "ok" if not problems else "FAIL: " + "; ".join(problems)
        print(f"{target.name} {size[0]}x{size[1]} {target.stat().st_size:,} bytes {status}")
    if OUT.is_dir():
        for extra in sorted(p.name for p in OUT.glob("*.webp") if p.name not in expected_names):
            print(f"STALE unexpected {extra}")
            failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
