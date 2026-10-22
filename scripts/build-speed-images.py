"""Create and verify exact-resolution lossless WebP copies of the heavy PNG assets.

Usage (Pillow is not installed globally; uv supplies it without installing anything):
    uv run --with pillow python scripts/build-speed-images.py          # build + verify
    uv run --with pillow python scripts/build-speed-images.py --check  # verify only

Originals are never modified or removed. Every copy is decoded again and compared
with its source on width, height and every RGBA byte, and EXIF/XMP/ICC/orientation
metadata that the source carries must be carried by the copy.
"""
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "images"
ASSETS = {
    "jacket-front.PNG": "jacket-front.webp",
    "jacket-back.PNG": "jacket-back.webp",
    "ash-hero.png": "ash-hero.webp",
    "ifeoluwa-hero.png": "ifeoluwa-hero.webp",
}
ORIENTATION = 274


def metadata(image):
    return {
        "exif": (image.info.get("exif") or b"").removeprefix(b"Exif\x00\x00"),
        "xmp": image.info.get("xmp") or image.info.get("XML:com.adobe.xmp") or b"",
        "icc": image.info.get("icc_profile") or b"",
        "orientation": image.getexif().get(ORIENTATION),
    }


def normalise_xmp(value):
    return value.encode("utf-8") if isinstance(value, str) else value


def build(source, target):
    with Image.open(source) as original:
        original.load()
        meta = metadata(original)
        options = {"lossless": True, "exact": True, "quality": 100, "method": 6}
        if meta["exif"]:
            options["exif"] = meta["exif"]
        if meta["xmp"]:
            options["xmp"] = normalise_xmp(meta["xmp"])
        if meta["icc"]:
            options["icc_profile"] = meta["icc"]
        original.save(target, "WEBP", **options)


def verify(source, target):
    with Image.open(source) as original, Image.open(target) as copy:
        original.load()
        copy.load()
        problems = []
        if copy.format != "WEBP":
            problems.append(f"format {copy.format}")
        if original.size != copy.size:
            problems.append(f"size {original.size} != {copy.size}")
        if original.convert("RGBA").tobytes() != copy.convert("RGBA").tobytes():
            problems.append("RGBA pixels differ")
        want, got = metadata(original), metadata(copy)
        for key in ("exif", "icc", "orientation"):
            if want[key] and want[key] != got[key]:
                problems.append(f"{key} metadata not preserved")
        if want["xmp"] and normalise_xmp(want["xmp"]) != normalise_xmp(got["xmp"]):
            problems.append("xmp metadata not preserved")
        return problems, original.size


def main():
    check_only = "--check" in sys.argv[1:]
    failed = False
    source_total = copy_total = 0
    for source_name, target_name in ASSETS.items():
        source, target = IMAGES / source_name, IMAGES / target_name
        if not source.is_file():
            print(f"MISSING original {source_name}")
            failed = True
            continue
        if not check_only:
            build(source, target)
        if not target.is_file():
            print(f"MISSING copy {target_name}")
            failed = True
            continue
        problems, size = verify(source, target)
        source_total += source.stat().st_size
        copy_total += target.stat().st_size
        status = "ok" if not problems else "FAIL: " + "; ".join(problems)
        failed = failed or bool(problems)
        print(f"{target_name} {size[0]}x{size[1]} {source.stat().st_size:,} -> {target.stat().st_size:,} bytes {status}")
    if source_total:
        print(f"total {source_total:,} -> {copy_total:,} bytes ({source_total - copy_total:,} saved, originals kept)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
