/**
 * Fills the parts of a level the player can never reach with solid terrain.
 *
 * Reads a dump written by tools/dump_level.cjs, simulates every way Madeline
 * can move through the level (with moving blocks at both ends of their
 * travel and with falling blocks both present and gone), and fills empty
 * cells that hang below or sit beside existing ground and are never
 * occupied. Pits the player can fall into stay open. The result is verified
 * by searching the filled layout again; every mark that was reachable must
 * still be reachable.
 *
 * Usage: node tools/backfill.mjs <dump.json> <name> <out.json> [--doomed] [--sides=<tiles>]
 *
 * --doomed treats cells from which nothing can be landed on as fillable, and
 * --sides thickens tall walls outward by up to that many tiles.
 */
import fs from "node:fs";
import { CELL, makeGrid, search } from "./reachability.mjs";

const TILE = 50;
const SUB = TILE / CELL;
const MATERIAL_FOR_SURFACE = { ice: "i", metal: "i", dirt: "d", snow: "d", wood: "d" };

/**
 * Builds the solid rectangles of one movement configuration.
 *
 * @param {*} dump - Level dump.
 * @param {{ moversAtEnd: boolean, withFalling: boolean }} config - Configuration.
 * @param {number[][]} [extra=[]] - Additional solids such as the fill.
 * @returns {number[][]} Solid rectangles.
 */
function solidsFor(dump, config, extra = []) {
    const solids = dump.solids.map(([x, y, w, h]) => [x, y, w, h]);
    for (const mover of dump.movers) {
        const [x, y, w, h] = mover.rect;
        solids.push(config.moversAtEnd ? [mover.end[0], mover.end[1], w, h] : [x, y, w, h]);
    }
    if (config.withFalling) {
        for (const block of dump.falling) if (block.active) solids.push(block.rect);
    }
    return solids.concat(extra);
}

/**
 * Runs the reachability search for every configuration.
 *
 * @param {*} dump - Level dump.
 * @param {*} extent - Grid extent.
 * @param {number[][]} [extra=[]] - Additional solids.
 * @returns {{ grids: *[], reaches: Set<number>[] }} Grids and reached cells per configuration.
 */
function searchAll(dump, extent, extra = []) {
    const configs = [
        { moversAtEnd: false, withFalling: true },
        { moversAtEnd: true, withFalling: true },
        { moversAtEnd: false, withFalling: false },
        { moversAtEnd: true, withFalling: false }
    ];
    const grids = [];
    const reaches = [];
    for (const config of configs) {
        const grid = makeGrid(solidsFor(dump, config, extra), dump.hazards, extent);
        grids.push(grid);
        reaches.push(search(grid, dump.start, { dash: true, crystals: [] }));
    }
    return { grids, reaches };
}

/**
 * Whether a mark is reached in a search result.
 *
 * @param {*} grid - Grid the search ran on.
 * @param {Set<number>} reach - Reached cells.
 * @param {{ x: number, y: number }} mark - Mark in pixels.
 * @returns {boolean} True when a cell near the mark was reached.
 */
function reached(grid, reach, mark) {
    const gx = Math.floor(mark.x / CELL) - grid.x0;
    const gy = Math.floor(mark.y / CELL) - grid.y0;
    for (let dy = -1; dy <= 2; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (reach.has((gy + dy) * grid.w + gx + dx)) return true;
        }
    }
    return false;
}

/**
 * Converts reached foot cells into the cells Madeline's body can overlap,
 * grown by one cell through empty space as a safety margin.
 *
 * @param {*} grid - Grid of the search.
 * @param {Set<number>} reach - Reached foot cells.
 * @param {(gx: number, gy: number) => boolean} doomed - Cells ignored because nothing can be landed on from them.
 * @returns {Set<string>} Occupied cells keyed by world cell coordinates.
 */
function occupancy(grid, reach, doomed) {
    const body = new Set();
    for (const index of reach) {
        const gx = index % grid.w;
        const gy = Math.floor(index / grid.w);
        if (doomed(gx + grid.x0, gy + grid.y0)) continue;
        for (const dy of [0, -1, -2]) body.add(`${gx + grid.x0},${gy + dy + grid.y0}`);
    }
    const grown = new Set(body);
    for (const key of body) {
        const [cx, cy] = key.split(",").map(Number);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const gx = cx + dx - grid.x0;
                const gy = cy + dy - grid.y0;
                if (gy >= 0 && gy < grid.h && gx >= 0 && gx < grid.w && grid.solid[gy * grid.w + gx]) continue;
                grown.add(`${cx + dx},${cy + dy}`);
            }
        }
    }
    return grown;
}

/**
 * Builds a predicate for cells from which nothing below can be landed on.
 *
 * A reached cell counts as doomed when no standable surface exists at or
 * below it within a few columns, so the player is already falling to their
 * death there. Filling such cells straightens pit walls without changing
 * any route that can be survived.
 *
 * @param {*} grid - Reference grid.
 * @returns {(cx: number, cy: number) => boolean} Predicate on world cell coordinates.
 */
function doomedPredicate(grid) {
    const lowestSurface = new Int32Array(grid.w).fill(-1);
    for (let gx = 0; gx < grid.w; gx++) {
        for (let gy = grid.h - 1; gy > 0; gy--) {
            if (grid.solid[gy * grid.w + gx] && !grid.solid[(gy - 1) * grid.w + gx]) {
                lowestSurface[gx] = gy;
                break;
            }
        }
    }
    const reachRadius = 8;
    return (cx, cy) => {
        const gx = cx - grid.x0;
        const gy = cy - grid.y0;
        for (let x = gx - reachRadius; x <= gx + reachRadius; x++) {
            if (x >= 0 && x < grid.w && lowestSurface[x] >= gy) return false;
        }
        return true;
    };
}

const [dumpPath, name, outPath, ...flags] = process.argv.slice(2);
const dump = JSON.parse(fs.readFileSync(dumpPath, "utf8"));
const bounds = dump.bounds;
const bottom = Math.max(bounds.bottom + 120, Math.min(dump.killY ?? Infinity, bounds.bottom + 240));
const extent = { left: bounds.left, top: bounds.top, right: bounds.right, bottom };
const before = searchAll(dump, extent);
const reference = before.grids[0];
const doomed = flags.includes("--doomed") ? doomedPredicate(reference) : () => false;
const occupied = new Set();
before.grids.forEach((grid, i) => {
    for (const key of occupancy(grid, before.reaches[i], doomed)) occupied.add(key);
});

const surfaceRects = dump.solids;
const ox = Math.floor(bounds.left / TILE) * TILE;
const oy = Math.floor(bounds.top / TILE) * TILE;
const cols = Math.ceil((bounds.right - ox) / TILE);
const rows = Math.ceil((bottom - oy) / TILE);

/**
 * Surface of the existing solid covering most of a tile cell.
 *
 * @param {number} c - Column.
 * @param {number} r - Row.
 * @returns {string|null} Surface name, empty for invisible bodies, null when the cell is mostly empty.
 */
function existingSurface(c, r) {
    const x = ox + c * TILE;
    const y = oy + r * TILE;
    let best = null;
    let bestArea = 0;
    for (const [sx, sy, sw, sh, surface] of surfaceRects) {
        const w = Math.min(x + TILE, sx + sw) - Math.max(x, sx);
        const h = Math.min(y + TILE, sy + sh) - Math.max(y, sy);
        if (w > 0 && h > 0 && w * h > bestArea) {
            bestArea = w * h;
            best = surface;
        }
    }
    return bestArea >= TILE * TILE * 0.4 ? best : null;
}

const reserved = [];
for (const mover of dump.movers) {
    const [x, y, w, h] = mover.rect;
    const left = Math.min(x, mover.end[0]);
    const top = Math.min(y, mover.end[1]);
    reserved.push([left - CELL, top - CELL, Math.abs(mover.end[0] - x) + w + CELL * 2, Math.abs(mover.end[1] - y) + h + CELL * 2]);
}
for (const block of dump.falling) {
    const [x, y, w] = block.rect;
    reserved.push([x, y, w, bottom - y + TILE]);
}

/**
 * Whether no sub cell of a tile cell is occupied or hazardous, and the cell
 * stays clear of moving blocks and the paths of falling blocks.
 *
 * @param {number} c - Column.
 * @param {number} r - Row.
 * @returns {boolean} True when the cell may be filled.
 */
function fillable(c, r) {
    const x = ox + c * TILE;
    const y = oy + r * TILE;
    for (const [rx, ry, rw, rh] of reserved) {
        if (x < rx + rw && x + TILE > rx && y < ry + rh && y + TILE > ry) return false;
    }
    const cx = Math.floor((ox + c * TILE) / CELL);
    const cy = Math.floor((oy + r * TILE) / CELL);
    for (let dy = 0; dy < SUB; dy++) {
        for (let dx = 0; dx < SUB; dx++) {
            if (occupied.has(`${cx + dx},${cy + dy}`)) return false;
            const gx = cx + dx - reference.x0;
            const gy = cy + dy - reference.y0;
            if (gx >= 0 && gy >= 0 && gx < reference.w && gy < reference.h) {
                const i = gy * reference.w + gx;
                if (reference.hazard[i]) return false;
            }
        }
    }
    return true;
}

const cells = [];
const material = [];
for (let r = 0; r < rows; r++) {
    cells.push(new Array(cols).fill(" "));
    material.push(new Array(cols).fill(""));
}
for (let c = 0; c < cols; c++) {
    let last = "";
    for (let r = 0; r < rows; r++) {
        const surface = existingSurface(c, r);
        if (surface !== null) {
            cells[r][c] = "x";
            if (surface) last = MATERIAL_FOR_SURFACE[surface] || "d";
            continue;
        }
        const above = r > 0 ? cells[r - 1][c] : " ";
        if ((above === "x" || above === "f") && last && fillable(c, r)) {
            cells[r][c] = "f";
            material[r][c] = last;
        }
    }
}
for (let changed = true, pass = 0; changed && pass < 400; pass++) {
    changed = false;
    for (let c = 0; c < cols; c++) {
        let under = false;
        for (let r = 0; r < rows; r++) {
            if (cells[r][c] !== " ") {
                under = true;
                continue;
            }
            if (!under) continue;
            for (const side of [-1, 1]) {
                const n = c + side;
                if (n < 0 || n >= cols) continue;
                if (cells[r][n] === "f" && fillable(c, r)) {
                    cells[r][c] = "f";
                    material[r][c] = material[r][n];
                    changed = true;
                    break;
                }
            }
        }
    }
}

/**
 * Whether a tile cell stays clear of moving blocks and falling paths.
 *
 * @param {number} c - Column.
 * @param {number} r - Row.
 * @returns {boolean} True when nothing moves through the cell.
 */
function clearOfMovers(c, r) {
    const x = ox + c * TILE;
    const y = oy + r * TILE;
    return !reserved.some(([rx, ry, rw, rh]) => x < rx + rw && x + TILE > rx && y < ry + rh && y + TILE > ry);
}

/**
 * Air cells outside the level's structure.
 *
 * Flood fills from the edges of the grid through air that is not directly
 * next to existing tiles, so gaps up to two tiles wide count as closed and
 * the flood cannot leak into rooms and corridors.
 *
 * @returns {Set<number>} Indices (row * cols + column) of outside cells.
 */
function outsideCells() {
    const passable = (c, r) => {
        if (cells[r][c] !== " ") return false;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (cells[r + dr]?.[c + dc] === "x") return false;
            }
        }
        return true;
    };
    const seen = new Set();
    const stack = [];
    for (let c = 0; c < cols; c++) stack.push([c, 0]);
    for (let r = 0; r < rows; r++) stack.push([0, r], [cols - 1, r]);
    while (stack.length) {
        const [c, r] = stack.pop();
        if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
        const key = r * cols + c;
        if (seen.has(key) || !passable(c, r)) continue;
        seen.add(key);
        stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
    const grown = new Set(seen);
    for (const key of seen) {
        const r = Math.floor(key / cols);
        const c = key % cols;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nc >= 0 && nr < rows && nc < cols && cells[nr][nc] === " ") grown.add(nr * cols + nc);
            }
        }
    }
    return grown;
}

const sideFlag = flags.find((flag) => flag.startsWith("--sides="));
const sideDepth = sideFlag ? Number(sideFlag.slice(8)) : 0;
if (sideDepth > 0) {
    const outside = outsideCells();
    const keep = (x, y, w, h, margin) => {
        for (let r = Math.floor((y - margin - oy) / TILE); r <= Math.floor((y + h + margin - oy) / TILE); r++) {
            for (let c = Math.floor((x - margin - ox) / TILE); c <= Math.floor((x + w + margin - ox) / TILE); c++) outside.delete(r * cols + c);
        }
    };
    for (const mark of dump.marks) keep(mark.x, mark.y, 0, 0, 300);
    for (const mover of dump.movers) {
        const [x, y, w, h] = mover.rect;
        const left = Math.min(x, mover.end[0]);
        const top = Math.min(y, mover.end[1]);
        keep(left, top, Math.abs(mover.end[0] - x) + w, Math.abs(mover.end[1] - y) + h, 200);
    }
    const wallCell = (c, r) => cells[r]?.[c] === "x";
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!wallCell(c, r) || !wallCell(c, r - 1) || !wallCell(c, r + 1)) continue;
            const wallSurface = existingSurface(c, r);
            if (!wallSurface) continue;
            const wallMaterial = MATERIAL_FOR_SURFACE[wallSurface] || "d";
            for (const side of [-1, 1]) {
                for (let step = 1; step <= sideDepth; step++) {
                    const n = c + side * step;
                    if (n < 0 || n >= cols || cells[r][n] !== " " || !outside.has(r * cols + n) || !clearOfMovers(n, r)) break;
                    cells[r][n] = "f";
                    material[r][n] = wallMaterial;
                }
            }
        }
    }
    for (let c = 0; c < cols; c++) {
        for (let r = 1; r < rows; r++) {
            if (cells[r][c] === " " && cells[r - 1][c] === "f" && (fillable(c, r) || (outside.has(r * cols + c) && clearOfMovers(c, r)))) {
                cells[r][c] = "f";
                material[r][c] = material[r - 1][c];
            }
        }
    }
}

const fillRects = [];
for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (cells[r][c] === "f") fillRects.push([ox + c * TILE, oy + r * TILE, TILE, TILE]);
}
if (flags.includes("--debug")) {
    const scale = 4;
    const W = cols * SUB * scale;
    const H = rows * SUB * scale;
    const pixels = Buffer.alloc(W * H * 3, 25);
    for (let y = 0; y < rows * SUB; y++) {
        for (let x = 0; x < cols * SUB; x++) {
            const cx = Math.floor(ox / CELL) + x;
            const cy = Math.floor(oy / CELL) + y;
            const gx = cx - reference.x0;
            const gy = cy - reference.y0;
            const inside = gx >= 0 && gy >= 0 && gx < reference.w && gy < reference.h;
            const cell = cells[Math.floor(y / SUB)][Math.floor(x / SUB)];
            let colour = null;
            if (inside && reference.solid[gy * reference.w + gx]) colour = [170, 170, 190];
            else if (cell === "f") colour = [60, 90, 200];
            else if (occupied.has(`${cx},${cy}`)) colour = [40, 130, 70];
            if (!colour) continue;
            for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) pixels.set(colour, ((y * scale + dy) * W + x * scale + dx) * 3);
        }
    }
    fs.writeFileSync(`/tmp/backfill-${name}.ppm`, Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), pixels]));
}const after = searchAll(dump, extent, fillRects);
let ok = true;
for (const mark of dump.marks) {
    const was = before.grids.some((grid, i) => reached(grid, before.reaches[i], mark));
    const now = after.grids.some((grid, i) => reached(grid, after.reaches[i], mark));
    console.log(`${mark.label}: before ${was ? "yes" : "no"}, after ${now ? "yes" : "no"}`);
    if (was && !now) ok = false;
}
if (!ok) {
    console.error("filling would cut off a reachable mark; nothing written");
    process.exit(1);
}
const out = cells.map((row, r) => row.map((ch, c) => (ch === "f" ? material[r][c] : ch)).join("").replace(/\s+$/, ""));
const result = { x: ox, y: oy, rows: out };
const all = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, "utf8")) : {};
all[name] = result;
fs.writeFileSync(outPath, JSON.stringify(all));

console.log(`${name}: ${fillRects.length} cells filled at ${ox},${oy} (${cols}x${rows})`);
