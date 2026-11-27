"""Rebuild equal-size SVG viewports from a manifest without changing raster pixels.

Usage: python3 scripts/normalize-cat-art.py data/skins/normalized-v86/manifest.json
Requires Pillow only for reading the embedded raster's visible alpha bounds.
The longest visible side occupies 96% of a square viewport for every pose.
"""
from pathlib import Path
import base64
import hashlib
import io
import json
import re
import sys
from PIL import Image

repo = Path(__file__).resolve().parents[1]
manifest = repo / sys.argv[1]
entries = json.loads(manifest.read_text())
for destination, entry in entries.items():
    source = repo / entry['source']
    if source.suffix == '.svg':
        match = re.search(r'data:image/(webp|png);base64,([^\"]+)', source.read_text())
        if not match:
            raise ValueError(f'No embedded raster: {source}')
        mime, encoded = match.groups()
        data = base64.b64decode(encoded)
    else:
        data = source.read_bytes()
        mime, encoded = source.suffix[1:], base64.b64encode(data).decode()
    image = Image.open(io.BytesIO(data)).convert('RGBA')
    width, height = image.size
    box = image.getchannel('A').point(lambda alpha: 255 if alpha >= 16 else 0).getbbox()
    if not box:
        raise ValueError(f'Empty artwork: {source}')
    x0, y0, x1, y1 = box
    side = max(x1 - x0, y1 - y0) / .96
    left, top = (x0 + x1 - side) / 2, (y0 + y1 - side) / 2
    output = repo / destination
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" '
        f'viewBox="{left:.6f} {top:.6f} {side:.6f} {side:.6f}">'
        f'<image x="0" y="0" width="{width}" height="{height}" '
        f'href="data:image/{mime};base64,{encoded}"/></svg>\n'
    )
    entry.update(source_sha256=hashlib.sha256(data).hexdigest(), visible_bbox=box,
                 viewbox=[left, top, side, side], visible_fraction=.96)
manifest.write_text(json.dumps(entries, indent=2))
print(f'Normalized {len(entries)} SVG viewports; raster pixels unchanged')
