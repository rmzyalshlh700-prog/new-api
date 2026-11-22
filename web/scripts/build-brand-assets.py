#!/usr/bin/env python3
"""Build the Astramux app mark from the supplied JPEG.

Pipeline
  1. sample the uniform light background from the four corner pixels
  2. matte it out with a smooth alpha ramp on the Euclidean RGB distance
  3. decontaminate the edge band and dilate the core colour into it, so no
     light halo survives on any background
  4. crop to the mark, fit it proportionally to 308px, centre it on a
     transparent 512x512 canvas
  5. write PNG-32 (<30 KB) and a 16/32/48 favicon, then assert the result

Only colour precision is normalised at the last step (posterise 6, alpha 32
levels): the silhouette, curves and proportions are never resampled non-
uniformly and stay pixel-exact after the single LANCZOS fit.
"""

import io
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageFilter

RAW = "/tmp/astramux_raw.jpg"
REPO = "/workspace/chats/5cf79d6f6e0dc3001cb47cd4"
PNG_OUT = os.path.join(REPO, "web/public/logo.png")
ICO_OUT = os.path.join(REPO, "web/public/favicon.ico")

CANVAS = 512
SAFE = 308  # ~60% of the canvas -> ~102px of padding per side

LOW, HIGH = 12.0, 48.0  # RGB distance ramp (background .. mark)
MIN_COMPONENT = 20  # drop JPEG speckle, keep the three real pieces


def main() -> int:
    src = Image.open(RAW).convert("RGB")
    rgb = np.asarray(src, dtype=np.float64)
    h, w, _ = rgb.shape

    # 1. Uniform outer background, from the corners.
    corners = np.array(
        [rgb[0, 0], rgb[0, w - 1], rgb[h - 1, 0], rgb[h - 1, w - 1]]
    )
    bg = np.median(corners, axis=0)
    hex_bg = "#" + "".join(f"{int(v):02X}" for v in bg)
    print(f"background: rgb{tuple(int(v) for v in bg)} {hex_bg}")

    # 2. Smooth, anti-aliased alpha from the distance to that background.
    distance = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    distance = np.asarray(
        Image.fromarray(distance.astype(np.float32), "F").filter(
            ImageFilter.MedianFilter(3)
        ),
        dtype=np.float64,
    )
    alpha = np.clip((distance - LOW) / (HIGH - LOW), 0.0, 1.0)
    alpha[alpha < 0.04] = 0.0
    alpha[alpha > 0.96] = 1.0

    # 3a. Decontaminate: undo the background blend on the edge band.
    safe = np.where(alpha > 0, alpha, 1.0)[..., None]
    clean = np.clip((rgb - (1.0 - safe) * bg) / safe, 0, 255)

    # 3b. Dilate the core colour outward so anti-aliased pixels carry pure
    # mark colour instead of a washed-out mix (this kills the light fringe).
    core = alpha > 0.96
    known = core.copy()
    filled = clean.copy()
    filled[~known] = 0.0
    for _ in range(6):
        if known.all():
            break
        padded_known = np.pad(known, 1, constant_values=False)
        padded_rgb = np.pad(filled, ((1, 1), (1, 1), (0, 0)), mode="edge")
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nb_known = padded_known[
                    1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w
                ]
                nb_rgb = padded_rgb[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w]
                take = (~known) & nb_known
                filled[take] = nb_rgb[take]
                known |= take

    # 3c. Drop isolated JPEG speckle from the matte.
    component_count, labels = cv2.connectedComponents(
        core.astype(np.uint8), connectivity=8
    )
    keep_ids = [
        i
        for i in range(1, component_count)
        if int((labels == i).sum()) >= MIN_COMPONENT
    ]
    solid = np.isin(labels, keep_ids)
    alpha_clean = np.where(solid, alpha, 0.0)
    print(f"mark pieces kept: {len(keep_ids)}")

    rgba = np.dstack([filled, alpha_clean * 255.0]).astype(np.uint8)
    mark = Image.fromarray(rgba, "RGBA")

    # 4. Crop, fit proportionally, centre.
    bbox = mark.getchannel("A").getbbox()
    if not bbox:
        print("no opaque pixels found", file=sys.stderr)
        return 1
    cropped = mark.crop(bbox)
    print(f"source bbox: {bbox} -> {cropped.size}")

    scale = SAFE / max(cropped.size)
    target = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    fitted = (
        cropped.convert("RGBa")
        .resize(target, Image.Resampling.LANCZOS)
        .convert("RGBA")
    )
    assert max(fitted.size) <= SAFE, f"{fitted.size} exceeds {SAFE}px"

    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    offset = ((CANVAS - fitted.width) // 2, (CANVAS - fitted.height) // 2)
    canvas.paste(fitted, offset, fitted)
    print(f"fitted: {fitted.size} scale={scale:.4f} offset={offset}")

    # 5. Normalise precision imperceptibly (<=3/255 colour, 4/255 alpha).
    arr = np.asarray(canvas).astype(np.float64)
    arr[..., :3] = np.round(arr[..., :3] / 6.0) * 6.0
    arr[..., 3] = np.round(arr[..., 3] * 31.0 / 255.0) * (255.0 / 31.0)
    canvas = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")

    canvas.save(PNG_OUT, format="PNG", optimize=True, compress_level=9)
    canvas.save(ICO_OUT, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

    # 6. Readback assertions.
    png = Image.open(PNG_OUT)
    png.load()
    assert png.size == (512, 512), png.size
    assert png.mode == "RGBA", png.mode
    for corner in [(0, 0), (511, 0), (0, 511), (511, 511)]:
        assert png.getpixel(corner) == (0, 0, 0, 0), (corner, png.getpixel(corner))

    content = png.getchannel("A").getbbox()
    assert content is not None
    bw, bh = content[2] - content[0], content[3] - content[1]
    assert bw <= SAFE and bh <= SAFE, (bw, bh)
    assert abs((content[0] + content[2]) - CANVAS) <= 1, content
    assert abs((content[1] + content[3]) - CANVAS) <= 1, content

    size_bytes = os.path.getsize(PNG_OUT)
    assert size_bytes < 30 * 1024, size_bytes

    ico = Image.open(ICO_OUT)
    ico_sizes = sorted(ico.info.get("sizes", set()))
    assert set(ico_sizes) == {(16, 16), (32, 32), (48, 48)}, ico_sizes

    # Colour sanity: matte edges stay saturated brand colour, never grey.
    px = np.asarray(png).astype(np.float64)
    band = (px[..., 3] > 10) & (px[..., 3] < 250)
    edge_rgb = px[..., :3][band]
    sat = (edge_rgb.max(axis=1) - edge_rgb.min(axis=1)).mean()
    assert sat > 60, sat
    assert len(np.unique(px[..., 3])) <= 32, len(np.unique(px[..., 3]))

    print("\nassertions")
    print(f"  png       {png.size} {png.mode}, {size_bytes / 1024:.1f} KB")
    print(f"  content   {content} -> {bw}x{bh} (limit {SAFE})")
    print(f"  corners   {[png.getpixel(p) for p in [(0, 0), (511, 511)]]}")
    print(f"  alpha     {len(np.unique(px[..., 3]))} levels, edge saturation {sat:.0f}")
    print(f"  favicon   {ico_sizes}, {os.path.getsize(ICO_OUT) / 1024:.1f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
