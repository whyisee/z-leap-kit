#!/usr/bin/env python3
"""生成 Android 启动图标。

品牌取自站点已有物料 `app/public/og-image.svg`：深色底 + 蓝色圆角框里的 W，
accent 渐变 #8AB4F8 → #6EE7B7。这里不另创图形，只是把同一套视觉做成图标。

    python3 scripts/gen_app_icon.py

产物（覆盖）：
    android/app/src/main/res/mipmap-*/ic_launcher.png           传统图标（自带圆角）
    android/app/src/main/res/mipmap-*/ic_launcher_foreground.png 自适应图标前景（透明）
    android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml   自适应图标声明
    android/app/src/main/res/values/colors.xml                   背景色

改颜色/线宽只动下面几个常量，重跑即可。
"""

from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# ---- 视觉参数（与 og-image.svg / foundation.css 对齐）
BG_CENTER = (30, 42, 62)  # #1E2A3E
BG_EDGE = (10, 13, 20)  # #0A0D14
INK_FROM = (138, 180, 248)  # #8AB4F8
INK_TO = (110, 231, 183)  # #6EE7B7
CORNER_RATIO = 0.225  # 圆角占边长比例，接近 Android 系统图标

# W 的骨架折线（512 画布坐标系），来自 og-image 里那个手写体大写 W 的几何化
W_POINTS = [(166, 194), (205, 320), (256, 226), (307, 320), (346, 194)]
W_WIDE = 1.7  # 放大到占画面约 62%：图标主体太小时，桌面上会显得空
W_STROKE = 36

SS = 4  # 超采样倍数：先按 4 倍画再缩，边缘才不毛
BASE = 512
S = BASE * SS

RES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "android", "app", "src", "main", "res")

# 传统图标各密度边长
LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
# 自适应图标前景是 108dp 画布（比桌面可见的 72dp 大一圈，留出裁剪余量）
FOREGROUND = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def _gradient_2d(size: int, start, end, diagonal: bool) -> np.ndarray:
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    if diagonal:
        t = (xx + yy) / (2 * (size - 1))
    else:
        t = yy / (size - 1)
    t = t[:, :, None]
    return (np.array(start, np.float32) * (1 - t) + np.array(end, np.float32) * t).astype(np.uint8)


def _radial_falloff(size: int, hot=(0.34, 0.26), power=1.6) -> np.ndarray:
    """左上偏亮的径向权重：1 = 中心，0 = 远处。给纯色底加一点体积。"""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    cx, cy = hot[0] * size, hot[1] * size
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / (size * 0.86)
    return np.clip(1 - dist, 0, 1) ** power


def _w_mask(size: int, scale: float) -> Image.Image:
    """W 的实心遮罩：粗折线 + 圆头，拐点靠 joint='curve' 自动圆角。"""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    cx = cy = size / 2
    k = (size / BASE) * scale
    pts = [(cx + (x - 256) * k, cy + (y - 257) * k) for x, y in W_POINTS]
    width = round(W_STROKE * k)

    draw.line(pts, fill=255, width=width, joint="curve")
    r = width / 2
    for x, y in (pts[0], pts[-1]):  # 两端补圆，line 默认是平头
        draw.ellipse([x - r, y - r, x + r, y + r], fill=255)
    return mask


def _rounded(mask_size: int, radius: int) -> Image.Image:
    m = Image.new("L", (mask_size, mask_size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, mask_size - 1, mask_size - 1], radius=radius, fill=255)
    return m


def build_legacy() -> Image.Image:
    """传统图标：自带深色圆角底 + W，给 Android 7 及以前和部分启动器用。"""
    bg = _gradient_2d(S, BG_CENTER, BG_EDGE, diagonal=False)
    glow = _radial_falloff(S)
    bg = np.clip(bg * (0.72 + 0.5 * glow[:, :, None]), 0, 255).astype(np.uint8)

    canvas = Image.fromarray(bg, "RGB").convert("RGBA")

    mask = _w_mask(S, W_WIDE)

    # 外发光：先把 W 糊开，压暗当光晕，再叠实心 W
    halo_mask = mask.filter(ImageFilter.GaussianBlur(radius=S * 0.016))
    halo = Image.new("RGBA", (S, S), INK_FROM + (0,))
    halo.putalpha(halo_mask.point(lambda v: int(v * 0.24)))
    canvas = Image.alpha_composite(canvas, halo)

    ink = Image.fromarray(_gradient_2d(S, INK_FROM, INK_TO, diagonal=True), "RGB")
    canvas.paste(ink, (0, 0), mask)

    rounded = _rounded(S, round(S * CORNER_RATIO))
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), rounded)
    return out.resize((BASE, BASE), Image.LANCZOS)


def build_foreground() -> Image.Image:
    """自适应图标前景：透明底 + W，系统自己套形状。

    图形按 72/108 的安全区缩过，圆形遮罩也不会啃到 W。
    """
    canvas = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))

    # 直接用 512 画布的 mask 尺度，比传统图标略小（自适应图标系统会放大裁切）
    # 系统只保留画布中心 72/108 的安全区，图形得比传统图标明显收一圈
    mask = _w_mask(S, W_WIDE * 0.70).resize((BASE, BASE), Image.LANCZOS)

    halo = mask.filter(ImageFilter.GaussianBlur(radius=BASE * 0.016))
    halo_layer = Image.new("RGBA", (BASE, BASE), INK_FROM + (0,))
    halo_layer.putalpha(halo.point(lambda v: int(v * 0.26)))
    canvas = Image.alpha_composite(canvas, halo_layer)

    ink = Image.fromarray(_gradient_2d(BASE, INK_FROM, INK_TO, diagonal=True), "RGB")
    canvas.paste(ink, (0, 0), mask)
    return canvas


def write_pngs(image: Image.Image, sizes: dict[str, int], filename: str) -> None:
    for density, px in sizes.items():
        target = os.path.join(RES, f"mipmap-{density}")
        os.makedirs(target, exist_ok=True)
        image.resize((px, px), Image.LANCZOS).save(os.path.join(target, filename), optimize=True)


ADAPTIVE_XML = """<?xml version="1.0" encoding="utf-8"?>
<!-- 图标由 scripts/gen_app_icon.py 生成，别手改 -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
"""

COLORS_XML = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <!-- 自适应图标背景，与站点 Env.bg 同色 -->
    <color name="ic_launcher_background">#0D1016</color>
</resources>
"""


def main() -> None:
    legacy = build_legacy()
    foreground = build_foreground()

    write_pngs(legacy, LEGACY, "ic_launcher.png")
    write_pngs(foreground, FOREGROUND, "ic_launcher_foreground.png")

    anydpi = os.path.join(RES, "mipmap-anydpi-v26")
    os.makedirs(anydpi, exist_ok=True)
    with open(os.path.join(anydpi, "ic_launcher.xml"), "w", encoding="utf-8") as handle:
        handle.write(ADAPTIVE_XML)

    with open(os.path.join(RES, "values", "colors.xml"), "w", encoding="utf-8") as handle:
        handle.write(COLORS_XML)

    print("done:", ", ".join(f"{d}={px}px" for d, px in LEGACY.items()))


if __name__ == "__main__":
    main()
