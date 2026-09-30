#!/usr/bin/env python3
import os
import shutil
import subprocess
from PIL import Image

def generate_icns(source_png: str, output_icns: str):
    if not os.path.exists(source_png):
        raise FileNotFoundError(f"Source image not found: {source_png}")

    iconset_dir = "/tmp/JinniCanvas.iconset"
    if os.path.exists(iconset_dir):
        shutil.rmtree(iconset_dir)
    os.makedirs(iconset_dir, exist_ok=True)

    img = Image.open(source_png).convert("RGBA")

    # 尺寸规格
    specs = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png"),
    ]

    for size, name in specs:
        target = img.resize((size, size), Image.Resampling.LANCZOS)
        target.save(os.path.join(iconset_dir, name))

    os.makedirs(os.path.dirname(os.path.abspath(output_icns)), exist_ok=True)
    subprocess.run(["iconutil", "-c", "icns", iconset_dir, "-o", output_icns], check=True)
    shutil.rmtree(iconset_dir, ignore_errors=True)
    print(f"✓ 成功生成图标：{output_icns}")

if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    src = os.path.join(base_dir, "static", "images", "logo.png")
    dest = os.path.join(base_dir, "assets", "AppIcon.icns")
    generate_icns(src, dest)
