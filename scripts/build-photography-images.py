from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / "images/ash-pic-10.webp"
destination = ROOT / "services/photography/ash-pic-10-preview.webp"
with Image.open(source) as original:
    image = ImageOps.exif_transpose(original)
    image.thumbnail((1800, 1800), Image.Resampling.LANCZOS)
    image.save(destination, "WEBP", quality=88, method=6)
print(f"Photography preview: {destination.stat().st_size:,} bytes (original kept)")
