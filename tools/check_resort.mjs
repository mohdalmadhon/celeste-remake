/**
 * Checks that the Celestial Resort chase can be finished: every checkpoint,
 * strawberry and the end of the chase must be reachable with Madeline's
 * movement. Oshiro, slamming doors and falling debris are left out, since
 * they only make the run faster, not longer.
 *
 * Usage: node tools/check_resort.mjs [--debug]
 */
import { buildOshiroMap } from "../js/levels/maps/oshiroMap.js";
import { createLevel } from "./levelkit.mjs";

const map = buildOshiroMap();
const H = map.rows.length;
const W = map.rows[0].length;
const L = createLevel(W, H, ".");
const SPIKES = { "^": "up", Y: "down", "<": "left", ">": "right" };
const SPRINGS = { s: "up", "{": "left", "}": "right" };

map.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === "#") L.rect(x, y, 1, 1, "w");
    else if (ch === "=") L.put("crumble", x, y);
    else if (ch === "~") L.put("falling", x, y);
    else if (ch === "d") L.put("dustBunny", x, y, { dx: 0, dy: 0 });
    else if (ch === "h") L.put("dustBunny", x - 2, y, { dx: 4, dy: 0 });
    else if (ch === "v") L.put("dustBunny", x, y - 1.5, { dx: 0, dy: 3 });
    else if (ch === "o") L.put("booster", x, y);
    else if (ch === "*") L.put("crystal", x, y);
    else if (ch === "S") L.put("strawberry", x, y);
    else if (ch === "C") L.put("checkpoint", x, y);
    else if (ch === "P") L.put("spawn", x, y);
    else if (ch === "E") L.put("goal", x, y);
    else if (ch === "B") L.put("dashBlock", x, y, { w: 1, h: 1 });
    else if (SPIKES[ch]) L.put("spike", x, y, { dir: SPIKES[ch] });
    else if (SPRINGS[ch]) L.put("spring", x, y, { dir: SPRINGS[ch] });
}));

if (!L.check({ debug: process.argv.includes("--debug") })) {
    console.error("the resort cannot be finished");
    process.exit(1);
}
