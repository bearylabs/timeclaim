#!/usr/bin/env python3
"""Check dimensions, opacity, adaptive safe zones, and configured asset paths."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def check_image(relative, size, transparent=False, safe_radius=None, monochrome=False):
    path = ROOT / relative
    dimensions = subprocess.check_output(
        ["magick", "identify", "-format", "%wx%h", str(path)], text=True)
    assert dimensions == f"{size}x{size}", (relative, dimensions)
    pixels = subprocess.check_output(["magick", str(path), "-depth", "8", "rgba:-"])
    alpha = pixels[3::4]
    assert max(alpha) == 255, f"Empty image: {relative}"
    if transparent:
        assert min(alpha) == 0, f"Expected transparent canvas: {relative}"
    else:
        assert min(alpha) == 255, f"Unexpected transparency: {relative}"
    for index, opacity in enumerate(alpha):
        if not opacity:
            continue
        if safe_radius:
            x, y = index % size + 0.5, index // size + 0.5
            assert (x - size / 2) ** 2 + (y - size / 2) ** 2 <= (size * safe_radius) ** 2, (
                f"Glyph outside safe zone: {relative} at {x}, {y}")
        if monochrome:
            assert pixels[index * 4:index * 4 + 3] == b'\xff\xff\xff', relative
    print(f"OK {relative}")


def main():
    config = json.loads((ROOT / "app.json").read_text())["expo"]
    adaptive = config["android"]["adaptiveIcon"]
    check_image(config["icon"], 1024)
    check_image(config["ios"]["icon"], 1024)
    check_image(adaptive["backgroundImage"], 1024)
    check_image(adaptive["foregroundImage"], 1024, True, 66 / 108 / 2)
    check_image(adaptive["monochromeImage"], 1024, True, 66 / 108 / 2, True)
    splash = next(plugin[1] for plugin in config["plugins"]
                  if isinstance(plugin, list) and plugin[0] == "expo-splash-screen")
    check_image(splash["image"], 512, True)
    check_image(config["web"]["favicon"], 48)
    check_image("assets/branding/timeclaim-logo.png", 1024, True)
    check_image("assets/branding/google-play-icon.png", 512)
    check_image("public/apple-touch-icon.png", 180)
    manifest = json.loads((ROOT / "public/manifest.webmanifest").read_text())
    for icon in manifest["icons"]:
        check_image(f'public/{icon["src"].lstrip("/")}', int(icon["sizes"].split("x")[0]))
    print("Branding checks passed.")


if __name__ == "__main__":
    main()
