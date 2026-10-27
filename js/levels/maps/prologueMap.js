import { TileCanvas } from "./tileCanvas.js";

/**
 * Left edge of the Prologue map in world pixels.
 *
 * @type {number}
 */
export const PROLOGUE_ORIGIN_X = 0;

/**
 * Top edge of the Prologue map in world pixels.
 *
 * @type {number}
 */
export const PROLOGUE_ORIGIN_Y = -150;

/**
 * Builds the Prologue terrain on a 50 pixel grid.
 *
 * The layout follows the original level: the starting ledge, the column of
 * dirt, the overhang the snow block drops from, the climbing tower, the ice
 * steps, Granny's hill, the chasm under the bridge and the final cliff. Every
 * piece of ground now reaches the bottom of the screen so nothing floats,
 * and the gaps between them are clean pits.
 *
 * Legend: "s" snowy dirt, "d" dirt, "i" ice.
 *
 * @returns {string[]} Map rows, top to bottom, starting at PROLOGUE_ORIGIN_Y.
 */
export function buildPrologueMap() {
    const W = 146;
    const H = 19;
    const m = new TileCanvas(W, H);
    const row = (y) => (y - PROLOGUE_ORIGIN_Y) / 50;
    const ground = (from, to, top, ch) => m.rect(from, row(top), to - from + 1, H - row(top), ch);

    ground(0, 6, 350, "s");
    ground(7, 8, 300, "s");
    ground(11, 12, 350, "d");

    ground(14, 14, 400, "d");
    ground(15, 16, 300, "d");
    ground(17, 17, 400, "d");
    m.rect(16, row(50), 2, 2, "d");

    m.rect(19, 0, 7, row(0), "s");
    m.rect(19, row(0), 2, 1, "s");
    ground(19, 20, 350, "d");
    ground(22, 24, 300, "d");

    ground(27, 28, 400, "d");
    ground(30, 31, 350, "s");
    ground(32, 35, 250, "s");

    ground(37, 38, 400, "d");
    ground(41, 42, 400, "d");
    ground(44, 45, 400, "i");
    ground(46, 48, 150, "i");

    ground(51, 52, 300, "s");
    ground(55, 57, 350, "s");

    ground(60, 60, 400, "d");
    ground(61, 62, 150, "i");
    ground(63, 63, 250, "i");
    ground(64, 65, 300, "i");

    ground(68, 70, 450, "i");
    ground(71, 73, 400, "i");
    m.rect(70, row(50), 2, 4, "i");

    ground(76, 77, 450, "s");
    ground(78, 78, 400, "s");
    ground(79, 79, 350, "s");
    ground(80, 95, 300, "s");

    ground(140, 141, 350, "s");
    ground(142, 145, 300, "s");
    return m.toRows();
}
