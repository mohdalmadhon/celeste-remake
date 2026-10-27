/**
 * Approximate reachability check for level layouts.
 *
 * Simulates Madeline's movement (running jumps with air control, wall
 * slides, stamina-limited climbing, wall jumps, climb jumps and the dash)
 * on a 25 pixel grid and reports which marked points can be reached.
 *
 * Usage:
 *   node tools/reachability.mjs json <level.json> <key> <startX> <startY> [x,y,label ...]
 *   node tools/reachability.mjs rows <rows.json> <solidChars> <hazardChars> <startX> <startY> [x,y,label ...]
 *
 * Add --no-dash to disable the dash and --crystals=x:y;x:y for stamina refills.
 * A PPM image of the reachable area is written to /tmp/reachability.ppm.
 */
import fs from "node:fs";

const CELL = 25;
const GRAVITY = 3600;
const MAX_FALL = 640;
const JUMP = 420;
const MAX_RUN = 360;
const DASH = 960;
const DASH_TIME = 0.15;
const END_DASH = 640;
const CLIMB_CELLS = 17;
const STEP = 1 / 120;

/**
 * Loads solids and hazards from an original JSON level.
 *
 * @param {string} path - File path.
 * @param {string} key - Root key.
 * @returns {{ solids: number[][], hazards: number[][] }} Rectangles.
 */
function loadJson(path, key) {
    const tiles = JSON.parse(fs.readFileSync(path, "utf8"))[key].tiles;
    const solids = [];
    const hazards = [];
    for (const group of Object.values(tiles)) {
        const classes = group.class || [];
        const { width: w, height: h } = group.dimensions;
        for (const p of group.positions) {
            const rect = [p.x, p.y - 200, w, h];
            if (classes.includes("none-collision")) continue;
            (classes.includes("deadly") ? hazards : solids).push(rect);
        }
    }
    return { solids, hazards };
}

/**
 * Loads solids and hazards from ASCII rows of 50 pixel cells.
 *
 * @param {string} path - JSON file containing an array of strings.
 * @param {string} solidChars - Characters treated as solid.
 * @param {string} hazardChars - Characters treated as hazards.
 * @returns {{ solids: number[][], hazards: number[][] }} Rectangles.
 */
function loadRows(path, solidChars, hazardChars) {
    const rows = JSON.parse(fs.readFileSync(path, "utf8"));
    const solids = [];
    const hazards = [];
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (solidChars.includes(ch)) solids.push([x * 50, y * 50, 50, 50]);
        else if (hazardChars.includes(ch)) hazards.push([x * 50 + 9, y * 50 + 9, 32, 32]);
    }));
    return { solids, hazards };
}

/**
 * Builds the occupancy grid.
 *
 * @param {number[][]} solids - Solid rectangles.
 * @param {number[][]} hazards - Hazard rectangles.
 * @returns {*} Grid helpers.
 */
function makeGrid(solids, hazards) {
    const all = [...solids, ...hazards];
    const x0 = Math.floor(Math.min(...all.map((r) => r[0])) / CELL) - 4;
    const y0 = Math.floor(Math.min(...all.map((r) => r[1])) / CELL) - 12;
    const w = Math.floor(Math.max(...all.map((r) => r[0] + r[2])) / CELL) - x0 + 5;
    const h = Math.floor(Math.max(...all.map((r) => r[1] + r[3])) / CELL) - y0 + 8;
    const solid = new Uint8Array(w * h);
    const hazard = new Uint8Array(w * h);
    const paint = (target, rects) => {
        for (const [x, y, rw, rh] of rects) {
            for (let cy = Math.floor(y / CELL); cy < Math.ceil((y + rh) / CELL); cy++) {
                for (let cx = Math.floor(x / CELL); cx < Math.ceil((x + rw) / CELL); cx++) {
                    const gx = cx - x0;
                    const gy = cy - y0;
                    if (gx >= 0 && gx < w && gy >= 0 && gy < h) target[gy * w + gx] = 1;
                }
            }
        }
    };
    paint(solid, solids);
    paint(hazard, hazards);
    const blocked = (gx, gy) => {
        if (gx < 0 || gx >= w || gy < 0) return true;
        if (gy >= h) return false;
        return solid[gy * w + gx] === 1;
    };
    return {
        x0, y0, w, h, solid, hazard, blocked,
        free: (gx, gy) => !blocked(gx, gy - 1) && !blocked(gx, gy - 2),
        deadly: (gx, gy) => [gy - 1, gy - 2].some((row) => row >= 0 && row < h && gx >= 0 && gx < w && hazard[row * w + gx] === 1)
    };
}

/**
 * Samples a movement arc into cell offsets.
 *
 * @param {number} vx - Initial horizontal speed.
 * @param {number} vy - Initial vertical speed.
 * @param {number} hold - Variable jump hold time.
 * @param {number} [force=0] - Time horizontal speed is locked.
 * @param {number[]|null} [dash=null] - Dash direction.
 * @returns {number[][]} Offsets as [dx, dy, vy].
 */
function arc(vx, vy, hold, force = 0, dash = null) {
    let x = 0;
    let y = 0;
    let t = 0;
    let variable = hold;
    let speedX = vx;
    const out = [];
    let last = "";
    while (t < 2.2 && y < 1400) {
        if (dash && t < DASH_TIME) {
            speedX = dash[0] * DASH;
            vy = dash[1] * DASH;
        } else if (dash && t < DASH_TIME + STEP) {
            speedX = dash[0] * END_DASH;
            vy = dash[1] * END_DASH * (dash[1] < 0 ? 0.75 : 1);
        } else {
            if (variable > 0) {
                vy = Math.min(vy, -JUMP);
                variable -= STEP;
            }
            const half = Math.abs(vy) < 160 && hold > 0 ? 0.5 : 1;
            vy = Math.min(MAX_FALL, vy + GRAVITY * half * STEP);
            if (force > 0) {
                force -= STEP;
            } else if (!dash) {
                const target = vx ? Math.sign(vx) * MAX_RUN : 0;
                speedX += Math.max(-2600 * STEP, Math.min(2600 * STEP, target - speedX));
            }
        }
        x += speedX * STEP;
        y += vy * STEP;
        t += STEP;
        const cx = Math.round(x / CELL);
        const cy = Math.floor(y / CELL);
        const key = `${cx},${cy}`;
        if (key !== last) {
            out.push([cx, cy, vy]);
            last = key;
        }
    }
    return out;
}

const jumps = [];
const falls = [];
const wallJumps = [];
const dashes = [];
for (const vx of [-520, -360, -240, -120, 0, 120, 240, 360, 520]) {
    for (const hold of [0.02, 0.1, 0.2]) jumps.push(arc(vx, -JUMP, hold));
    falls.push(arc(Math.max(-MAX_RUN, Math.min(MAX_RUN, vx)), 0, 0));
}
for (const side of [-1, 1]) {
    for (const steer of [-1, 0, 1]) wallJumps.push([side, arc(steer === 0 ? side * 520 : steer * MAX_RUN, -JUMP, 0.2, 0.16)]);
}
for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]]) {
    const n = Math.hypot(dx, dy);
    dashes.push(arc(0, 0, 0, 0, [dx / n, dy / n]));
}
const climbJump = arc(0, -JUMP, 0.2).map(([, dy, vy]) => [0, dy, vy]);

/**
 * Breadth-first search over movement states.
 *
 * @param {*} grid - Occupancy grid.
 * @param {number[]} start - Start point in pixels.
 * @param {{ dash: boolean, crystals: number[][] }} options - Search options.
 * @returns {Set<number>} Reached cell indices.
 */
function search(grid, start, options) {
    const reach = new Set();
    const seen = new Set();
    const crystals = new Set(options.crystals.map(([x, y]) => (Math.floor(y / CELL) - grid.y0) * grid.w + Math.floor(x / CELL) - grid.x0));
    let sx = Math.floor(start[0] / CELL) - grid.x0;
    let sy = Math.floor(start[1] / CELL) - grid.y0;
    while (sy < grid.h && !grid.blocked(sx, sy)) sy++;
    const queue = [[sx, sy, 0, CLIMB_CELLS, 1]];
    let head = 0;
    const modeKey = { ground: 0, left: 1, right: 2, air: 3 };
    const push = (x, y, mode, stamina, dash) => {
        if (x < 0 || x >= grid.w || y < 0 || y >= grid.h + 2) return;
        const key = ((((y * grid.w + x) * 4 + mode) * 5 + (stamina >> 2)) * 2) + dash;
        if (seen.has(key)) return;
        seen.add(key);
        queue.push([x, y, mode, stamina, dash]);
    };
    const fly = (x, y, path, stamina, dash, isDash) => {
        for (const [dx, dy, vy] of path) {
            const cx = x + dx;
            const cy = y + dy;
            if (cx < 0 || cx >= grid.w || cy >= grid.h + 2) return;
            if (!grid.free(cx, cy) || grid.deadly(cx, cy)) return;
            reach.add(cy * grid.w + cx);
            if (crystals.has((cy - 1) * grid.w + cx) || crystals.has((cy - 2) * grid.w + cx)) {
                stamina = CLIMB_CELLS;
                dash = options.dash ? 1 : 0;
            }
            if (vy >= 0 && grid.blocked(cx, cy)) {
                push(cx, cy, modeKey.ground, CLIMB_CELLS, options.dash ? 1 : 0);
                return;
            }
            if (stamina > 0) {
                if (grid.blocked(cx - 1, cy - 1)) push(cx, cy, modeKey.left, stamina, isDash ? 0 : dash);
                if (grid.blocked(cx + 1, cy - 1)) push(cx, cy, modeKey.right, stamina, isDash ? 0 : dash);
            }
            if (!isDash && dash) push(cx, cy, modeKey.air, stamina, 1);
        }
    };
    while (head < queue.length) {
        const [x, y, mode, stamina, dash] = queue[head++];
        reach.add(y * grid.w + x);
        if (mode === modeKey.air) {
            for (const path of dashes) fly(x, y, path, stamina, 0, true);
            continue;
        }
        if (mode === modeKey.ground) {
            for (const side of [-1, 1]) {
                const nx = x + side;
                if (grid.free(nx, y) && !grid.deadly(nx, y)) {
                    if (grid.blocked(nx, y)) push(nx, y, modeKey.ground, CLIMB_CELLS, dash);
                    else for (const path of falls) fly(nx, y, path, stamina, dash, false);
                } else if (grid.blocked(nx, y - 1)) {
                    push(x, y, side < 0 ? modeKey.left : modeKey.right, stamina, dash);
                }
            }
            for (const path of jumps) fly(x, y, path, stamina, dash, false);
            if (dash) for (const path of dashes) fly(x, y, path, stamina, 0, true);
            continue;
        }
        const side = mode === modeKey.left ? -1 : 1;
        if (stamina > 0 && grid.free(x, y - 1) && grid.blocked(x + side, y - 2)) {
            push(x, y - 1, mode, stamina - 1, dash);
        } else if (stamina > 0 && grid.free(x + side, y - 1)) {
            if (grid.blocked(x + side, y)) push(x + side, y, modeKey.ground, CLIMB_CELLS, dash);
            for (const path of falls.slice(3, 6)) fly(x + side, y - 1, path, stamina, dash, false);
        }
        if (grid.free(x, y + 1) && !grid.blocked(x, y)) push(x, y + 1, mode, stamina, dash);
        for (const [wallSide, path] of wallJumps) if (wallSide === -side) fly(x, y, path, stamina, dash, false);
        if (stamina >= 5) fly(x, y, climbJump, stamina - 5, dash, false);
        if (dash) for (const path of dashes) fly(x, y, path, stamina, 0, true);
        for (const path of falls.slice(3, 6)) fly(x, y, path, stamina, dash, false);
    }
    return reach;
}

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const rest = args.filter((a) => !a.startsWith("--"));
const options = {
    dash: !flags.includes("--no-dash"),
    crystals: (flags.find((f) => f.startsWith("--crystals="))?.slice(11) || "").split(";").filter(Boolean).map((p) => p.split(":").map(Number))
};
let data;
let cursor;
if (rest[0] === "json") {
    data = loadJson(rest[1], rest[2]);
    cursor = 3;
} else {
    data = loadRows(rest[1], rest[2], rest[3]);
    cursor = 4;
}
const start = [Number(rest[cursor]), Number(rest[cursor + 1])];
const marks = rest.slice(cursor + 2).map((spec) => {
    const [x, y, label] = spec.split(",");
    return { x: Number(x), y: Number(y), label };
});
const grid = makeGrid(data.solids, data.hazards);
const began = Date.now();
const reach = search(grid, start, options);
for (const mark of marks) {
    const gx = Math.floor(mark.x / CELL) - grid.x0;
    const gy = Math.floor(mark.y / CELL) - grid.y0;
    let ok = false;
    for (let dy = -1; dy <= 2 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) ok = reach.has((gy + dy) * grid.w + gx + dx);
    mark.ok = ok;
    console.log(`${mark.label}: ${ok ? "reachable" : "NOT reachable"}`);
}
console.log(`searched in ${Date.now() - began} ms`);
const scale = 3;
const W = grid.w * scale;
const H = grid.h * scale;
const pixels = Buffer.alloc(W * H * 3, 20);
for (let gy = 0; gy < grid.h; gy++) {
    for (let gx = 0; gx < grid.w; gx++) {
        const i = gy * grid.w + gx;
        const colour = grid.solid[i] ? [150, 160, 190] : grid.hazard[i] ? [230, 60, 60] : reach.has(i) ? [40, 120, 70] : null;
        if (!colour) continue;
        for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) pixels.set(colour, ((gy * scale + dy) * W + gx * scale + dx) * 3);
    }
}
for (const mark of marks) {
    const gx = Math.floor(mark.x / CELL) - grid.x0;
    const gy = Math.floor(mark.y / CELL) - grid.y0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const px = gx * scale + dx;
        const py = gy * scale + dy;
        if (px >= 0 && py >= 0 && px < W && py < H && (Math.abs(dx) === 4 || Math.abs(dy) === 4)) pixels.set(mark.ok ? [255, 220, 0] : [255, 0, 255], (py * W + px) * 3);
    }
}
fs.writeFileSync("/tmp/reachability.ppm", Buffer.concat([Buffer.from(`P6 ${W} ${H} 255\n`), pixels]));
