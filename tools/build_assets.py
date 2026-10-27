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


PLAYER_SHIFTS = {
    **{(3, column): 6 for column in range(8)},
    **{(14, column): 9 for column in range(8)},
    **{(7, column): 3 for column in range(10, 15)},
    **{(8, column): 3 for column in range(7)},
    (4, 7): 3,
    (6, 9): -3,
}


def clean_player_sheet(sheet):
    """Return a copy of the Madeline sheet that animates without popping.

    Some clips were drawn a few art pixels left or right of the others, so the
    character jumped sideways whenever such a clip started. Those cells are
    shifted onto the shared anchor, and faint pixels bleeding in from the row
    below are removed from the bottom of every cell.
    """
    frame = 64
    result = Image.new("RGBA", sheet.size, (0, 0, 0, 0))
    columns = sheet.width // frame
    rows = (sheet.height + frame - 1) // frame
    for row in range(rows):
        for column in range(columns):
            box = (column * frame, row * frame, (column + 1) * frame, min(sheet.height, (row + 1) * frame))
            cell = sheet.crop(box)
            if row < 15:
                cell_px = cell.load()
                for y in range(61, cell.height):
                    for x in range(cell.width):
                        if cell_px[x, y][3] < 40:
                            cell_px[x, y] = (0, 0, 0, 0)
            shift = PLAYER_SHIFTS.get((row, column), 0)
            if shift:
                bounds = cell.getbbox()
                if bounds and (bounds[0] + shift < 0 or bounds[2] + shift > frame):
                    raise ValueError(f"shift for cell {row},{column} would clip the frame")
            result.paste(cell, (box[0] + shift, box[1]), cell)
    return result


IDLE_BASE = (8, 0)
IDLE_CELLS = (11, 12, 13)


def add_idle_frames(sheet):
    """Draw Madeline's breathing idle into free cells of row 11.

    The standing pose from the talk row is copied three times: as is, with
    the head and hair one pixel lower, and two pixels lower, so the loop
    reads as slow breathing instead of the old fidget.
    """
    frame = 64
    base = sheet.crop((IDLE_BASE[1] * frame, IDLE_BASE[0] * frame, (IDLE_BASE[1] + 1) * frame, (IDLE_BASE[0] + 1) * frame))
    split = 36
    for drop, column in zip((0, 1, 2), IDLE_CELLS):
        cell = Image.new("RGBA", (frame, frame), (0, 0, 0, 0))
        body = base.crop((0, split, frame, frame))
        head = base.crop((0, 0, frame, split))
        cell.paste(body, (0, split), body)
        cell.paste(head, (0, drop), head)
        sheet.paste(cell, (column * frame, 11 * frame))
    return sheet


def build_player():
    """Create recoloured copies of the Madeline sheet.

    player_red.png is the cleaned and aligned original every variant starts from,
    player_blue.png has blue hair for the state where the dash is spent,
    player_white.png is a flat white silhouette used for refill flashes,
    player_badeline.png is the purple variant used for echoes.
    """
    sheet = add_idle_frames(clean_player_sheet(Image.open(os.path.join(ASSETS, "player3.png")).convert("RGBA")))
    sheet.save(out_path("sprites", "player_red.png"))
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
    pink = sheet.copy()
    pink_px = pink.load()
    for y in range(64 * 12):
        for x in range(sheet.width):
            r, g, b, a = pixels[x, y]
            if a and is_hair(r, g, b):
                light = (r + g + b) / 3
                pink_px[x, y] = (min(255, int(170 + light * 0.6)), int(60 + light * 0.45), min(255, int(150 + light * 0.7)), a)
    pink.save(out_path("sprites", "player_pink.png"))
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
    for name, colour in (("player_trail_red.png", (172, 50, 50)), ("player_trail_blue.png", (68, 183, 255)), ("player_trail_pink.png", (255, 109, 239))):
        trail = Image.new("RGBA", sheet.size, (0, 0, 0, 0))
        trail_px = trail.load()
        for y in range(sheet.height):
            for x in range(sheet.width):
                if pixels[x, y][3]:
                    trail_px[x, y] = colour + (255,)
        trail.save(out_path("sprites", name))
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
    build_girder_autotiles()
    build_brick_autotiles()


def build_girder_autotiles():
    """Build the steel girder strip from the framed lattice tile.

    The light outer frame is only drawn on exposed sides, so neighbouring
    girder cells read as one continuous scaffold.
    """
    source = tile("IronBarOne")
    inner = source.getpixel((1, 1))
    strip = Image.new("RGBA", (16 * 16, 16), (0, 0, 0, 0))
    for mask in range(16):
        out = source.copy()
        px = out.load()
        for i in range(16):
            if not mask & 1:
                px[i, 0] = inner
            if not mask & 2:
                px[15, i] = inner
            if not mask & 4:
                px[i, 15] = inner
            if not mask & 8:
                px[0, i] = inner
        strip.paste(out, (mask * 16, 0))
    strip.save(out_path("tiles", "auto_girder.png"))
    print("autotile girder")


def build_brick_autotiles():
    """Build the grey stone beam strip in the palette of the original beams.

    Two staggered courses of bricks fill each cell, exposed tops get the light
    capstone band of the original art and exposed sides a dark outline.
    """
    source = tile_any("break")
    light = source.getpixel((20, 6))
    face = source.getpixel((8, 18))
    shade = source.getpixel((30, 21))
    mortar = source.getpixel((12, 13))
    outline = (14, 24, 31, 255)
    base = Image.new("RGBA", (16, 16), face)
    px = base.load()
    for y in range(16):
        course = y // 8
        for x in range(16):
            if y % 8 == 7 or (x + course * 8) % 16 == 15:
                px[x, y] = mortar
            elif y % 8 == 6:
                px[x, y] = shade
    strip = Image.new("RGBA", (16 * 16, 16), (0, 0, 0, 0))
    for mask in range(16):
        out = base.copy()
        op = out.load()
        if mask & 1:
            for x in range(16):
                op[x, 0] = outline
                op[x, 1] = light
                op[x, 2] = light
                op[x, 3] = mortar
        if mask & 4:
            for x in range(16):
                op[x, 15] = outline
        if mask & 8:
            for y in range(16):
                op[0, y] = outline
        if mask & 2:
            for y in range(16):
                op[15, y] = outline
        strip.paste(out, (mask * 16, 0))
    strip.save(out_path("tiles", "auto_brick.png"))
    print("autotile brick")


def tile_any(name):
    """Load an original tile image of any size."""
    return Image.open(os.path.join(ASSETS, "tiles/celeste", name + ".png")).convert("RGBA")


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


def ridge(width, seed, base, rough, roughness=0.55):
    """Return a tileable list of heights made with midpoint displacement."""
    rng = noise_rng(seed)
    size = 1
    while size < width:
        size *= 2
    heights = [0.0] * (size + 1)
    heights[0] = heights[size] = base
    step = size
    amplitude = rough
    while step > 1:
        half = step // 2
        if step == size:
            amplitude *= 1
        for x in range(half, size, step):
            heights[x] = (heights[x - half] + heights[x + half]) / 2 + rng.uniform(-amplitude, amplitude)
        amplitude *= roughness
        step = half
    return [int(heights[int(x * size / width)]) for x in range(width)]


def build_mountain_layer(name, width, height, seed, base, rough, colour, snow, light):
    """Draw a tileable pixel mountain layer with lit slopes and snow caps.

    The image is cropped to its painted rows to keep the composited layer
    small; the crop offset is returned so the theme can position it.
    """
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    px = image.load()
    heights = ridge(width, seed, base, rough)
    peak = min(heights)
    shade = tuple(max(0, c - 22) for c in colour)
    lit = tuple(min(255, c + light) for c in colour)
    for x, top in enumerate(heights):
        top = max(0, top)
        slope = sum(heights[(x + d) % width] for d in range(1, 7)) - sum(heights[x - d] for d in range(1, 7))
        for y in range(top, height):
            depth = (y - top) / max(1, height - top)
            base_colour = lit if slope > 0 and depth < 0.6 else colour
            pixel = lerp(base_colour, shade, depth)
            if snow and y - top < 3 + (top - peak < (base - peak) * 0.45) * 5 and ((x + y) % 2 == 0 or y - top < 2):
                pixel = snow if slope > 0 else lerp(snow, colour, 0.35)
            px[x, y] = pixel + (255,)
    crop_top = max(0, min(heights) - 2)
    image.crop((0, crop_top, width, height)).save(out_path("parallax", name))
    return crop_top


def build_parallax():
    """Create layered parallax backgrounds for every chapter theme."""
    offsets = {
        "mountains_far": build_mountain_layer("mountains_far.png", 480, 200, 11, 140, 130, (52, 66, 112), (176, 194, 236), 14),
        "mountains_mid": build_mountain_layer("mountains_mid.png", 480, 200, 23, 160, 100, (34, 46, 82), (124, 146, 204), 12),
        "hills_near": build_mountain_layer("hills_near.png", 480, 200, 37, 176, 40, (20, 28, 52), None, 8),
    }
    print("parallax crop offsets", offsets)

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
    fog = fog.crop(fog.getbbox() or (0, 0, 480, 120))
    fog.save(out_path("parallax", "fog.png"))
    print("fog size", fog.size)

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


def build_favicon():
    """Make the browser tab icon from the first strawberry frame."""
    sheet = Image.open(out_path("sprites", "strawberry.png")).convert("RGBA")
    frame = sheet.crop((0, 0, 32, 32))
    icon = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    bounds = frame.getbbox()
    berry = frame.crop(bounds)
    scale = 60 // max(berry.size)
    berry = berry.resize((berry.width * scale, berry.height * scale), Image.NEAREST)
    icon.paste(berry, ((64 - berry.width) // 2, (64 - berry.height) // 2), berry)
    icon.save(out_path("ui", "favicon.png"))
    print("favicon")


def build_ui():
    """Draw the pixel cursor, UI icons and a crisp mountain logo."""
    build_favicon()
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
        "7 - The Summit B-Side 7 - 3000 M.png": "spire.png",
        "4 - Golden Ridge B-Side 3 - Gusty Canyon.png": "custom.png",
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


def detect_frame_rows(image):
    """Find the top edge and frame count of every 160 pixel portrait row."""
    alpha = image.split()[3].load()
    rows = []
    run = 0
    for y in range(image.height + 1):
        opaque = y < image.height and alpha[87, y] > 10
        if opaque:
            run += 1
            continue
        if run >= 150:
            top = y - run
            count = 0
            while 7 + count * 167 + 80 < image.width and alpha[7 + count * 167 + 80, top + 80] > 10:
                count += 1
            rows.append((top, count))
        run = 0
    return rows


def build_portrait_sheet(source, name, wanted, max_frames=8):
    """Pack selected portrait rows into a compact sheet.

    wanted maps an emotion name to the index of its row in the source sheet.
    """
    image = Image.open(os.path.join(ASSETS, source)).convert("RGBA")
    rows = detect_frame_rows(image)
    sheet = Image.new("RGBA", (160 * max_frames, 160 * len(wanted)), (0, 0, 0, 0))
    meta = {}
    for out_row, (emotion, index) in enumerate(wanted.items()):
        top, count = rows[index]
        frames = min(count, max_frames)
        for col in range(frames):
            x = 7 + col * 167
            sheet.paste(image.crop((x, top, x + 160, top + 160)), (col * 160, out_row * 160))
        meta[emotion] = (out_row, frames)
    sheet.save(out_path("portraits", name))
    print(name, meta)


def build_portraits():
    """Extract dialogue portrait strips for Madeline, her echo and Theo."""
    build_portrait_sheet("faces/madline_full.png", "madeline.png", {
        "normal": 4, "angry": 0, "deadpan": 1, "determined": 2, "distracted": 3,
        "panic": 5, "peaceful": 6, "sad": 7, "sadder": 8, "surprised": 9,
        "together": 10, "upset": 13,
    }, 7)
    build_portrait_sheet("faces/madline_full.png", "madeline_echo.png", {
        "normal": 21, "angry": 14, "deadpan": 15, "determined": 17, "distracted": 19,
        "panic": 22, "sad": 23, "surprised": 24, "upset": 25,
    }, 7)
    build_portrait_sheet("faces/theo.png", "theo.png", {
        "normal": 2, "excited": 0, "nailedIt": 1, "serious": 3, "thinking": 4, "worried": 5, "wtf": 6, "yolo": 7,
    }, 7)
    build_portrait_sheet("faces/theo.png", "theo_echo.png", {
        "normal": 10, "excited": 8, "serious": 11, "worried": 13,
    }, 7)


GRANNY_KEYS = {(255, 0, 255), (173, 0, 255), (0, 255, 255), (0, 173, 255)}
GRANNY_LAYOUT = {
    "idle": [(0, c) for c in range(7)] + [(1, c) for c in range(5)],
    "laugh": [(2, c) for c in range(4)],
    "talk": [(r, c) for r in range(3, 7) for c in range(7)] + [(7, 0)],
    "walk": [(8, c) for c in range(7)] + [(9, 0)],
}


def scale3x(image):
    """Scale pixel art three times with the Scale3x rule.

    Edges that run diagonally come out as smooth slopes instead of
    staircases, while flat areas keep their exact colours.
    """
    w, h = image.size
    src = image.load()
    out = Image.new("RGBA", (w * 3, h * 3), (0, 0, 0, 0))
    dst = out.load()

    def at(x, y):
        return src[min(w - 1, max(0, x)), min(h - 1, max(0, y))]

    for y in range(h):
        for x in range(w):
            a, b, c = at(x - 1, y - 1), at(x, y - 1), at(x + 1, y - 1)
            d, e, f = at(x - 1, y), at(x, y), at(x + 1, y)
            g, hh, i = at(x - 1, y + 1), at(x, y + 1), at(x + 1, y + 1)
            block = [e] * 9
            if b != hh and d != f:
                block[0] = d if d == b else e
                block[1] = b if (d == b and e != c) or (b == f and e != a) else e
                block[2] = f if b == f else e
                block[3] = d if (d == b and e != g) or (d == hh and e != a) else e
                block[5] = f if (b == f and e != i) or (hh == f and e != c) else e
                block[6] = d if d == hh else e
                block[7] = hh if (d == hh and e != i) or (hh == f and e != g) else e
                block[8] = f if hh == f else e
            for k, colour in enumerate(block):
                dst[x * 3 + k % 3, y * 3 + k // 3] = colour
    return out


def build_npcs():
    """Rebuild Granny's sheet from the clean 32 pixel original.

    The coloured cell backgrounds are keyed out, every frame is scaled three
    times with Scale3x so she has the same pixel size as Madeline but
    smoother outlines, and the clips are laid out one per row: idle, laugh,
    talk and walk. Frames are aligned on her feet.
    """
    source = Image.open(os.path.join(ASSETS, "characters/granny.png")).convert("RGBA")
    native = 32
    cell = native * 3
    columns = max(len(frames) for frames in GRANNY_LAYOUT.values())
    out = Image.new("RGBA", (cell * columns, cell * len(GRANNY_LAYOUT)), (0, 0, 0, 0))
    for row, frames in enumerate(GRANNY_LAYOUT.values()):
        for col, (r, c) in enumerate(frames):
            frame = source.crop((c * native, r * native, (c + 1) * native, (r + 1) * native))
            px = frame.load()
            for y in range(native):
                for x in range(native):
                    if px[x, y][:3] in GRANNY_KEYS:
                        px[x, y] = (0, 0, 0, 0)
            bounds = frame.getbbox()
            shift = native - bounds[3] if bounds else 0
            aligned = Image.new("RGBA", (native, native), (0, 0, 0, 0))
            aligned.paste(frame, (0, shift), frame)
            out.paste(scale3x(aligned), (col * cell, row * cell))
    out.save(out_path("sprites", "granny.png"))
    print("granny", out.size, {name: (index, len(frames)) for index, (name, frames) in enumerate(GRANNY_LAYOUT.items())})

    theo = Image.open(os.path.join(ASSETS, "characters/theo.png")).convert("RGBA")
    keys = {(255, 0, 195), (33, 255, 0)}
    tp = theo.load()
    rows = {"walk": 1, "idle": 2, "selfie": 15, "seated": 19, "sleeping": 21}
    counts = {}
    for name, row in rows.items():
        count = 0
        while count * 32 < theo.width and tp[count * 32 + 1, row * 32 + 1][:3] in keys:
            count += 1
        counts[name] = count
    sheet = Image.new("RGBA", (32 * max(counts.values()), 32 * len(rows)), (0, 0, 0, 0))
    for out_row, (name, row) in enumerate(rows.items()):
        for col in range(counts[name]):
            cell = theo.crop((col * 32, row * 32, col * 32 + 32, row * 32 + 32))
            cp = cell.load()
            for y in range(32):
                for x in range(32):
                    if cp[x, y][:3] in keys:
                        cp[x, y] = (0, 0, 0, 0)
            sheet.paste(cell, (col * 32, out_row * 32))
    sheet.save(out_path("sprites", "theo.png"))
    print("theo", {name: (i, counts[name]) for i, name in enumerate(rows)}, sheet.size)


GROUPS = {
    "npcs": build_npcs,
    "portraits": build_portraits,
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
