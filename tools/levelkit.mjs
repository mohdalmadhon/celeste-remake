/**
 * Small toolkit for writing level files from code: carve and fill tiles,
 * place objects, check with the reachability search that every
 * checkpoint, strawberry and the goal can be reached, and print or save
 * the result in the format the editor uses.
 */
import fs from "node:fs";
import { CELL, makeGrid, search } from "./reachability.mjs";

const TILE = 50;
const SPIKE_RECT = { up: [4, 26, 42, 24], down: [4, 0, 42, 24], left: [26, 4, 24, 42], right: [0, 4, 24, 42] };
const SYMBOL = {
    spike: "^", crumble: "c", falling: "f", crystal: "*", dustBunny: "x", checkpoint: "C", goal: "G", strawberry: "S", spawn: "P", zipMover: "z", booster: "o",
    spring: "s", key: "k", door: "D", touchSwitch: "t", gate: "=", dashBlock: "%", seeker: "@", npc: "n", marker: "m"
};

/**
 * Creates an empty level of a given size filled with one tile.
 *
 * @param {number} width - Width in cells.
 * @param {number} height - Height in cells.
 * @param {string} fill - Tile character every cell starts as.
 * @returns {*} Level builder.
 */
export function createLevel(width, height, fill) {
    const tiles = Array.from({ length: height }, () => Array(width).fill(fill));
    const background = Array.from({ length: height }, () => Array(width).fill("."));
    const entities = [];
    const events = [];
    let nextId = 1;

    /**
     * Fills a rectangle of cells with a tile character.
     *
     * @param {number} x - Left column.
     * @param {number} y - Top row.
     * @param {number} w - Width in cells.
     * @param {number} h - Height in cells.
     * @param {string} ch - Tile character, "." for air.
     * @returns {void}
     */
    const rect = (x, y, w, h, ch) => {
        for (let row = y; row < y + h; row++) {
            for (let col = x; col < x + w; col++) {
                if (row >= 0 && row < height && col >= 0 && col < width) tiles[row][col] = ch;
            }
        }
    };

    /**
     * Fills a rectangle of the background wall layer.
     *
     * @param {number} x - Left column.
     * @param {number} y - Top row.
     * @param {number} w - Width in cells.
     * @param {number} h - Height in cells.
     * @param {string} ch - Tile character, "." to clear.
     * @returns {void}
     */
    const back = (x, y, w, h, ch) => {
        for (let row = y; row < y + h; row++) {
            for (let col = x; col < x + w; col++) {
                if (row >= 0 && row < height && col >= 0 && col < width) background[row][col] = ch;
            }
        }
    };

    /**
     * Places a decoration.
     *
     * @param {string} variant - Decoration name.
     * @param {number} x - Left column.
     * @param {number} y - Top row.
     * @returns {string} The object id.
     */
    const decor = (variant, x, y) => put("decor", x, y, { variant });

    /**
     * Places an object.
     *
     * @param {string} type - Object type.
     * @param {number} x - Column.
     * @param {number} y - Row.
     * @param {Record<string, *>} [props] - Extra properties.
     * @returns {string} The object id.
     */
    const put = (type, x, y, props = {}) => {
        const id = `${type}-${nextId++}`;
        entities.push({ id, type, x, y, ...props });
        return id;
    };

    /**
     * Places a line of spikes.
     *
     * @param {number} x - First column.
     * @param {number} y - First row.
     * @param {number} count - Number of cells.
     * @param {string} [dir="up"] - Direction the spikes point.
     * @returns {void}
     */
    const spikes = (x, y, count, dir = "up") => {
        const across = dir === "up" || dir === "down";
        for (let i = 0; i < count; i++) put("spike", across ? x + i : x, across ? y : y + i, { dir });
    };

    /**
     * Builds solids, hazards and marks for the reachability search and runs
     * it in stages: a reachable key opens a door, a group of reachable touch
     * switches slides its gates, and a dash block next to reachable space is
     * broken, then the search runs again until nothing changes.
     *
     * @param {{ debug?: boolean }} [options] - Print the reached area as text when debug is set.
     * @returns {boolean} True when every mark is reachable.
     */
    const check = (options = {}) => {
        const opened = new Set();
        const keysUsed = new Set();
        const groups = new Set();
        const broken = new Set();
        let reach = null;
        let grid = null;
        let marks = [];
        const near = (x, y) => {
            const gx = Math.floor(x / CELL) - grid.x0;
            const gy = Math.floor(y / CELL) - grid.y0;
            for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (reach.has((gy + dy) * grid.w + gx + dx)) return true;
            return false;
        };
        for (let pass = 0; pass < 12; pass++) {
            const solids = [];
            const hazards = [];
            const crystals = [];
            const springs = [];
            marks = [];
            let start = null;
            tiles.forEach((row, y) => row.forEach((ch, x) => {
                if (ch !== ".") solids.push([x * TILE, y * TILE, TILE, TILE]);
            }));
            for (const entity of entities) {
                const x = entity.x * TILE;
                const y = entity.y * TILE;
                if (entity.type === "spike") {
                    const [ox, oy, w, h] = SPIKE_RECT[entity.dir];
                    hazards.push([x + ox, y + oy, w, h]);
                } else if (entity.type === "crumble" || entity.type === "falling") {
                    solids.push([x, y, TILE, TILE]);
                } else if (entity.type === "zipMover") {
                    const steps = Math.max(Math.abs(entity.dx), Math.abs(entity.dy), 1);
                    for (let i = 0; i <= steps; i++) {
                        solids.push([x + Math.round(entity.dx * i / steps) * TILE, y + Math.round(entity.dy * i / steps) * TILE + TILE - 64, 98, 64]);
                    }
                } else if (entity.type === "crystal") {
                    crystals.push([x + 25, y + 25]);
                } else if (entity.type === "spring") {
                    springs.push([x, y, entity.dir]);
                } else if (entity.type === "door" && !opened.has(entity.id)) {
                    solids.push([x, y, TILE, entity.h * TILE]);
                } else if (entity.type === "gate") {
                    const shift = groups.has(entity.group) ? [entity.dx * TILE, entity.dy * TILE] : [0, 0];
                    solids.push([x + shift[0], y + shift[1], entity.w * TILE, entity.h * TILE]);
                } else if (entity.type === "dashBlock" && !broken.has(entity.id)) {
                    solids.push([x, y, entity.w * TILE, entity.h * TILE]);
                } else if (entity.type === "dustBunny") {
                    for (let t = 0; t <= 1; t += 0.25) hazards.push([x + 9 + entity.dx * TILE * t, y + 9 + entity.dy * TILE * t, 32, 32]);
                } else if (entity.type === "spawn") {
                    start = [x + 25, y + TILE - 4];
                } else if (entity.type === "checkpoint" || entity.type === "goal" || entity.type === "strawberry") {
                    marks.push({ label: `${entity.type} ${entity.x},${entity.y}`, x: x + 25, y: entity.type === "strawberry" ? y + 25 : y + TILE - 4 });
                }
            }
            grid = makeGrid(solids, hazards, { left: 0, top: 0, right: width * TILE, bottom: height * TILE });
            reach = search(grid, start, { dash: true, crystals, springs });
            let changed = false;
            const keys = entities.filter((entity) => entity.type === "key" && !keysUsed.has(entity.id) && near(entity.x * TILE + 25, entity.y * TILE + 25));
            for (const door of entities.filter((entity) => entity.type === "door" && !opened.has(entity.id))) {
                const touchable = [-1, 1].some((side) => Array.from({ length: door.h }, (_, i) => i).some((i) => near((door.x + side) * TILE + 25, (door.y + i) * TILE + 45)));
                if (touchable && keys.length) {
                    keysUsed.add(keys.shift().id);
                    opened.add(door.id);
                    changed = true;
                }
            }
            const switchGroups = new Set(entities.filter((entity) => entity.type === "touchSwitch").map((entity) => entity.group));
            for (const group of switchGroups) {
                if (groups.has(group)) continue;
                const all = entities.filter((entity) => entity.type === "touchSwitch" && entity.group === group);
                if (all.every((entity) => near(entity.x * TILE + 25, entity.y * TILE + 25))) {
                    groups.add(group);
                    changed = true;
                }
            }
            for (const block of entities.filter((entity) => entity.type === "dashBlock" && !broken.has(entity.id))) {
                let touchable = false;
                for (let i = -1; i <= block.w && !touchable; i++) for (let j = -1; j <= block.h && !touchable; j++) {
                    const edge = i === -1 || j === -1 || i === block.w || j === block.h;
                    if (edge && near((block.x + i) * TILE + 25, (block.y + j) * TILE + 45)) touchable = true;
                }
                if (touchable) {
                    broken.add(block.id);
                    changed = true;
                }
            }
            if (!changed) break;
        }
        if (options.debug) {
            const marked = new Map(entities.filter((entity) => entity.type !== "decor").map((entity) => [`${entity.x},${entity.y}`, SYMBOL[entity.type] || "?"]));
            for (let y = 0; y < height; y++) {
                let line = "";
                for (let x = 0; x < width; x++) {
                    const mark = marked.get(`${x},${y}`);
                    let reached = false;
                    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) reached ||= reach.has((y * 2 + sy - grid.y0) * grid.w + x * 2 + sx - grid.x0);
                    line += mark ?? (tiles[y][x] !== "." ? "#" : reached ? "+" : ".");
                }
                console.log(`${String(y).padStart(2)} ${line}`);
            }
        }
        let ok = true;
        for (const mark of marks) {
            const hit = near(mark.x, mark.y);
            console.log(`${mark.label}: ${hit ? "reachable" : "NOT reachable"}`);
            if (!hit) ok = false;
        }
        return ok;
    };

    /**
     * Assembles the level file.
     *
     * @param {Record<string, *>} meta - id, name, author and settings.
     * @returns {*} Level data in the editor format.
     */
    const toLevel = (meta) => ({
        format: "celeste-remake-level",
        version: 1,
        ...meta,
        width,
        height,
        tiles: tiles.map((row) => row.join("")),
        background: background.map((row) => row.join("")),
        entities,
        events
    });

    /**
     * Writes the level file.
     *
     * @param {URL} url - Output file.
     * @param {Record<string, *>} meta - id, name, author and settings.
     * @returns {void}
     */
    const save = (url, meta) => {
        fs.mkdirSync(new URL(".", url), { recursive: true });
        fs.writeFileSync(url, `${JSON.stringify(toLevel(meta), null, 1)}\n`);
        console.log(`wrote ${url.pathname}: ${entities.length} objects, ${events.length} events`);
    };

    return { width, height, tiles, background, entities, events, rect, back, put, decor, spikes, check, toLevel, save };
}
