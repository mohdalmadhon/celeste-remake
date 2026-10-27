/**
 * Generates Chapter 4, The Shattered Spire, as a level file in the editor
 * format and checks that every checkpoint, strawberry and the goal can be
 * reached with Madeline's movement before writing it.
 *
 * The spire is carved out of solid rock: a long spike gallery at the bottom,
 * a shaft of crumbling footholds on the right, a corridor of dust bunnies
 * and a collapsing bridge back to the left, a crystal shaft straight up and
 * a windy ridge along the top to the summit flag.
 *
 * Usage: node tools/build_spire.mjs [--check-only]
 */
import fs from "node:fs";
import { CELL, makeGrid, search } from "./reachability.mjs";

const W = 72;
const H = 62;
const TILE = 50;
const OUT = new URL("../js/data/levels/shattered-spire.json", import.meta.url);

const tiles = Array.from({ length: H }, () => Array(W).fill("d"));
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
function rect(x, y, w, h, ch) {
    for (let row = y; row < y + h; row++) {
        for (let col = x; col < x + w; col++) {
            if (row >= 0 && row < H && col >= 0 && col < W) tiles[row][col] = ch;
        }
    }
}

/**
 * Places an object.
 *
 * @param {string} type - Object type.
 * @param {number} x - Column.
 * @param {number} y - Row.
 * @param {Record<string, *>} [props] - Extra properties.
 * @returns {string} The object id.
 */
function put(type, x, y, props = {}) {
    const id = `${type}-${nextId++}`;
    entities.push({ id, type, x, y, ...props });
    return id;
}

/**
 * Places a row of spikes.
 *
 * @param {number} x - First column.
 * @param {number} y - Row.
 * @param {number} count - Number of cells.
 * @param {string} dir - Direction the spikes point.
 * @returns {void}
 */
function spikes(x, y, count, dir = "up") {
    for (let i = 0; i < count; i++) put("spike", dir === "up" || dir === "down" ? x + i : x, dir === "up" || dir === "down" ? y : y + i, { dir });
}

rect(1, 46, 56, 12, ".");
put("spawn", 3, 57);
put("checkpoint", 8, 57);
spikes(11, 57, 13);
for (const col of [13, 17, 21]) put("crumble", col, 54);
rect(24, 50, 3, 8, "b");
spikes(23, 55, 3, "left");
spikes(26, 57, 17);
put("crystal", 31, 47);
put("crystal", 37, 46);
put("strawberry", 34, 47);
rect(43, 51, 4, 7, "b");
rect(47, 58, 10, 1, "d");
put("checkpoint", 52, 57);

rect(50, 20, 6, 27, ".");
rect(49, 46, 1, 1, "d");
spikes(50, 37, 6, "left");
spikes(55, 41, 4, "right");
put("falling", 51, 52, { trigger: "touch", lands: false });
put("falling", 54, 49, { trigger: "touch", lands: false });
put("falling", 51, 45, { trigger: "touch", lands: false });
put("falling", 55, 41, { trigger: "touch", lands: false });
put("falling", 51, 37, { trigger: "touch", lands: false });
rect(50, 33, 2, 1, "g");
put("falling", 54, 30, { trigger: "touch", lands: false });
put("falling", 51, 27, { trigger: "touch", lands: false });
spikes(55, 25, 5, "right");

rect(2, 20, 48, 12, ".");
put("checkpoint", 46, 31);
put("dustBunny", 41, 28, { dx: 0, dy: -4, speed: 1.6 });
put("dustBunny", 37, 24, { dx: 0, dy: 4, speed: 1.6 });
spikes(14, 31, 22);
const bridge = [];
for (const col of [33, 30, 27, 24, 21, 18, 15]) bridge.push(put("falling", col, 28, { trigger: "touch", lands: false }));
put("dustBunny", 26, 24, { dx: 6, dy: 0, speed: 1.2 });
put("strawberry", 22, 22);
rect(2, 29, 11, 3, ".");
put("checkpoint", 6, 31);

rect(2, 3, 8, 18, ".");
spikes(2, 6, 14, "right");
spikes(9, 8, 12, "left");
put("crystal", 6, 24);
put("crystal", 6, 19);
put("crystal", 6, 14);
put("crystal", 5, 9);
rect(3, 21, 2, 1, "g");
rect(7, 21, 2, 1, "g");
rect(10, 3, 60, 10, ".");
rect(10, 8, 1, 5, "b");
put("checkpoint", 12, 12);
spikes(14, 12, 10);
rect(24, 10, 3, 3, "b");
spikes(27, 12, 12);
rect(39, 9, 3, 4, "b");
put("crystal", 33, 8);
spikes(42, 12, 12);
rect(54, 8, 3, 5, "b");
put("crystal", 48, 7);
rect(57, 12, 13, 1, "d");
put("goal", 66, 11);

rect(0, 0, W, 1, "b");
rect(0, H - 1, W, 1, "b");

events.push({
    id: "ev-intro", name: "Arrival", once: true,
    trigger: { type: "start" },
    actions: [
        { type: "title", text: "chapter.spire.name", sub: "chapter.spire.subtitle" },
        { type: "wait", seconds: 1.2 },
        { type: "dialogue", lines: [{ speaker: "madeline", emotion: "determined", text: "spire.intro.1" }, { speaker: "madeline", emotion: "deadpan", text: "spire.intro.2" }] }
    ]
});
events.push({
    id: "ev-shaft", name: "Footholds", once: true,
    trigger: { type: "enter", x: 49, y: 50, w: 8, h: 8 },
    actions: [{ type: "toast", text: "spire.toast.footholds" }]
});
events.push({
    id: "ev-bridge", name: "Bridge gives way", once: true,
    trigger: { type: "enter", x: 34, y: 20, w: 3, h: 12 },
    actions: [{ type: "shake", strength: 4, duration: 0.5 }, { type: "toast", text: "spire.toast.bridge" }]
});
events.push({
    id: "ev-wind", name: "Headwind", once: true,
    trigger: { type: "enter", x: 15, y: 3, w: 3, h: 10 },
    actions: [
        { type: "weather", preset: "blizzard" },
        { type: "wind", strength: -130 },
        { type: "dialogue", lines: [{ speaker: "badeline", emotion: "deadpan", text: "spire.wind.1" }, { speaker: "madeline", emotion: "determined", text: "spire.wind.2" }] }
    ]
});
events.push({
    id: "ev-calm", name: "Calm before the top", once: true,
    trigger: { type: "enter", x: 57, y: 3, w: 2, h: 9 },
    actions: [{ type: "wind", strength: 0 }, { type: "weather", preset: "snow" }]
});

const level = {
    format: "celeste-remake-level",
    version: 1,
    id: "shattered-spire",
    name: "The Shattered Spire",
    author: "Celeste Remake",
    width: W,
    height: H,
    settings: { theme: "summit", weather: "heavy", music: "anxiety", timeLimit: 900, lives: 30, dashes: 1 },
    tiles: tiles.map((row) => row.join("")),
    entities,
    events
};

const solids = [];
const hazards = [];
const crystals = [];
const marks = [];
tiles.forEach((row, y) => row.forEach((ch, x) => {
    if (ch !== ".") solids.push([x * TILE, y * TILE, TILE, TILE]);
}));
const spikeRect = { up: [4, 26, 42, 24], down: [4, 0, 42, 24], left: [26, 4, 24, 42], right: [0, 4, 24, 42] };
let start = null;
for (const entity of entities) {
    const x = entity.x * TILE;
    const y = entity.y * TILE;
    if (entity.type === "spike") {
        const [ox, oy, w, h] = spikeRect[entity.dir];
        hazards.push([x + ox, y + oy, w, h]);
    } else if (entity.type === "crumble" || entity.type === "falling") {
        solids.push([x, y, TILE, TILE]);
    } else if (entity.type === "crystal") {
        crystals.push([x + 25, y + 25]);
    } else if (entity.type === "dustBunny") {
        for (let t = 0; t <= 1; t += 0.25) hazards.push([x + 9 + entity.dx * TILE * t, y + 9 + entity.dy * TILE * t, 32, 32]);
    } else if (entity.type === "spawn") {
        start = [x + 25, y + TILE - 4];
    } else if (entity.type === "checkpoint" || entity.type === "goal" || entity.type === "strawberry") {
        marks.push({ label: `${entity.type} ${entity.x},${entity.y}`, x: x + 25, y: entity.type === "strawberry" ? y + 25 : y + TILE - 4 });
    }
}
const grid = makeGrid(solids, hazards, { left: 0, top: 0, right: W * TILE, bottom: H * TILE });
const reach = search(grid, start, { dash: true, crystals });
if (process.argv.includes("--debug")) {
    const symbol = { spike: "^", crumble: "c", falling: "f", crystal: "*", dustBunny: "x", checkpoint: "C", goal: "G", strawberry: "S", spawn: "P" };
    const marked = new Map(entities.map((entity) => [`${entity.x},${entity.y}`, symbol[entity.type] || "?"]));
    for (let y = 0; y < H; y++) {
        let line = "";
        for (let x = 0; x < W; x++) {
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
    const gx = Math.floor(mark.x / CELL) - grid.x0;
    const gy = Math.floor(mark.y / CELL) - grid.y0;
    let hit = false;
    for (let dy = -1; dy <= 2 && !hit; dy++) for (let dx = -1; dx <= 1 && !hit; dx++) hit = reach.has((gy + dy) * grid.w + gx + dx);
    console.log(`${mark.label}: ${hit ? "reachable" : "NOT reachable"}`);
    if (!hit) ok = false;
}
if (!ok) {
    console.error("the spire cannot be finished; nothing written");
    process.exit(1);
}
if (!process.argv.includes("--check-only")) {
    fs.mkdirSync(new URL("../js/data/levels/", import.meta.url), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(level, null, 1)}\n`);
    console.log(`wrote ${OUT.pathname}: ${entities.length} objects, ${events.length} events`);
}
