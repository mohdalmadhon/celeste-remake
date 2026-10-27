/**
 * Generates Chapter 3, The Summit's Forgotten Echoes, as a level file and
 * checks that it can be finished: everything below the reconciliation with
 * one dash, everything above it with two.
 *
 * The climb, from the bottom: base camp with Granny's echo and an ice
 * pillar, a windy traverse where snowballs fly in, an ice cave lit by
 * lanterns where three touch switches lower the gate in the roof while a
 * seeker hunts, Oshiro's echo and a chain of boosters up to the doubt, the
 * chase, and the final two-dash ascent to the summit flag.
 *
 * Usage: node tools/build_summit.mjs [--check-only] [--debug]
 */
import { createLevel } from "./levelkit.mjs";

const OUT = new URL("../js/data/levels/summit-echoes.json", import.meta.url);
const W = 50;
const H = 130;
const L = createLevel(W, H, ".");
const { rect, back, put, decor, spikes, events } = L;
const touch = { trigger: "touch", lands: false };
const PEACE_ROW = 19;

/**
 * Background cliff with a ragged top edge.
 *
 * @param {number} x0 - Left column.
 * @param {number} w - Width in cells.
 * @param {number} top - Highest row the cliff reaches.
 * @param {number} bottom - Row below the cliff.
 * @param {number} seed - Shapes the ragged edge.
 * @returns {void}
 */
function cliff(x0, w, top, bottom, seed) {
    for (let x = x0; x < x0 + w; x++) {
        const edge = Math.min(x - x0, x0 + w - 1 - x);
        const rise = Math.min(bottom - top, Math.round(edge * 2.2 + ((x * 7 + seed) % 4)));
        back(x, bottom - rise, 1, rise, "s");
    }
}

rect(0, 126, 24, 4, "s");
rect(32, 126, 18, 4, "s");
rect(24, 128, 8, 2, "s");
spikes(24, 127, 8);
cliff(34, 16, 96, 126, 3);
cliff(0, 14, 112, 126, 1);
put("spawn", 2, 125);
put("marker", 9, 125, { name: "granny" });
decor("pine", 13, 123);
decor("pine", 19, 123);
decor("cairn", 5, 125);
decor("flags", 1, 121);
decor("memorial", 16, 124);
put("crumble", 26, 124);
put("crumble", 29, 123);
put("spring", 34, 125, { dir: "up" });
rect(38, 108, 2, 15, "i");
spikes(37, 112, 3, "left");
spikes(40, 115, 4, "right");
put("crystal", 33, 113);
put("strawberry", 28, 116);
rect(40, 108, 9, 1, "s");
put("checkpoint", 44, 107);
decor("snowman", 46, 106);

rect(33, 106, 3, 1, "i");
rect(24, 104, 3, 1, "s");
spikes(24, 105, 3, "down");
put("crumble", 19, 103);
put("crumble", 16, 103);
rect(8, 101, 5, 2, "s");
put("spring", 10, 100, { dir: "up" });
rect(13, 95, 4, 1, "s");
spikes(13, 96, 4, "down");
put("crumble", 19, 94);
put("crumble", 22, 93);
put("booster", 26, 91);
rect(30, 90, 9, 2, "s");
spikes(31, 89, 2);
put("checkpoint", 34, 89);
put("marker", 0, 91, { name: "wind-top" });
put("marker", 0, 107, { name: "wind-bottom" });
decor("flags", 6, 97);
decor("pine", 1, 98);

rect(0, 60, 50, 4, "d");
rect(0, 64, 6, 19, "d");
rect(44, 64, 6, 19, "d");
rect(0, 83, 50, 4, "d");
rect(36, 83, 4, 4, ".");
back(6, 64, 38, 19, "d");
cliff(26, 24, 30, 44, 5);
cliff(28, 22, 0, 12, 2);
put("marker", 41, 82, { name: "theo" });
put("checkpoint", 43, 82);
decor("lantern", 40, 78);
decor("lantern", 26, 66);
decor("lantern", 10, 70);
decor("icicles", 20, 64);
decor("icicles", 31, 64);
spikes(26, 82, 8);
rect(26, 79, 3, 1, "i");
put("touchSwitch", 23, 80, { group: 1 });
rect(18, 77, 4, 1, "i");
spikes(6, 82, 12);
put("touchSwitch", 8, 79, { group: 1 });
rect(6, 75, 4, 1, "i");
rect(12, 71, 3, 1, "i");
put("falling", 18, 70, touch);
put("crystal", 22, 68);
put("dashBlock", 28, 64, { w: 2, h: 7 });
put("strawberry", 31, 67);
rect(30, 70, 4, 1, "i");
rect(36, 75, 4, 1, "i");
rect(41, 70, 3, 1, "i");
put("touchSwitch", 42, 66, { group: 1 });
put("seeker", 20, 74, { speed: 0.85 });
rect(6, 60, 3, 4, ".");
put("gate", 6, 60, { w: 3, h: 2, dx: 0, dy: 6, group: 1 });

put("checkpoint", 2, 59);
put("marker", 12, 59, { name: "oshiro" });
put("booster", 16, 55);
put("booster", 21, 51);
put("booster", 26, 47);
rect(31, 44, 19, 2, "s");
put("checkpoint", 46, 43);
put("marker", 42, 43, { name: "doubt" });
decor("cairn", 48, 43);
decor("icicles", 32, 46);
decor("icicles", 44, 46);
decor("pine", 1, 57);
decor("bush", 20, 59);

rect(33, 41, 3, 1, "s");
put("crumble", 28, 39);
rect(20, 38, 4, 1, "i");
put("spring", 21, 37, { dir: "up" });
rect(13, 31, 5, 1, "s");
spikes(13, 32, 5, "down");
rect(9, 21, 2, 12, "i");
spikes(11, 26, 3, "right");
put("crystal", 15, 26);
rect(19, 25, 3, 1, "s");
put("crumble", 23, 22);
put("strawberry", 27, 20);
rect(0, PEACE_ROW + 1, 9, 2, "s");
put("checkpoint", 2, PEACE_ROW);
put("marker", 6, PEACE_ROW, { name: "peace" });
decor("memorial", 4, PEACE_ROW - 1);

rect(12, 17, 2, 1, "s");
spikes(14, 19, 8);
rect(14, 20, 8, 1, "s");
put("crumble", 23, 15);
rect(27, 13, 1, 6, "i");
spikes(28, 14, 4, "right");
put("crystal", 31, 11);
rect(34, 9, 2, 1, "i");
spikes(36, 11, 5);
rect(36, 12, 5, 1, "s");
put("spring", 41, 8, { dir: "left" });
rect(42, 4, 1, 6, "s");
rect(18, 7, 3, 1, "s");
put("falling", 22, 6, touch);
rect(25, 4, 6, 1, "s");
rect(32, 4, 10, 3, "s");
put("goal", 37, 3);
decor("flags", 32, 0);
decor("cairn", 33, 3);
decor("memorial", 40, 2);

events.push({
    id: "ev-snowballs", name: "Snowballs on the traverse", once: false,
    trigger: { type: "enter", x: 30, y: 96, w: 2, h: 12 },
    actions: [{ type: "snowballs", on: true, interval: 1.7, from: "left" }]
});
events.push({
    id: "ev-snowballs-stop", name: "Snowballs stop", once: false,
    trigger: { type: "enter", x: 30, y: 86, w: 5, h: 4 },
    actions: [{ type: "snowballs", on: false, interval: 1.7, from: "left" }]
});
events.push({
    id: "ev-snowballs-stop-low", name: "Snowballs stop at base", once: false,
    trigger: { type: "enter", x: 40, y: 100, w: 2, h: 8 },
    actions: [{ type: "snowballs", on: false, interval: 1.7, from: "left" }]
});

const debug = process.argv.includes("--debug");
const below = L.check({ debug, only: (mark) => mark.row >= PEACE_ROW });
const above = L.check({ start: [6, PEACE_ROW], dashes: 2, only: (mark) => mark.row < PEACE_ROW });
if (!below || !above) {
    console.error("the summit cannot be finished; nothing written");
    process.exit(1);
}
if (!process.argv.includes("--check-only")) {
    L.save(OUT, {
        id: "summit-echoes",
        name: "The Summit's Forgotten Echoes",
        author: "Celeste Remake",
        settings: { theme: "summit", weather: "blizzard", music: "golden", timeLimit: 840, lives: 20, dashes: 1 }
    });
}
