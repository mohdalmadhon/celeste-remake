"""Build derived game assets from the original asset folders.

Run from the project root:

    python3 tools/build_assets.py [group ...]

Groups: sheets, player, tiles, resort, parallax, ui, extract.
Without arguments every group is built. All outputs are written under
assets/generated so the original assets stay untouched.
"""

import glob
import io
import math
import os
import random
import re
import sys
import zipfile

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ASSETS, "generated")


def out_path(*parts):
    """Return a path inside the generated folder, creating parent folders."""
    path = os.path.join(OUT, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def frame_files(folder):
    """Return the numbered frame files of an animation folder in order."""
    files = glob.glob(os.path.join(folder, "f*.png"))
    return sorted(files, key=lambda p: int(re.findall(r"f(\d+)\.png$", p)[0]))


def build_sheet(base, rows, cell, name):
    """Pack animation folders into a single row-per-animation sprite sheet.

    Returns a mapping of animation name to its row index and frame count so
    the JavaScript side can be kept in sync.
    """
    frames = []
    for anim in rows:
        frames.append([Image.open(f).convert("RGBA") for f in frame_files(os.path.join(base, anim))])
    columns = max(len(f) for f in frames)
    sheet = Image.new("RGBA", (columns * cell, len(rows) * cell), (0, 0, 0, 0))
    meta = {}
    for row, (anim, images) in enumerate(zip(rows, frames)):
        for col, image in enumerate(images):
            ox = (cell - image.width) // 2
            oy = (cell - image.height) // 2
            sheet.alpha_composite(image, (col * cell + ox, row * cell + oy))
        meta[anim] = (row, len(images))
    sheet.save(out_path("sprites", name))
    print(name, sheet.size, meta)
    return meta


def build_sheets():
    """Build sprite sheets for Oshiro, collectables and hazards."""
    boss = os.path.join(ASSETS, "characters/Oshiro/Animations/oshiro_boss")
    build_sheet(boss, ["idle", "charge", "dash", "hurt", "respawn", "transformFinish"], 96, "oshiro_boss.png")
    hotel = os.path.join(ASSETS, "characters/Oshiro/Animations/oshiro")
    build_sheet(hotel, ["idle", "move", "sweeping", "side", "fall", "recover", "appear"], 96, "oshiro.png")
    berry = os.path.join(ASSETS, "items/strawberry__and_score/Animations/strawberry")
    build_sheet(berry, ["idle", "collect", "flap"], 32, "strawberry.png")
    ghost = os.path.join(ASSETS, "items/strawberry__and_score/Animations/ghostberry")
    build_sheet(ghost, ["idle", "collect"], 32, "ghostberry.png")
    booster = os.path.join(ASSETS, "items/bubble/Animations/booster")
    build_sheet(booster, ["loop", "inside", "pop", "spin"], 32, "booster.png")
    key = os.path.join(ASSETS, "items/keys/Animations/key")
    build_sheet(key, ["idle", "enter"], 32, "key.png")
    seeker = os.path.join(ASSETS, "characters/seeker/Animations/seeker")
    build_sheet(seeker, ["idle", "spotted", "attacking", "stunned"], 64, "seeker.png")
    with zipfile.ZipFile(os.path.join(ASSETS, "tiles/celeste/snow_balls.zip")) as archive:
        names = sorted(
            [n for n in archive.namelist() if re.search(r"Raw/danger/snowball\d+\.png$", n)],
            key=lambda n: int(re.findall(r"(\d+)\.png$", n)[0]),
        )
        images = [Image.open(io.BytesIO(archive.read(n))).convert("RGBA") for n in names]
    cell = max(max(i.width, i.height) for i in images)
    sheet = Image.new("RGBA", (cell * len(images), cell), (0, 0, 0, 0))
    for index, image in enumerate(images):
        sheet.alpha_composite(image, (index * cell + (cell - image.width) // 2, (cell - image.height) // 2))
    sheet.save(out_path("sprites", "snowball.png"))
    print("snowball.png", sheet.size, len(images))


def is_hair(r, g, b):
    """Return True when a colour belongs to Madeline's red hair palette."""
    return r > 90 and r > g * 1.7 and r > b * 1.6 and g < 110


def build_player():
    """Create recoloured copies of the Madeline sheet.

    player_blue.png has blue hair for the state where the dash is spent,
    player_white.png is a flat white silhouette used for refill flashes,
    player_badeline.png is the purple variant used for echoes.
    """
    sheet = Image.open(os.path.join(ASSETS, "player3.png")).convert("RGBA")
    blue = sheet.copy()
    white = sheet.copy()
    pixels = sheet.load()
    blue_px = blue.load()
    white_px = white.load()
    for y in range(sheet.height):
        for x in range(sheet.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            white_px[x, y] = (255, 255, 255, a)
            if y < 64 * 12 and is_hair(r, g, b):
                light = (r + g + b) / 3
                blue_px[x, y] = (int(40 + light * 0.25), int(90 + light * 0.55), int(150 + light * 0.8), a)
    blue.save(out_path("sprites", "player_blue.png"))
    white.save(out_path("sprites", "player_white.png"))
    echo = sheet.copy()
    echo_px = echo.load()
    for y in range(sheet.height):
        for x in range(sheet.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            light = (r * 0.3 + g * 0.5 + b * 0.2)
            echo_px[x, y] = (int(150 + light * 0.4), int(200 + light * 0.2), 255, int(a * 0.85))
    echo.save(out_path("sprites", "player_echo.png"))
    print("player variants", sheet.size)


MATERIALS = {
    "dirt": {
        "center": "dirtPlain", "top": "dirt", "bottom": "dirtDown",
        "tl": "dirtEdgeLeft", "tr": "dirtEdgeRight",
        "bl": "dirtEdgeBottomLeft", "br": "dirtEdgeBottomRight",
        "sides": ["dirtFlippedLeft", "dirtFlippedRight"],
    },
    "snow": {
        "center": "snowPlain", "top": "snow", "bottom": "snowDown",
        "tl": "snowEdgeLeft", "tr": "snowEdgeRight",
        "bl": "snowEdgeBottomLeft", "br": "snowEdgeBottomRight",
        "sides": ["snowFlipped", "snowFlippedLeft"],
    },
    "ice": {
        "center": "blueIcePlain", "top": "blueIce", "bottom": "blueIceDown",
        "tl": "blueIceEdgeLeft", "tr": "blueIceEdgeRight",
        "bl": "blueIceEdgeLeftBottom", "br": "blueIceEdgeRightBototm",
        "sides": ["blueIceFlippedLeft", "blueIceFlippedRight"],
    },
}


def tile(name):
    """Load one of the original 16x16 tiles."""
    return Image.open(os.path.join(ASSETS, "tiles/celeste", name + ".png")).convert("RGBA")


def side_brightness(image, side):
    """Average brightness of a 3 pixel strip on one side of a tile."""
    w, h = image.size
    boxes = {"left": (0, 4, 3, h - 4), "right": (w - 3, 4, w, h - 4)}
    strip = image.crop(boxes[side]).convert("L")
    data = list(strip.get_flattened_data()) if hasattr(strip, "get_flattened_data") else list(strip.getdata())
    return sum(data) / len(data)


def build_autotiles(name, spec):
    """Compose a 16 variant autotile strip from quadrants of the source tiles.

    Variant index bits: 1 top, 2 right, 4 bottom, 8 left exposed.
    """
    center = tile(spec["center"])
    top = tile(spec["top"])
    bottom = tile(spec["bottom"])
    a, b = (tile(s) for s in spec["sides"])
    base = side_brightness(center, "left")
    a_left = abs(side_brightness(a, "left") - base)
    a_right = abs(side_brightness(a, "right") - base)
    left_open, right_open = (a, b) if a_left > a_right else (b, a)
    corner = {k: tile(spec[k]) for k in ("tl", "tr", "bl", "br")}
    strip = Image.new("RGBA", (16 * 16, 16), (0, 0, 0, 0))
    for mask in range(16):
        t, r, bo, l = bool(mask & 1), bool(mask & 2), bool(mask & 4), bool(mask & 8)
        out = Image.new("RGBA", (16, 16))
        quads = {
            "tl": ((0, 0, 8, 8), corner["tl"] if t and l else top if t else left_open if l else center),
            "tr": ((8, 0, 16, 8), corner["tr"] if t and r else top if t else right_open if r else center),
            "bl": ((0, 8, 8, 16), corner["bl"] if bo and l else bottom if bo else left_open if l else center),
            "br": ((8, 8, 16, 16), corner["br"] if bo and r else bottom if bo else right_open if r else center),
        }
        for box, source in quads.values():
            out.paste(source.crop(box), box[:2])
        strip.paste(out, (mask * 16, 0))
    strip.save(out_path("tiles", f"auto_{name}.png"))
    print("autotile", name)


def build_tiles():
    """Build the autotile strips for every original material."""
    for name, spec in MATERIALS.items():
        build_autotiles(name, spec)


def noise_rng(seed):
    """Deterministic random generator so rebuilds are stable."""
    return random.Random(seed)


def build_resort():
    """Draw the Celestial Resort material in the original 16 pixel style.

    The hotel chase needs wooden floors and wallpapered walls that the
    original asset pack does not include, so they are drawn here with a
    restricted palette that matches the existing tiles.
    """
    rng = noise_rng(3)
    wood = [(58, 33, 41), (82, 46, 52), (108, 62, 61), (139, 86, 72)]
    trim = [(196, 140, 92), (231, 186, 120)]
    center = Image.new("RGBA", (16, 16), wood[1])
    px = center.load()
    for y in range(16):
        plank = y // 4
        for x in range(16):
            shade = wood[1] if (x + plank * 5) % 16 else wood[0]
            if y % 4 == 3:
                shade = wood[0]
            elif rng.random() < 0.08:
                shade = wood[2]
            px[x, y] = shade
    top = center.copy()
    tp = top.load()
    for x in range(16):
        tp[x, 0] = trim[1]
        tp[x, 1] = trim[0]
        tp[x, 2] = wood[3]
        tp[x, 3] = wood[0]
    bottom = center.copy()
    bp = bottom.load()
    for x in range(16):
        bp[x, 15] = wood[0]
        bp[x, 14] = wood[2]
    left = center.copy()
    lp = left.load()
    for y in range(16):
        lp[0, y] = trim[0]
        lp[1, y] = wood[3]
        lp[2, y] = wood[0]
    right = left.transpose(Image.FLIP_LEFT_RIGHT)

    def corner(h, v):
        image = center.copy()
        image.paste(h.crop((0, 0, 16, 16)), (0, 0))
        mask = Image.new("L", (16, 16), 0)
        draw = ImageDraw.Draw(mask)
        if v is left:
            draw.rectangle((0, 0, 3, 15), fill=255)
        else:
            draw.rectangle((12, 0, 15, 15), fill=255)
        image.paste(v, (0, 0), mask)
        return image

    spec_images = {
        "center": center, "top": top, "bottom": bottom,
        "tl": corner(top, left), "tr": corner(top, right),
        "bl": corner(bottom, left), "br": corner(bottom, right),
        "left": left, "right": right,
    }
    strip = Image.new("RGBA", (256, 16))
    for mask in range(16):
        t, r, bo, l = bool(mask & 1), bool(mask & 2), bool(mask & 4), bool(mask & 8)
        out = Image.new("RGBA", (16, 16))
        quads = [
            ((0, 0, 8, 8), "tl" if t and l else "top" if t else "left" if l else "center"),
            ((8, 0, 16, 8), "tr" if t and r else "top" if t else "right" if r else "center"),
            ((0, 8, 8, 16), "bl" if bo and l else "bottom" if bo else "left" if l else "center"),
            ((8, 8, 16, 16), "br" if bo and r else "bottom" if bo else "right" if r else "center"),
        ]
        for box, key in quads:
            out.paste(spec_images[key].crop(box), box[:2])
        strip.paste(out, (mask * 16, 0))
    strip.save(out_path("tiles", "auto_resort.png"))

    wall = Image.new("RGBA", (32, 32), (52, 36, 66))
    wp = wall.load()
    for y in range(32):
        for x in range(32):
            if (x // 4) % 2 == 0:
                wp[x, y] = (60, 41, 76)
            if (x + y) % 16 == 0 and (x // 4) % 2 == 0:
                wp[x, y] = (88, 61, 104)
    draw = ImageDraw.Draw(wall)
    draw.line((0, 30, 31, 30), fill=(40, 26, 50))
    draw.line((0, 31, 31, 31), fill=(30, 20, 38))
    wall.save(out_path("tiles", "resort_wall.png"))

    door = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(door)
    draw.rectangle((0, 0, 15, 31), fill=trim[0])
    draw.rectangle((2, 2, 13, 31), fill=wood[2])
    draw.rectangle((4, 4, 11, 13), outline=wood[3])
    draw.rectangle((4, 17, 11, 28), outline=wood[3])
    draw.point((12, 18), fill=trim[1])
    door.save(out_path("tiles", "resort_door.png"))

    debris = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(debris)
    draw.polygon([(2, 4), (9, 1), (14, 6), (12, 13), (5, 14), (1, 9)], fill=wood[2], outline=wood[0])
    draw.line((5, 6, 10, 10), fill=wood[3])
    debris.save(out_path("tiles", "resort_debris.png"))

    crumble = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(crumble)
    draw.rectangle((0, 0, 15, 15), fill=wood[2], outline=wood[0])
    draw.line((0, 4, 15, 4), fill=trim[0])
    draw.line((4, 8, 9, 13), fill=wood[0])
    draw.line((9, 6, 12, 10), fill=wood[0])
    crumble.save(out_path("tiles", "resort_crumble.png"))

    dust = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    dp = dust.load()
    for y in range(16):
        for x in range(16):
            d = math.hypot(x - 7.5, y - 7.5)
            if d < 6.5 + rng.random() * 1.5:
                dp[x, y] = (24, 14, 30, 255)
    draw = ImageDraw.Draw(dust)
    draw.rectangle((5, 6, 6, 8), fill=(255, 84, 84))
    draw.rectangle((9, 6, 10, 8), fill=(255, 84, 84))
    dust.save(out_path("sprites", "dust_bunny.png"))

    lamp = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(lamp)
    draw.line((7, 0, 7, 12), fill=(30, 20, 38))
    draw.line((8, 0, 8, 12), fill=(30, 20, 38))
    draw.polygon([(3, 13), (12, 13), (14, 19), (1, 19)], fill=(231, 186, 120), outline=(108, 62, 61))
    draw.rectangle((6, 19, 9, 21), fill=(255, 240, 190))
    lamp.save(out_path("tiles", "resort_lamp.png"))
    print("resort material")


def lerp(a, b, t):
    """Linear interpolation of two colour tuples."""
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def ridge(width, height, seed, base, rough, peaks):
    """Return a list of heights describing a jagged mountain silhouette."""
    rng = noise_rng(seed)
    points = []
    anchors = [(0, base)]
    step = width // peaks
    for i in range(1, peaks + 1):
        anchors.append((i * step, base - rng.randint(rough // 2, rough)))
        anchors.append((i * step + step // 2, base - rng.randint(0, rough // 3)))
    anchors.append((width, anchors[0][1]))
    anchors.sort()
    for x in range(width):
        for j in range(len(anchors) - 1):
            x0, y0 = anchors[j]
            x1, y1 = anchors[j + 1]
            if x0 <= x <= x1:
                t = (x - x0) / max(1, x1 - x0)
                points.append(int(y0 + (y1 - y0) * t + rng.randint(-1, 1)))
                break
        else:
            points.append(base)
    return points


def build_mountain_layer(name, width, height, seed, base, rough, peaks, color, snow):
    """Draw a tileable pixel mountain silhouette layer at low resolution."""
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    px = image.load()
    heights = ridge(width, height, seed, base, rough, peaks)
    heights[-1] = heights[0]
    for x, top in enumerate(heights):
        for y in range(max(0, top), height):
            depth = (y - top) / max(1, height - top)
            px[x, y] = lerp(color, tuple(max(0, c - 25) for c in color), depth) + (255,)
            if snow and y - top < 2 + (x * 7 % 3):
                px[x, y] = snow + (255,)
    image.save(out_path("parallax", name))


def build_parallax():
    """Create layered parallax backgrounds for every chapter theme."""
    build_mountain_layer("mountains_far.png", 480, 200, 11, 120, 70, 5, (52, 66, 112), (150, 170, 220))
    build_mountain_layer("mountains_mid.png", 480, 200, 23, 150, 60, 7, (34, 46, 82), (110, 130, 190))
    build_mountain_layer("hills_near.png", 480, 200, 37, 175, 30, 9, (20, 28, 52), None)

    sky = Image.new("RGBA", (4, 200))
    for y in range(200):
        sky.putpixel((0, y), lerp((14, 18, 46), (70, 64, 120), y / 199) + (255,))
    sky = sky.resize((4, 200))
    for x in range(1, 4):
        for y in range(200):
            sky.putpixel((x, y), sky.getpixel((0, y)))
    sky.save(out_path("parallax", "sky_night.png"))

    rng = noise_rng(5)
    stars = Image.new("RGBA", (480, 200), (0, 0, 0, 0))
    for _ in range(140):
        x, y = rng.randrange(480), rng.randrange(200)
        stars.putpixel((x, y), (255, 255, 255, rng.randint(90, 255)))
    stars.save(out_path("parallax", "stars.png"))

    fog = Image.new("RGBA", (480, 120), (0, 0, 0, 0))
    draw = ImageDraw.Draw(fog)
    for _ in range(26):
        x = rng.randrange(-40, 480)
        y = rng.randrange(30, 100)
        w = rng.randrange(60, 160)
        draw.ellipse((x, y, x + w, y + w // 4), fill=(200, 215, 255, 26))
    fog = fog.filter(ImageFilter.GaussianBlur(3))
    fog.save(out_path("parallax", "fog.png"))

    aurora = Image.new("RGBA", (480, 200), (0, 0, 0, 0))
    ap = aurora.load()
    for x in range(480):
        center = 60 + 25 * math.sin(x / 40) + 10 * math.sin(x / 13)
        for y in range(200):
            d = abs(y - center)
            if d < 30:
                a = int(70 * (1 - d / 30) * (0.6 + 0.4 * math.sin(x / 9)))
                ap[x, y] = (110, 255, 200, max(0, a)) if (x // 2 + y // 3) % 2 == 0 else (140, 180, 255, max(0, a))
    aurora.save(out_path("parallax", "aurora.png"))

    hotel = Image.new("RGBA", (480, 200), (0, 0, 0, 0))
    draw = ImageDraw.Draw(hotel)
    draw.rectangle((90, 40, 390, 200), fill=(36, 24, 48))
    for tower in (60, 410):
        draw.rectangle((tower, 70, tower + 40, 200), fill=(32, 22, 44))
        draw.polygon([(tower - 6, 70), (tower + 20, 40), (tower + 46, 70)], fill=(44, 28, 58))
    draw.polygon([(80, 40), (240, 8), (400, 40)], fill=(44, 28, 58))
    for row in range(5):
        for col in range(10):
            x = 104 + col * 28
            y = 58 + row * 26
            lit = rng.random() < 0.45
            draw.rectangle((x, y, x + 10, y + 14), fill=(255, 196, 110) if lit else (60, 44, 80))
    hotel.save(out_path("parallax", "resort_far.png"))
    print("parallax layers")


def build_ui():
    """Draw the pixel cursor, UI icons and a crisp mountain logo."""
    cursor = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    shape = [
        "X...............",
        "XX..............",
        "XWX.............",
        "XWWX............",
        "XWWWX...........",
        "XWWWWX..........",
        "XWWWWWX.........",
        "XWWWWWWX........",
        "XWWWWWWWX.......",
        "XWWWWWXXXX......",
        "XWWXWWX.........",
        "XWX.XWWX........",
        "XX..XWWX........",
        ".....XWWX.......",
        ".....XWWX.......",
        "......XX........",
    ]
    for y, line in enumerate(shape):
        for x, ch in enumerate(line):
            if ch == "X":
                cursor.putpixel((x, y), (24, 16, 38, 255))
            elif ch == "W":
                cursor.putpixel((x, y), (236, 244, 255, 255) if y < 9 else (170, 214, 255, 255))
    cursor.resize((32, 32), Image.NEAREST).save(out_path("ui", "cursor.png"))
    pointer = cursor.copy()
    pp = pointer.load()
    for y in range(16):
        for x in range(16):
            if pp[x, y][3] and pp[x, y][0] > 150:
                pp[x, y] = (255, 120, 150, 255) if y > 8 else (255, 190, 210, 255)
    pointer.resize((32, 32), Image.NEAREST).save(out_path("ui", "cursor_pointer.png"))

    logo = Image.new("RGBA", (48, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(logo)
    draw.polygon([(15, 3), (27, 29), (3, 29)], fill=(223, 243, 255))
    draw.polygon([(15, 3), (27, 29), (20, 29), (12, 14)], fill=(174, 224, 255))
    draw.polygon([(31, 11), (46, 29), (16, 29)], fill=(234, 251, 255))
    draw.polygon([(31, 11), (46, 29), (31, 29)], fill=(143, 210, 244))
    draw.polygon([(15, 3), (18, 9), (12, 9)], fill=(255, 255, 255))
    logo.resize((192, 128), Image.NEAREST).save(out_path("ui", "logo.png"))

    flag = Image.new("RGBA", (16, 24), (0, 0, 0, 0))
    draw = ImageDraw.Draw(flag)
    draw.line((3, 2, 3, 23), fill=(110, 80, 60))
    draw.line((4, 2, 4, 23), fill=(80, 56, 44))
    draw.polygon([(5, 2), (15, 5), (5, 9)], fill=(94, 227, 122))
    flag.save(out_path("ui", "checkpoint_flag.png"))
    flag_off = flag.copy()
    fp = flag_off.load()
    for y in range(24):
        for x in range(16):
            r, g, b, a = fp[x, y]
            if a and g > 200:
                fp[x, y] = (120, 130, 150, a)
    flag_off.save(out_path("ui", "checkpoint_flag_off.png"))

    crystal = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    draw = ImageDraw.Draw(crystal)
    draw.polygon([(8, 1), (14, 8), (8, 15), (2, 8)], fill=(80, 220, 120), outline=(20, 90, 50))
    draw.polygon([(8, 3), (11, 8), (8, 8)], fill=(200, 255, 210))
    crystal.save(out_path("sprites", "dash_crystal.png"))
    print("ui assets")


def build_extract():
    """Extract the checkpoint artwork used by the chapter select screen."""
    wanted = {
        "1 - Forsaken City 1 - Start.png": "forsaken_city.png",
        "1 - Forsaken City 2 - Crossing.png": "forsaken_city_2.png",
        "3 - Celestial Resort 2 - Huge Mess.png": "resort.png",
        "3 - Celestial Resort 3 - Elevator Shaft.png": "resort_2.png",
        "7 - The Summit 6 - 2500 M.png": "summit.png",
        "7 - The Summit 7 - 3000 M.png": "summit_2.png",
        "4 - Golden Ridge 1 - Start.png": "prologue.png",
    }
    with zipfile.ZipFile(os.path.join(ASSETS, "tiles/celeste/checkpoints.zip")) as archive:
        for name in archive.namelist():
            base = name.split("/")[-1]
            if base in wanted:
                with open(out_path("checkpoints", wanted[base]), "wb") as handle:
                    handle.write(archive.read(name))
    print("checkpoint images")


def build_fonts():
    """Report the vendored font files so missing fonts are noticed early."""
    fonts = glob.glob(os.path.join(ASSETS, "fonts", "*.woff2"))
    print("fonts", len(fonts))


GROUPS = {
    "sheets": build_sheets,
    "player": build_player,
    "tiles": build_tiles,
    "resort": build_resort,
    "parallax": build_parallax,
    "ui": build_ui,
    "extract": build_extract,
    "fonts": build_fonts,
}


if __name__ == "__main__":
    selected = sys.argv[1:] or list(GROUPS)
    for group in selected:
        GROUPS[group]()
