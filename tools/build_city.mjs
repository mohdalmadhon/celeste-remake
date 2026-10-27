/**
 * Generates Chapter 1, Forsaken City, as a level file and checks that every
 * checkpoint, strawberry and the lookout can be reached before writing it.
 *
 * The route runs left to right and climbs: a snowed-in street with a spring
 * up the first building, a construction site crossed on a zip cart under a
 * spiked girder, a brick tower climbed between spiked walls with a floor of
 * rubble to dash through, rooftops where a key has to be fetched from a
 * spiked alley to open a door, a scaffold where three touch switches open
 * the gate to the ridge, a windy ridge, a drop down a spiked shaft into an
 * old underpass crossed on a zip cart and through a rubble wall, and a
 * clock tower climbed on a rising cart and wall springs up to the lookout.
 *
 * Usage: node tools/build_city.mjs [--check-only] [--debug]
 */
import { createLevel } from "./levelkit.mjs";

const OUT = new URL("../js/data/levels/forsaken-city.json", import.meta.url);
const W = 230;
const H = 40;
const L = createLevel(W, H, ".");
const { rect, back, put, decor, spikes, events } = L;
const touch = { trigger: "touch", lands: false };

/**
 * Lit and dark windows on a background facade, in a grid.
 *
 * @param {number} x0 - Left column of the first window.
 * @param {number} y0 - Top row of the first window.
 * @param {number} columns - Windows across.
 * @param {number} rows - Windows down.
 * @param {number} seed - Picks which windows are lit.
 * @returns {void}
 */
function windows(x0, y0, columns, rows, seed) {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            const lit = ((c * 7 + r * 13 + seed) % 5) < 2;
            decor(lit ? "window" : "windowDark", x0 + c * 3, y0 + r * 3);
        }
    }
}

/**
 * Background scaffolding: girder posts every few columns joined by beams.
 *
 * @param {number} x0 - Left column.
 * @param {number} y0 - Top row.
 * @param {number} w - Width in cells.
 * @param {number} h - Height in cells.
 * @returns {void}
 */
function scaffold(x0, y0, w, h) {
    for (let x = x0; x < x0 + w; x += 7) back(x, y0, 1, h, "g");
    for (let y = y0; y < y0 + h; y += 6) back(x0, y, w, 1, "g");
}

back(0, 22, 13, 14, "b");
windows(1, 24, 4, 3, 1);
rect(0, 36, 13, 4, "s");
put("spawn", 2, 35);
decor("lamp", 6, 33);
decor("bench", 9, 35);
decor("sign", 11, 35);
rect(16, 36, 4, 4, "s");
decor("barrel", 16, 35);
put("spring", 18, 35, { dir: "up" });
rect(20, 29, 7, 11, "b");
spikes(19, 33, 3, "left");
decor("antenna", 24, 26);
decor("crate", 21, 28);
put("strawberry", 14, 30);
decor("flags", 9, 21);

scaffold(29, 16, 22, 24);
rect(30, 28, 2, 1, "g");
put("crumble", 34, 27);
put("crumble", 36, 27);
put("zipMover", 38, 28, { dx: 9, dy: 0 });
rect(38, 22, 13, 2, "g");
spikes(38, 24, 13, "down");
rect(42, 33, 2, 1, "g");
spikes(41, 33, 1, "left");
spikes(44, 33, 1, "right");
put("strawberry", 42, 32);
decor("chain", 40, 24);
decor("chain", 48, 24);
rect(50, 29, 6, 11, "b");
put("checkpoint", 52, 28);
decor("lamp", 50, 26);

rect(54, 6, 2, 19, "b");
rect(54, 29, 14, 11, "b");
rect(66, 11, 2, 18, "b");
rect(66, 0, 2, 8, "b");
rect(54, 0, 14, 6, "b");
back(56, 6, 10, 23, "b");
windows(57, 7, 3, 7, 3);
put("checkpoint", 58, 28);
spikes(56, 19, 6, "right");
spikes(65, 13, 5, "left");
rect(62, 25, 4, 1, "g");
put("falling", 57, 23, touch);
rect(63, 20, 3, 1, "g");
put("dashBlock", 56, 17, { w: 10, h: 1 });
put("crystal", 60, 14);
rect(56, 12, 3, 1, "g");
put("falling", 61, 10, touch);
rect(63, 9, 3, 1, "g");
decor("lantern", 59, 6);
decor("pipe", 64, 21);

rect(68, 11, 6, 29, "b");
put("checkpoint", 70, 10);
decor("antenna", 72, 7);
rect(78, 13, 5, 27, "b");
decor("crate", 79, 12);
decor("rail", 80, 12);
rect(87, 12, 11, 28, "b");
rect(83, 30, 4, 1, "g");
put("key", 85, 29);
put("spring", 83, 29, { dir: "up" });
rect(86, 26, 1, 1, "g");
rect(83, 22, 1, 1, "g");
put("strawberry", 85, 22);
put("crystal", 85, 18);
rect(86, 16, 1, 1, "g");
spikes(83, 15, 3, "right");
back(83, 14, 4, 26, "b");
decor("pipe", 84, 17);
rect(90, 0, 8, 8, "b");
put("door", 93, 8, { h: 4 });
decor("billboard", 88, 9);
decor("lamp", 96, 9);

scaffold(99, 4, 22, 36);
put("checkpoint", 99, 11);
put("npc", 96, 11, { look: "theo", facing: "right" });
rect(98, 12, 3, 1, "g");
rect(104, 15, 2, 1, "g");
put("falling", 107, 18, touch);
put("touchSwitch", 104, 23, { group: 1 });
rect(102, 26, 5, 1, "g");
spikes(102, 25, 5, "up");
put("spring", 108, 26, { dir: "up" });
rect(107, 27, 3, 1, "g");
put("crystal", 111, 20);
rect(112, 10, 2, 1, "g");
put("touchSwitch", 113, 4, { group: 1 });
put("crumble", 115, 8);
rect(117, 14, 3, 1, "g");
put("spring", 119, 13, { dir: "left" });
rect(120, 6, 1, 17, "g");
put("touchSwitch", 118, 19, { group: 1 });
put("crystal", 116, 22);
rect(98, 0, 26, 2, "g");
spikes(105, 2, 6, "down");
put("gate", 121, 2, { w: 2, h: 10, dx: 0, dy: 8, group: 1 });
rect(121, 20, 2, 20, "g");
rect(123, 12, 1, 28, "g");
put("strawberry", 101, 20);

rect(124, 12, 5, 28, "s");
put("checkpoint", 126, 11);
decor("cairn", 127, 11);
put("crumble", 131, 11);
put("crumble", 134, 10);
rect(137, 10, 2, 30, "s");
spikes(137, 9, 2, "up");
put("crumble", 140, 8);
put("falling", 143, 9, touch);
rect(146, 7, 2, 1, "s");
rect(146, 8, 1, 32, "s");
decor("flags", 140, 3);
put("strawberry", 135, 5);
rect(150, 8, 4, 32, "s");
put("checkpoint", 151, 7);
decor("bush", 150, 7);
decor("sign", 152, 7);
rect(157, 8, 33, 14, "b");
back(154, 8, 3, 24, "b");
spikes(154, 13, 4, "right");
spikes(156, 19, 4, "left");
rect(154, 32, 36, 8, "b");
back(157, 22, 33, 10, "b");
windows(160, 23, 6, 1, 2);
put("checkpoint", 155, 31);
spikes(160, 31, 19);
put("zipMover", 157, 31, { dx: 14, dy: 0 });
put("strawberry", 166, 24);
rect(173, 30, 2, 2, "b");
put("dashBlock", 176, 22, { w: 1, h: 10 });
rect(178, 30, 3, 2, "b");
spikes(181, 31, 3);
decor("pipe", 170, 22);
decor("lantern", 179, 22);

rect(184, 8, 6, 24, ".");
back(184, 8, 6, 24, "b");
rect(190, 0, 1, 32, "b");
rect(184, 0, 1, 8, "b");
rect(203, 4, 1, 28, "b");
back(191, 0, 12, 32, "b");
windows(193, 3, 3, 9, 4);
put("checkpoint", 186, 31);
put("spring", 188, 31, { dir: "up" });
rect(185, 25, 2, 1, "g");
spikes(184, 20, 3, "right");
rect(186, 17, 4, 1, "g");
rect(190, 14, 1, 3, ".");
put("zipMover", 191, 31, { dx: 0, dy: -9 });
spikes(202, 23, 6, "left");
put("falling", 199, 20, touch);
put("spring", 202, 17, { dir: "left" });
rect(193, 15, 3, 1, "g");
put("crystal", 197, 11);
put("falling", 200, 9, touch);
put("dashBlock", 191, 6, { w: 12, h: 1 });
put("strawberry", 196, 3);
put("crumble", 201, 4);
rect(184, 0, 20, 1, "b");

rect(190, 32, 14, 8, "b");
rect(204, 8, 26, 32, "s");
decor("memorial", 212, 6);
decor("pine", 225, 5);
decor("bush", 208, 7);
decor("bench", 216, 7);
put("goal", 220, 7);

events.push({
    id: "ev-theo", name: "Theo on the roof", once: true,
    trigger: { type: "enter", x: 98, y: 8, w: 1, h: 4 },
    actions: [{
        type: "dialogue",
        lines: [
            { speaker: "theo", emotion: "excited", text: "city.theo.1" },
            { speaker: "madeline", emotion: "normal", text: "city.theo.2" },
            { speaker: "theo", emotion: "yolo", text: "city.theo.3" }
        ]
    }]
});
events.push({
    id: "ev-ridge", name: "Wind on the ridge", once: false,
    trigger: { type: "enter", x: 129, y: 2, w: 1, h: 10 },
    actions: [{ type: "weather", preset: "heavy" }, { type: "wind", strength: -110 }]
});
events.push({
    id: "ev-calm", name: "Calm before the ridge", once: false,
    trigger: { type: "enter", x: 125, y: 2, w: 1, h: 10 },
    actions: [{ type: "wind", strength: 0 }, { type: "weather", preset: "snow" }]
});
events.push({
    id: "ev-lookout", name: "Calm at the lookout", once: false,
    trigger: { type: "enter", x: 149, y: 0, w: 1, h: 8 },
    actions: [{ type: "wind", strength: 0 }, { type: "weather", preset: "snow" }]
});

const ok = L.check({ debug: process.argv.includes("--debug") });
if (!ok) {
    console.error("the city cannot be finished; nothing written");
    process.exit(1);
}
if (!process.argv.includes("--check-only")) {
    L.save(OUT, {
        id: "forsaken-city",
        name: "Forsaken City",
        author: "Celeste Remake",
        settings: { theme: "city", weather: "snow", music: "golden", timeLimit: 840, lives: 20, dashes: 1 }
    });
}
