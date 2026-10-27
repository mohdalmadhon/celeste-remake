/**
 * Generates Chapter 4, The Shattered Spire, as a level file in the editor
 * format and checks that every checkpoint, strawberry and the goal can be
 * reached with Madeline's movement before writing it.
 *
 * The spire is a ruined stone tower inside the mountain. Every part has a
 * puzzle as well as a challenge:
 *
 * - the gallery: crumbling stones over spikes, and a key hidden in a
 *   pocket of the ceiling that only a dash from a crystal reaches; the key
 *   opens the door to the shaft;
 * - the shaft: falling footholds, springs on the walls and a floor of
 *   rubble that has to be dashed through from below;
 * - the corridor: four touch switches spread over a collapsing bridge and
 *   dust bunnies, which lower the gate at the far end;
 * - the crystal well: a climb between spiked walls on dash crystals;
 * - the ridge: out in the open with a headwind, snowballs, a seeker and a
 *   wall of rubble before the flag.
 *
 * Usage: node tools/build_spire.mjs [--check-only] [--debug]
 */
import { createLevel } from "./levelkit.mjs";

const OUT = new URL("../js/data/levels/shattered-spire.json", import.meta.url);
const W = 80;
const H = 64;
const L = createLevel(W, H, "d");
const { rect, back, put, decor, spikes, events } = L;
const fall = { trigger: "touch", lands: false };

/**
 * Carves a room out of the rock with a stone wall behind it.
 *
 * @param {number} x - Left column.
 * @param {number} y - Top row.
 * @param {number} w - Width in cells.
 * @param {number} h - Height in cells.
 * @returns {void}
 */
function room(x, y, w, h) {
    rect(x, y, w, h, ".");
    back(x, y, w, h, "b");
}

room(1, 50, 60, 12);
put("spawn", 3, 61);
put("checkpoint", 7, 61);
decor("lantern", 5, 52);
decor("chain", 18, 50);
spikes(10, 61, 15);
for (const col of [12, 16, 20]) put("crumble", col, 58);
rect(25, 55, 3, 7, "b");
spikes(24, 57, 4, "left");
spikes(28, 61, 18);
put("crystal", 32, 53);
put("crystal", 39, 52);
put("strawberry", 36, 51);
room(30, 43, 5, 7);
rect(30, 43, 5, 1, "d");
put("key", 32, 45);
decor("icicles", 31, 44);
spikes(30, 47, 2, "right");
rect(46, 56, 4, 6, "b");
put("checkpoint", 54, 61);
decor("lantern", 56, 53);

room(61, 58, 1, 4);
put("door", 61, 58, { h: 4 });

room(62, 22, 7, 40);
put("checkpoint", 65, 61);
put("falling", 63, 57, fall);
put("falling", 67, 54, fall);
put("spring", 62, 50, { dir: "right" });
spikes(68, 47, 4, "left");
put("falling", 64, 47, fall);
put("spring", 68, 43, { dir: "left" });
spikes(62, 41, 4, "right");
put("dashBlock", 62, 38, { w: 7, h: 1 });
put("crystal", 65, 35);
put("falling", 63, 32, fall);
put("falling", 67, 29, fall);
spikes(68, 31, 3, "left");
rect(62, 26, 3, 1, "b");
put("strawberry", 67, 24);
decor("chain", 65, 22);

room(14, 20, 48, 12);
rect(61, 22, 1, 4, ".");
put("checkpoint", 58, 25);
rect(56, 26, 6, 6, "b");
spikes(14, 31, 42);
const bridge = [];
for (const col of [53, 50, 47, 44, 41, 38, 35, 32, 29, 26, 23, 20, 17]) bridge.push(put("falling", col, 28, fall));
put("dustBunny", 46, 23, { dx: 0, dy: 4, speed: 1.5 });
put("dustBunny", 36, 27, { dx: 0, dy: -5, speed: 1.4 });
put("dustBunny", 24, 22, { dx: 5, dy: 0, speed: 1.2 });
put("touchSwitch", 51, 21, { group: 1 });
put("touchSwitch", 41, 25, { group: 1 });
put("touchSwitch", 30, 21, { group: 1 });
put("touchSwitch", 19, 24, { group: 1 });
put("crystal", 34, 23);
decor("lantern", 44, 20);
decor("lantern", 27, 20);
rect(12, 20, 2, 12, ".");
put("gate", 12, 20, { w: 2, h: 12, dx: 0, dy: 12, group: 1 });
rect(12, 32, 2, 12, ".");
back(12, 32, 2, 12, "b");

room(2, 20, 10, 12);
put("checkpoint", 6, 31);
room(2, 3, 8, 18);
spikes(2, 6, 14, "right");
spikes(9, 8, 12, "left");
put("crystal", 6, 26);
put("crystal", 6, 21);
put("crystal", 6, 16);
put("crystal", 5, 11);
rect(3, 23, 2, 1, "b");
rect(7, 23, 2, 1, "b");
decor("chain", 4, 3);

rect(10, 0, 70, 13, ".");
rect(10, 0, 70, 1, "b");
rect(10, 8, 1, 5, "b");
put("checkpoint", 12, 12);
spikes(14, 12, 10);
rect(24, 10, 3, 3, "b");
put("spring", 25, 9, { dir: "up" });
spikes(27, 12, 10);
put("crumble", 30, 9);
rect(37, 9, 2, 4, "b");
put("dashBlock", 41, 1, { w: 2, h: 11 });
rect(41, 12, 2, 1, "b");
put("crystal", 33, 6);
spikes(43, 12, 11);
put("seeker", 50, 6, { speed: 0.9 });
rect(46, 9, 2, 1, "b");
rect(54, 8, 3, 5, "b");
put("crystal", 51, 3);
put("strawberry", 47, 2);
spikes(57, 12, 6);
put("crumble", 59, 9);
rect(63, 12, 17, 1, "d");
put("goal", 74, 11);
decor("flags", 64, 7);
decor("cairn", 70, 11);
decor("memorial", 77, 10);
decor("rock", 66, 11);

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
    id: "ev-key", name: "Locked", once: true,
    trigger: { type: "enter", x: 57, y: 56, w: 3, h: 6 },
    actions: [{ type: "toast", text: "spire.toast.key" }]
});
events.push({
    id: "ev-shaft", name: "Footholds", once: true,
    trigger: { type: "enter", x: 62, y: 56, w: 7, h: 6 },
    actions: [{ type: "toast", text: "spire.toast.footholds" }]
});
events.push({
    id: "ev-switches", name: "Switches", once: true,
    trigger: { type: "enter", x: 56, y: 20, w: 2, h: 6 },
    actions: [{ type: "toast", text: "spire.toast.switches" }]
});
events.push({
    id: "ev-bridge", name: "Bridge gives way", once: true,
    trigger: { type: "enter", x: 52, y: 20, w: 2, h: 12 },
    actions: [{ type: "shake", strength: 4, duration: 0.5 }, { type: "toast", text: "spire.toast.bridge" }]
});
events.push({
    id: "ev-wind", name: "Headwind", once: true,
    trigger: { type: "enter", x: 15, y: 0, w: 3, h: 12 },
    actions: [
        { type: "weather", preset: "blizzard" },
        { type: "wind", strength: -130 },
        { type: "snowballs", on: true, interval: 2.2, from: "right" },
        { type: "dialogue", lines: [{ speaker: "badeline", emotion: "deadpan", text: "spire.wind.1" }, { speaker: "madeline", emotion: "determined", text: "spire.wind.2" }] }
    ]
});
events.push({
    id: "ev-calm", name: "Calm before the top", once: true,
    trigger: { type: "enter", x: 63, y: 0, w: 2, h: 12 },
    actions: [{ type: "wind", strength: 0 }, { type: "snowballs", on: false, interval: 2.2, from: "right" }, { type: "weather", preset: "snow" }]
});

rect(0, H - 1, W, 1, "b");

const ok = L.check({ debug: process.argv.includes("--debug") });
if (!ok) {
    console.error("the spire cannot be finished; nothing written");
    process.exit(1);
}
if (!process.argv.includes("--check-only")) {
    L.save(OUT, {
        id: "shattered-spire",
        name: "The Shattered Spire",
        author: "Celeste Remake",
        settings: { theme: "summit", weather: "heavy", music: "anxiety", timeLimit: 1080, lives: 35, dashes: 1 }
    });
}
