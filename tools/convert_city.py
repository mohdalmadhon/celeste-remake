"""Convert the original Forsaken City JSON layout into an aligned grid map.

Every tile is snapped to the 50 pixel grid by its centre and mapped to an
autotiled material, spikes become markers, and the crumbling girders are
listed separately. When a fill produced by tools/backfill.mjs is given it is
merged in as solid rock, so the map and its fill share edge tiles.

Usage:
    python3 tools/convert_city.py              writes the plain aligned map
    python3 tools/convert_city.py fill.json    writes the map merged with a fill
"""
import json
import math
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRIORITY = {".": 0, "^": 1, "<": 1, ">": 1, "v": 1, "b": 2, "g": 3, "d": 4, "s": 4, "i": 5}


def material(name):
    """Return the map character for an original tile group, or None to skip it."""
    lower = name.lower()
    if lower.startswith("blueice"):
        return "i"
    if lower.startswith("dirt"):
        return "d"
    if lower.startswith("snow"):
        return "s"
    if lower.startswith("ironbar"):
        return "g"
    if lower in ("break", "breakflipped"):
        return "b"
    if lower == "spikes":
        return "^"
    if lower == "spikesflippedleft":
        return "<"
    if lower == "spikesflippedright":
        return ">"
    if lower.startswith("spikedown") or lower.startswith("spikesdown"):
        return "v"
    return None


def covered_cells(x, y, w, h):
    """Grid cells a tile occupies: its centre cell, or every cell along a long beam."""
    if w <= 55 and h <= 55:
        return [(math.floor((x + w / 2) / 50), math.floor((y + h / 2) / 50))]
    cells = []
    if w >= h:
        cy = math.floor((y + h / 2) / 50)
        for cx in range(math.floor(x / 50), math.floor((x + w - 1) / 50) + 1):
            if x - 5 <= cx * 50 + 25 <= x + w + 5:
                cells.append((cx, cy))
    else:
        cx = math.floor((x + w / 2) / 50)
        for cy in range(math.floor(y / 50), math.floor((y + h - 1) / 50) + 1):
            if y - 5 <= cy * 50 + 25 <= y + h + 5:
                cells.append((cx, cy))
    return cells


def convert():
    """Snap the original level to the grid and return its origin, rows and crumbling girders."""
    tiles = json.load(open(os.path.join(ROOT, "js/data/firstLevel.json")))["firstLevel"]["tiles"]
    cells = {}
    crumbles = []
    for name, group in tiles.items():
        w, h = group["dimensions"]["width"], group["dimensions"]["height"]
        for position in group["positions"]:
            x, y = position["x"], position["y"] - 200
            if name == "breakCracked":
                crumbles.append((round(x / 50) * 50, (y // 50) * 50))
                continue
            char = material(name)
            if char is None:
                continue
            for cell in covered_cells(x, y, w, h):
                if PRIORITY[char] >= PRIORITY.get(cells.get(cell, "."), 0):
                    cells[cell] = char
    xs = [c[0] for c in cells]
    ys = [c[1] for c in cells]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    rows = ["".join(cells.get((cx, cy), ".") for cx in range(x0, x1 + 1)) for cy in range(y0, y1 + 1)]
    return x0 * 50, y0 * 50, rows, crumbles


def merge(origin_x, origin_y, rows, fill):
    """Merge a backfill result into the rows as dirt and return the new origin and rows."""
    ox, oy = min(origin_x, fill["x"]), min(origin_y, fill["y"])
    width = max((origin_x - ox) // 50 + len(rows[0]), (fill["x"] - ox) // 50 + max(len(r) for r in fill["rows"]))
    height = max((origin_y - oy) // 50 + len(rows), (fill["y"] - oy) // 50 + len(fill["rows"]))
    grid = [["."] * width for _ in range(height)]
    for r, row in enumerate(fill["rows"]):
        for c, char in enumerate(row):
            if char in "di":
                grid[(fill["y"] - oy) // 50 + r][(fill["x"] - ox) // 50 + c] = "d"
    for r, row in enumerate(rows):
        for c, char in enumerate(row):
            if char != ".":
                grid[(origin_y - oy) // 50 + r][(origin_x - ox) // 50 + c] = char
    return ox, oy, ["".join(row) for row in grid]


def write_module(ox, oy, rows, crumbles, filled):
    """Write js/levels/maps/cityMap.js."""
    lines = ",\n".join(f'        "{row}"' for row in rows)
    points = ", ".join(f"[{x}, {y}]" for x, y in crumbles)
    note = (" * Forsaken City terrain on a 50 pixel grid, aligned from the original level,\n"
            " * with the space the player can never reach filled in as solid rock.\n") if filled else \
        " * Forsaken City terrain on a 50 pixel grid, aligned from the original level.\n"
    source = (
        "/**\n * Left edge of the Forsaken City map in world pixels.\n *\n * @type {number}\n */\n"
        f"export const CITY_ORIGIN_X = {ox};\n\n"
        "/**\n * Top edge of the Forsaken City map in world pixels.\n *\n * @type {number}\n */\n"
        f"export const CITY_ORIGIN_Y = {oy};\n\n"
        "/**\n * Top-left corners of the crumbling girders, aligned to the map grid.\n *\n"
        " * @type {ReadonlyArray<[number, number]>}\n */\n"
        f"export const CITY_CRUMBLES = Object.freeze([{points}]);\n\n"
        "/**\n" + note + " *\n"
        " * Legend: \"i\" ice, \"d\" dirt, \"s\" snowy dirt, \"g\" steel girder, \"b\" stone\n"
        " * beam, \"^\" \"v\" \"<\" \">\" spikes pointing up, down, left and right.\n *\n"
        " * @returns {string[]} Map rows, top to bottom, starting at CITY_ORIGIN_Y.\n */\n"
        "export function buildCityMap() {\n    return [\n" + lines + "\n    ];\n}\n"
    )
    with open(os.path.join(ROOT, "js/levels/maps/cityMap.js"), "w") as handle:
        handle.write(source)


def main():
    """Convert, optionally merge a fill, and write the map module."""
    ox, oy, rows, crumbles = convert()
    filled = len(sys.argv) > 1
    if filled:
        fill = json.load(open(sys.argv[1]))["forsaken-city"]
        ox, oy, rows = merge(ox, oy, rows, fill)
    write_module(ox, oy, rows, crumbles, filled)
    print(f"cityMap.js: {len(rows[0])}x{len(rows)} at {ox},{oy}")


if __name__ == "__main__":
    main()
