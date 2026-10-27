"""Draw the sprites for the newer level objects, the decorations, the
city skyline and the darker background wall tiles.

Run from the project root:

    python3 tools/build_gadgets.py

Every sprite is drawn at its native pixel size, where one map cell is 16
pixels, and scaled up three times with no smoothing so it matches the
pixel density of Madeline. Outputs go to assets/generated.
"""

import math
import os
import random

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "generated")
SCALE = 3
CELL = 16

INK = (20, 14, 30, 255)
STEEL_DARK = (52, 58, 82, 255)
STEEL = (92, 102, 136, 255)
STEEL_LIGHT = (150, 162, 196, 255)
WOOD_DARK = (74, 42, 34, 255)
WOOD = (122, 72, 50, 255)
WOOD_LIGHT = (168, 108, 70, 255)
GOLD_DARK = (160, 92, 24, 255)
GOLD = (236, 170, 52, 255)
GOLD_LIGHT = (255, 232, 140, 255)
SNOW = (236, 242, 255, 255)
SNOW_SHADE = (176, 190, 226, 255)
WARM = (255, 214, 120, 255)
WARM_LIGHT = (255, 244, 196, 255)
RED = (196, 52, 64, 255)
RED_DARK = (120, 26, 44, 255)
STONE_DARK = (66, 66, 82, 255)
STONE = (106, 104, 120, 255)
STONE_LIGHT = (146, 144, 160, 255)
GREEN_DARK = (30, 70, 70, 255)
GREEN = (48, 112, 96, 255)


def save(image, *parts, scale=SCALE):
    """Scale an image up without smoothing and write it under the generated folder."""
    path = os.path.join(OUT, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if scale != 1:
        image = image.resize((image.width * scale, image.height * scale), Image.NEAREST)
    image.save(path)
    print(os.path.relpath(path, ROOT), image.size)


def canvas(w, h):
    """Return a transparent image and a drawing context for it."""
    image = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def box(d, x, y, w, h, fill, outline=None):
    """Fill a rectangle given by its corner and size, with an optional one pixel outline."""
    if w <= 0 or h <= 0:
        return
    d.rectangle([x, y, x + w - 1, y + h - 1], fill=fill, outline=outline)


def dot(d, x, y, colour):
    """Set one pixel."""
    d.point((x, y), fill=colour)


def outline(image, colour=INK):
    """Add a one pixel dark outline around every opaque shape."""
    src = image.load()
    out = image.copy()
    dst = out.load()
    for y in range(image.height):
        for x in range(image.width):
            if src[x, y][3]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < image.width and 0 <= ny < image.height and src[nx, ny][3] > 100:
                    dst[x, y] = colour
                    break
    return out


def spring_frame(extend):
    """One frame of the spring: a bolted base, a coil and a red pad.

    extend is how many pixels the pad sits above its resting height; a
    negative value squashes the coil.
    """
    image, d = canvas(CELL, CELL)
    box(d, 2, 13, 12, 3, STEEL_DARK)
    box(d, 3, 13, 10, 1, STEEL_LIGHT)
    dot(d, 4, 14, INK)
    dot(d, 11, 14, INK)
    top = max(1, 9 - extend)
    for y in range(top + 2, 13):
        left = (y - top) % 2 == 0
        box(d, 5 if left else 6, y, 5, 1, STEEL_LIGHT if left else STEEL)
    box(d, 3, top, 10, 2, RED)
    box(d, 3, top, 10, 1, (240, 110, 110, 255))
    box(d, 3, top + 1, 10, 1, RED_DARK)
    return outline(image)


def build_spring():
    """Spring sheet: resting, squashed and launched."""
    sheet = Image.new("RGBA", (CELL * 3, CELL), (0, 0, 0, 0))
    for index, extend in enumerate((0, -3, 6)):
        sheet.paste(spring_frame(extend), (index * CELL, 0))
    save(sheet, "sprites", "spring.png")


def build_touch_switch():
    """Touch switch sheet: dormant ring, lit ring and a pulse frame."""
    sheet = Image.new("RGBA", (CELL * 3, CELL), (0, 0, 0, 0))
    styles = [
        ((70, 80, 112, 255), (120, 132, 170, 255), (40, 44, 66, 255)),
        ((96, 220, 255, 255), (220, 250, 255, 255), (40, 120, 190, 255)),
        ((160, 240, 255, 255), (255, 255, 255, 255), (70, 170, 230, 255)),
    ]
    for index, (ring, light, core) in enumerate(styles):
        image, d = canvas(CELL, CELL)
        d.ellipse([2, 2, 13, 13], outline=ring, width=2)
        d.arc([2, 2, 13, 13], 200, 290, fill=light, width=1)
        d.polygon([(8, 4), (11, 8), (8, 11), (5, 8)], fill=core)
        d.polygon([(8, 5), (10, 8), (8, 8), (6, 8)], fill=light)
        sheet.paste(outline(image), (index * CELL, 0))
    save(sheet, "sprites", "touch_switch.png")


def build_gate():
    """Switch gate panel, tileable, in a closed and an opened colour."""
    sheet = Image.new("RGBA", (CELL * 2, CELL), (0, 0, 0, 0))
    for index, (base, light, accent) in enumerate((((58, 64, 96, 255), (98, 108, 150, 255), (90, 200, 240, 255)),
                                                    ((44, 70, 92, 255), (90, 140, 170, 255), (190, 250, 255, 255)))):
        image, d = canvas(CELL, CELL)
        box(d, 0, 0, CELL, CELL, base)
        box(d, 0, 0, CELL, 1, light)
        box(d, 0, 0, 1, CELL, light)
        box(d, 0, CELL - 1, CELL, 1, INK)
        box(d, CELL - 1, 0, 1, CELL, INK)
        for x, y in ((2, 2), (13, 2), (2, 13), (13, 13)):
            dot(d, x, y, light)
        d.line([(4, 4), (11, 11)], fill=STEEL_DARK)
        d.line([(11, 4), (4, 11)], fill=STEEL_DARK)
        box(d, 6, 6, 4, 4, accent)
        box(d, 7, 7, 2, 2, (255, 255, 255, 255))
        sheet.paste(image, (index * CELL, 0))
    save(sheet, "sprites", "switch_gate.png")


def build_dash_block():
    """Cracked rubble block, tileable, that breaks when dashed into."""
    rng = random.Random(7)
    image, d = canvas(CELL, CELL)
    box(d, 0, 0, CELL, CELL, STONE)
    for _ in range(26):
        x, y = rng.randrange(CELL), rng.randrange(CELL)
        dot(d, x, y, rng.choice((STONE_DARK, STONE_LIGHT, (120, 112, 128, 255))))
    box(d, 0, 0, CELL, 1, STONE_LIGHT)
    box(d, 0, 0, 1, CELL, STONE_LIGHT)
    box(d, 0, CELL - 1, CELL, 1, STONE_DARK)
    box(d, CELL - 1, 0, 1, CELL, STONE_DARK)
    d.line([(3, 2), (6, 6), (5, 9), (8, 13)], fill=INK)
    d.line([(6, 6), (11, 5), (13, 8)], fill=INK)
    d.line([(5, 9), (2, 11)], fill=INK)
    d.line([(9, 9), (12, 12)], fill=STONE_DARK)
    save(image, "sprites", "dash_block.png")


def build_door():
    """Locked door panel, tileable, and the padlock drawn on its middle."""
    image, d = canvas(CELL, CELL)
    box(d, 0, 0, CELL, CELL, WOOD)
    for x in (0, 5, 10):
        box(d, x, 0, 1, CELL, WOOD_DARK)
        box(d, x + 1, 0, 1, CELL, WOOD_LIGHT)
    box(d, 0, 2, CELL, 2, STEEL_DARK)
    box(d, 0, 2, CELL, 1, STEEL)
    box(d, 0, 12, CELL, 2, STEEL_DARK)
    box(d, 0, 12, CELL, 1, STEEL)
    for x in (2, 7, 13):
        dot(d, x, 3, STEEL_LIGHT)
        dot(d, x, 13, STEEL_LIGHT)
    save(image, "sprites", "door.png")

    lock, d = canvas(CELL, CELL)
    d.arc([4, 1, 11, 9], 180, 360, fill=STEEL_LIGHT, width=2)
    box(d, 4, 5, 2, 2, STEEL_LIGHT)
    box(d, 10, 5, 2, 2, STEEL_LIGHT)
    box(d, 3, 7, 10, 8, GOLD)
    box(d, 3, 7, 10, 1, GOLD_LIGHT)
    box(d, 3, 14, 10, 1, GOLD_DARK)
    box(d, 7, 9, 2, 3, INK)
    dot(d, 7, 12, INK)
    save(outline(lock), "sprites", "padlock.png")


def lamp(w, h):
    """Street lamp: thin post with a warm glowing head."""
    image, d = canvas(w, h)
    box(d, 7, 8, 2, h - 9, STEEL_DARK)
    box(d, 7, 8, 1, h - 9, STEEL)
    box(d, 5, h - 3, 6, 3, STEEL_DARK)
    box(d, 5, h - 3, 6, 1, STEEL)
    box(d, 4, 2, 8, 2, STEEL_DARK)
    box(d, 5, 4, 6, 4, WARM)
    box(d, 6, 4, 4, 3, WARM_LIGHT)
    box(d, 4, 8, 8, 1, STEEL_DARK)
    box(d, 4, 1, 8, 1, SNOW)
    return outline(image)


def window(w, h, lit):
    """Building window with a frame, a cross bar and snow on the sill."""
    image, d = canvas(w, h)
    glass = WARM if lit else (40, 48, 86, 255)
    shine = WARM_LIGHT if lit else (70, 84, 130, 255)
    box(d, 3, 3, w - 6, h - 7, WOOD_DARK)
    box(d, 5, 5, w - 10, h - 11, glass)
    box(d, 6, 6, (w - 10) // 2 - 2, 3, shine)
    box(d, w // 2 - 1, 5, 2, h - 11, WOOD_DARK)
    box(d, 5, h // 2 - 2, w - 10, 2, WOOD_DARK)
    if lit:
        box(d, w // 2 + 2, h // 2 + 1, 3, 4, (230, 160, 90, 255))
    box(d, 2, h - 5, w - 4, 2, STONE_LIGHT)
    box(d, 2, h - 6, w - 4, 1, SNOW)
    return outline(image)


def crate(w, h):
    """Wooden crate with cross bracing and a snow cap."""
    image, d = canvas(w, h)
    box(d, 1, 3, 14, 13, WOOD)
    box(d, 1, 3, 14, 2, WOOD_LIGHT)
    box(d, 1, 14, 14, 2, WOOD_DARK)
    box(d, 1, 3, 2, 13, WOOD_LIGHT)
    box(d, 13, 3, 2, 13, WOOD_DARK)
    d.line([(3, 5), (12, 13)], fill=WOOD_DARK, width=2)
    box(d, 1, 2, 14, 2, SNOW)
    return outline(image)


def barrel(w, h):
    """Barrel with iron hoops."""
    image, d = canvas(w, h)
    box(d, 3, 4, 10, 12, WOOD)
    box(d, 2, 6, 12, 8, WOOD)
    box(d, 4, 4, 2, 12, WOOD_LIGHT)
    box(d, 11, 4, 2, 12, WOOD_DARK)
    box(d, 2, 6, 12, 1, STEEL_DARK)
    box(d, 2, 12, 12, 1, STEEL_DARK)
    box(d, 3, 3, 10, 2, SNOW)
    return outline(image)


def sign(w, h):
    """Wooden arrow sign on a post."""
    image, d = canvas(w, h)
    box(d, 7, 6, 2, 10, WOOD_DARK)
    d.polygon([(1, 2), (12, 2), (15, 5), (12, 8), (1, 8)], fill=WOOD)
    box(d, 1, 2, 11, 1, WOOD_LIGHT)
    box(d, 3, 5, 7, 1, WOOD_DARK)
    box(d, 1, 1, 11, 1, SNOW)
    return outline(image)


def bench(w, h):
    """Park bench with snow on the seat."""
    image, d = canvas(w, h)
    box(d, 2, 6, w - 4, 2, WOOD)
    box(d, 2, 3, w - 4, 2, WOOD_LIGHT)
    box(d, 2, 9, w - 4, 2, WOOD)
    box(d, 4, 11, 2, 5, STEEL_DARK)
    box(d, w - 6, 11, 2, 5, STEEL_DARK)
    box(d, 2, 8, w - 4, 1, SNOW)
    return outline(image)


def pipe(w, h):
    """Vertical drain pipe with brackets."""
    image, d = canvas(w, h)
    box(d, 6, 0, 4, h, STEEL)
    box(d, 6, 0, 1, h, STEEL_LIGHT)
    box(d, 9, 0, 1, h, STEEL_DARK)
    for y in range(4, h, 10):
        box(d, 4, y, 8, 2, STEEL_DARK)
    box(d, 3, h - 3, 10, 3, STEEL)
    return outline(image)


def chain(w, h):
    """Hanging chain."""
    image, d = canvas(w, h)
    for y in range(0, h - 1, 4):
        if (y // 4) % 2 == 0:
            box(d, 7, y, 2, 4, STEEL_LIGHT)
            dot(d, 7, y + 1, STEEL_DARK)
        else:
            box(d, 6, y, 4, 3, STEEL)
            box(d, 7, y + 1, 2, 1, (0, 0, 0, 0))
    box(d, 5, h - 4, 6, 3, STEEL_DARK)
    return outline(image)


def banner(w, h):
    """Hanging cloth banner with a mountain emblem."""
    image, d = canvas(w, h)
    box(d, 1, 0, 14, 2, WOOD_DARK)
    d.polygon([(3, 2), (12, 2), (12, h - 3), (8, h - 7), (3, h - 3)], fill=RED)
    box(d, 3, 2, 2, h - 6, (226, 90, 96, 255))
    box(d, 11, 2, 1, h - 6, RED_DARK)
    d.polygon([(5, 14), (8, 9), (11, 14)], fill=SNOW)
    d.polygon([(7, 14), (9, 11), (11, 14)], fill=SNOW_SHADE)
    return outline(image)


def flags(w, h):
    """String of prayer flags."""
    image, d = canvas(w, h)
    colours = [(80, 140, 230, 255), (240, 240, 250, 255), (220, 70, 70, 255), (80, 190, 110, 255), (250, 210, 80, 255)]
    points = [(x, 3 + int(4 * math.sin(math.pi * x / (w - 1)))) for x in range(w)]
    d.line(points, fill=(60, 50, 50, 255))
    for i, x in enumerate(range(3, w - 3, 6)):
        y = points[x][1]
        box(d, x, y + 1, 4, 5, colours[i % len(colours)])
    return image


def bush(w, h):
    """Low snowy bush."""
    image, d = canvas(w, h)
    d.ellipse([1, 6, 14, 16], fill=GREEN_DARK)
    d.ellipse([3, 5, 12, 13], fill=GREEN)
    d.ellipse([2, 4, 13, 9], fill=SNOW)
    box(d, 3, 9, 3, 1, SNOW_SHADE)
    return outline(image)


def pine(w, h):
    """Snow covered pine tree."""
    image, d = canvas(w, h)
    cx = w // 2
    box(d, cx - 2, h - 8, 4, 8, WOOD_DARK)
    for i, (top, half) in enumerate(((2, 5), (12, 9), (22, 13), (31, 15))):
        bottom = top + 12
        d.polygon([(cx, top), (cx + half, bottom), (cx - half, bottom)], fill=GREEN_DARK if i % 2 else GREEN)
        d.polygon([(cx, top), (cx + half // 2, top + 6), (cx - half // 2, top + 6)], fill=SNOW)
        box(d, cx - half + 1, bottom - 1, half * 2 - 1, 1, SNOW_SHADE)
    return outline(image)


def rock(w, h):
    """Snow capped boulder."""
    image, d = canvas(w, h)
    d.polygon([(1, 15), (3, 7), (8, 4), (13, 6), (15, 15)], fill=STONE)
    d.polygon([(8, 4), (13, 6), (15, 15), (10, 15)], fill=STONE_DARK)
    d.polygon([(3, 8), (8, 4), (13, 6), (11, 8), (6, 8)], fill=SNOW)
    return outline(image)


def icicles(w, h):
    """Icicles hanging from a ledge."""
    image, d = canvas(w, h)
    box(d, 0, 0, w, 2, SNOW)
    for x, length in ((1, 7), (4, 11), (7, 5), (10, 9), (13, 6)):
        d.polygon([(x, 2), (x + 2, 2), (x + 1, 2 + length)], fill=(190, 225, 255, 230))
        dot(d, x, 2, (255, 255, 255, 255))
    return image


def memorial(w, h):
    """Stone memorial with an engraved plaque."""
    image, d = canvas(w, h)
    box(d, 2, h - 4, 12, 4, STONE_DARK)
    box(d, 4, 4, 8, h - 8, STONE)
    box(d, 4, 4, 2, h - 8, STONE_LIGHT)
    d.pieslice([4, 0, 11, 8], 180, 360, fill=STONE)
    box(d, 6, 9, 4, 6, (60, 60, 80, 255))
    for y in range(10, 15, 2):
        box(d, 7, y, 2, 1, STONE_LIGHT)
    box(d, 5, 1, 6, 2, SNOW)
    return outline(image)


def billboard(w, h):
    """Weathered billboard with a faded mountain poster."""
    image, d = canvas(w, h)
    box(d, 6, h - 10, 2, 10, STEEL_DARK)
    box(d, w - 8, h - 10, 2, 10, STEEL_DARK)
    box(d, 1, 1, w - 2, h - 10, WOOD_DARK)
    box(d, 3, 3, w - 6, h - 14, (110, 150, 200, 255))
    d.polygon([(6, h - 11), (18, 8), (26, 15), (34, 6), (w - 4, h - 11)], fill=(220, 230, 250, 255))
    d.polygon([(18, 8), (22, 12), (14, 12)], fill=(255, 255, 255, 255))
    box(d, 3, h - 12, w - 6, 1, (140, 90, 70, 255))
    box(d, 8, 5, 10, 2, (230, 90, 80, 255))
    box(d, 1, 0, w - 2, 1, SNOW)
    return outline(image)


def lantern(w, h):
    """Paper lantern hanging from a short cord."""
    image, d = canvas(w, h)
    box(d, 7, 0, 2, 4, (60, 50, 50, 255))
    d.ellipse([3, 4, 12, 14], fill=(230, 90, 60, 255))
    d.ellipse([5, 5, 10, 12], fill=WARM)
    box(d, 6, 6, 2, 4, WARM_LIGHT)
    box(d, 5, 3, 6, 2, WOOD_DARK)
    box(d, 6, 14, 4, 2, WOOD_DARK)
    return outline(image)


def snowman(w, h):
    """Small snowman with a scarf."""
    image, d = canvas(w, h)
    d.ellipse([2, 16, 13, 30], fill=SNOW)
    d.ellipse([4, 7, 11, 17], fill=SNOW)
    d.ellipse([5, 17, 12, 29], fill=SNOW_SHADE)
    box(d, 4, 15, 8, 2, RED)
    box(d, 9, 16, 2, 5, RED_DARK)
    dot(d, 6, 10, INK)
    dot(d, 9, 10, INK)
    box(d, 7, 12, 3, 1, (240, 140, 60, 255))
    box(d, 4, 4, 8, 3, (40, 40, 50, 255))
    box(d, 6, 1, 4, 3, (40, 40, 50, 255))
    return outline(image)


def cairn(w, h):
    """Stack of balanced stones left by climbers."""
    image, d = canvas(w, h)
    for x0, y0, x1, y1, colour in ((2, 12, 14, 16, STONE_DARK), (3, 8, 12, 12, STONE), (5, 5, 10, 8, STONE_LIGHT), (6, 2, 9, 5, STONE)):
        d.ellipse([x0, y0, x1, y1], fill=colour)
    box(d, 6, 2, 3, 1, SNOW)
    return outline(image)


def antenna(w, h):
    """Rooftop radio mast with a blinking light."""
    image, d = canvas(w, h)
    box(d, 7, 4, 2, h - 4, STEEL)
    for y in range(8, h - 2, 6):
        d.line([(4, y + 4), (7, y)], fill=STEEL_DARK)
        d.line([(11, y + 4), (8, y)], fill=STEEL_DARK)
    box(d, 6, 1, 4, 3, (255, 80, 80, 255))
    dot(d, 7, 1, (255, 200, 200, 255))
    box(d, 4, h - 2, 8, 2, STEEL_DARK)
    return outline(image)


def rail(w, h):
    """Metal railing for walkways and balconies."""
    image, d = canvas(w, h)
    box(d, 0, 6, w, 2, STEEL)
    box(d, 0, 6, w, 1, STEEL_LIGHT)
    for x in range(1, w, 6):
        box(d, x, 6, 2, 10, STEEL_DARK)
    box(d, 0, 5, w, 1, SNOW)
    return image


DECOR = [
    ("lamp", 1, 3, lamp),
    ("window", 2, 2, lambda w, h: window(w, h, True)),
    ("windowDark", 2, 2, lambda w, h: window(w, h, False)),
    ("crate", 1, 1, crate),
    ("barrel", 1, 1, barrel),
    ("sign", 1, 1, sign),
    ("bench", 2, 1, bench),
    ("pipe", 1, 3, pipe),
    ("chain", 1, 2, chain),
    ("banner", 1, 2, banner),
    ("flags", 4, 1, flags),
    ("bush", 1, 1, bush),
    ("pine", 2, 3, pine),
    ("rock", 1, 1, rock),
    ("icicles", 1, 1, icicles),
    ("memorial", 1, 2, memorial),
    ("billboard", 3, 2, billboard),
    ("lantern", 1, 1, lantern),
    ("snowman", 1, 2, snowman),
    ("cairn", 1, 1, cairn),
    ("antenna", 1, 3, antenna),
    ("rail", 2, 1, rail),
]


def build_decor():
    """Pack every decoration into one sheet, one per 16 pixel aligned slot, left to right."""
    width = sum(w for _, w, _, _ in DECOR) * CELL
    height = max(h for _, _, h, _ in DECOR) * CELL
    sheet = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    x = 0
    layout = []
    for name, w, h, draw in DECOR:
        sheet.paste(draw(w * CELL, h * CELL), (x, 0))
        layout.append(f"{name}: [{x * SCALE}, {w}, {h}]")
        x += w * CELL
    save(sheet, "sprites", "decor.png")
    print("decor layout (x, cells wide, cells tall):")
    print(",\n".join(layout))


def skyline(width, height, seed, body, window_on, window_off, lit_ratio, min_h, max_h, roof_snow):
    """Tileable row of building silhouettes with lit and dark windows."""
    rng = random.Random(seed)
    image, d = canvas(width, height)
    x = 0
    while x < width:
        w = rng.randint(18, 42)
        h = rng.randint(min_h, max_h)
        top = height - h
        right = min(width, x + w)
        box(d, x, top, right - x, h, body)
        if rng.random() < 0.35:
            box(d, x + w // 3, top - 8, 2, 8, body)
        if rng.random() < 0.3:
            box(d, x + 3, top - 4, w // 2, 4, body)
        box(d, x, top, right - x, 1, roof_snow)
        for wy in range(top + 4, height - 4, 6):
            for wx in range(x + 3, right - 3, 5):
                colour = window_on if rng.random() < lit_ratio else window_off
                box(d, wx, wy, 2, 3, colour)
        x += w + rng.randint(0, 4)
    return image


def build_city_skyline():
    """Two tileable skyline layers for the Forsaken City backdrop."""
    far = skyline(480, 120, 3, (44, 40, 92, 255), (150, 130, 190, 255), (54, 50, 104, 255), 0.18, 30, 100, (90, 90, 150, 255))
    near = skyline(480, 90, 11, (26, 22, 56, 255), (255, 206, 120, 255), (36, 32, 72, 255), 0.22, 26, 80, (150, 160, 210, 255))
    save(far, "parallax", "city_far.png", scale=1)
    save(near, "parallax", "city_near.png", scale=1)


def build_background_tiles():
    """Darker, bluer copies of every autotile strip used for walls behind the player."""
    for name in ("snow", "dirt", "ice", "girder", "brick", "resort"):
        strip = Image.open(os.path.join(OUT, "tiles", f"auto_{name}.png")).convert("RGBA")
        px = strip.load()
        for y in range(strip.height):
            for x in range(strip.width):
                r, g, b, a = px[x, y]
                if not a:
                    continue
                light = (r + g + b) / 3
                px[x, y] = (int(r * 0.34 + light * 0.06 + 10), int(g * 0.34 + light * 0.06 + 10), int(b * 0.42 + light * 0.08 + 24), a)
        save(strip, "tiles", f"bg_{name}.png", scale=1)


if __name__ == "__main__":
    build_spring()
    build_touch_switch()
    build_gate()
    build_dash_block()
    build_door()
    build_decor()
    build_city_skyline()
    build_background_tiles()
