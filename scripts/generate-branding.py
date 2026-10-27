#!/usr/bin/env python3
"""Generate branding from the supplied SVG geometry (Python 3, librsvg, ImageMagick)."""
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets/branding"
IMAGES = ROOT / "assets/images"
PUBLIC = ROOT / "public"
NAVY = "#080E38"


def run(*args):
    subprocess.run([str(arg) for arg in args], check=True)


def svg_document(body, definitions=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" '
            f'viewBox="0 0 1024 1024"><defs>{definitions}</defs>{body}</svg>\n')


def main():
    for tool in ("rsvg-convert", "magick"):
        if not shutil.which(tool):
            raise SystemExit(f"Missing {tool}; install librsvg and ImageMagick.")
    PUBLIC.mkdir(exist_ok=True)
    # Group.svg contains one compound path: the rounded tile followed by five
    # monogram cutouts. Keep those cutouts exactly; replace only their paint and
    # discard the tile, since native launchers supply the corner mask themselves.
    source = ET.parse(BRAND / "timeclaim-source.svg").getroot()
    paths = source.findall("{http://www.w3.org/2000/svg}path")
    assert len(paths) == 1, "Expected the supplied compound-path SVG"
    subpaths = re.findall(r"M[^M]*", paths[0].attrib["d"])
    assert len(subpaths) == 6 and all(p.rstrip().endswith("Z") for p in subpaths), (
        "Expected one tile and five closed monogram subpaths")
    geometry = "".join(f'<path d="{path}"/>' for path in subpaths[1:])
    # Center the original 1404 x 1388 canvas in a square without stretching.
    assert source.attrib["viewBox"] == "0 0 1404 1388"
    scale = 1024 / 1404
    offset_y = (1404 - 1388) / 2 * scale
    content = ('<defs><linearGradient id="mint" x1="0" y1="0" x2="1" y2="1">'
               '<stop stop-color="#48F5CE"/><stop offset="1" stop-color="#64FFE0"/>'
               '</linearGradient></defs>'
               f'<g fill="url(#mint)" transform="translate(0 {offset_y:.12f}) scale({scale:.12f})">'
               f'{geometry}</g>')
    (BRAND / "timeclaim-symbol.svg").write_text(svg_document(content))
    gradient = ('<linearGradient id="navy" x1="0" y1="1" x2="1" y2="0">'
                '<stop stop-color="#02012C"/><stop offset="1" stop-color="#214674"/>'
                '</linearGradient>')
    background = '<rect width="1024" height="1024" fill="url(#navy)"/>'
    icon = svg_document(background + content, gradient)
    # Android's guaranteed safe circle is 66/108 of the full layer. The glyph,
    # not just its bounding box, fits inside that circle with a small margin.
    foreground = svg_document(f'<g transform="translate(194.56 194.56) scale(.62)">{content}</g>')
    mono_content = content.replace('fill="url(#mint)"', 'fill="#FFFFFF"')
    monochrome = svg_document(f'<g transform="translate(194.56 194.56) scale(.62)">{mono_content}</g>')
    (BRAND / "timeclaim-icon.svg").write_text(icon)
    (BRAND / "timeclaim-monochrome.svg").write_text(monochrome)
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)

        def render(svg, destination, size, opaque=False):
            source = temp / "source.svg"
            source.write_text(svg)
            large = temp / "large.png"
            run("rsvg-convert", "-w", size * 3, "-h", size * 3, "-o", large, source)
            args = ["magick", large, "-resize", f"{size}x{size}", "-strip"]
            if opaque:
                args += ["-background", NAVY, "-alpha", "remove", "-alpha", "off"]
            run(*args, destination)

        render(icon, IMAGES / "icon.png", 1024, True)
        render(svg_document(background, gradient), IMAGES / "android-icon-background.png", 1024, True)
        render(foreground, IMAGES / "android-icon-foreground.png", 1024)
        render(monochrome, IMAGES / "android-icon-monochrome.png", 1024)
        render(svg_document(content), IMAGES / "splash-icon.png", 512)
        render(icon, IMAGES / "favicon.png", 48, True)
        render(svg_document(content), BRAND / "timeclaim-logo.png", 1024)
        render(icon, BRAND / "google-play-icon.png", 512, True)
        render(icon, PUBLIC / "apple-touch-icon.png", 180, True)
        render(icon, PUBLIC / "icon-192.png", 192, True)
        render(icon, PUBLIC / "icon-512.png", 512, True)
        # Maskable web icons need their own safe zone (80% diameter circle).
        render(svg_document(background + f'<g transform="translate(102.4 102.4) scale(.8)">{content}</g>', gradient),
               PUBLIC / "icon-maskable-512.png", 512, True)
        run("magick", IMAGES / "icon.png", "-define", "icon:auto-resize=48,32,16", PUBLIC / "favicon.ico")
    print("Generated native, splash, logo, store and web assets.")


if __name__ == "__main__":
    main()
