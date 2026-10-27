import { TileCanvas } from "./tileCanvas.js";

/**
 * Builds the map of The Summit's Forgotten Echoes, climbed from the bottom up.
 *
 * Legend: "s" snow, "i" climbable ice, "k" rock, "^" floor spikes,
 * "V" icicles pointing down, "<" spikes on a wall facing left, ">" spikes
 * on a wall facing right, "=" crumbling ice, "f" block that falls when stood
 * on, "*" dash crystal, "o" booster, "S" strawberry, "C" checkpoint,
 * "P" start, "G" Granny's echo, "T" Theo's echo, "O" Oshiro's echo,
 * "B" where the doubt appears, "R" reconciliation spot, "F" summit flag.
 *
 * @returns {{ rows: string[], zones: Array<{ left: number, top: number, right: number, bottom: number }>, windRows: [number, number] }} Map rows in 50 pixel cells, camera zones and the rows affected by wind.
 */
export function buildSummitMap() {
    const W = 48;
    const H = 112;
    const m = new TileCanvas(W, H);
    m.rect(0, 0, 2, H, "k");
    m.rect(46, 0, 2, H, "k");

    m.rect(2, 109, 44, 3, "s");
    m.set(4, 108, "P");
    m.set(12, 108, "G");
    m.rect(16, 107, 4, 2, "s");
    m.rect(23, 105, 4, 4, "s");
    m.rect(30, 98, 2, 11, "i");
    m.rect(27, 102, 2, 1, "s");
    m.set(28, 99, "*");
    m.rect(32, 98, 7, 2, "s");
    m.set(35, 97, "C");
    m.rect(40, 96, 6, 2, "s");
    m.rect(36, 94, 4, 1, "s");
    m.rect(41, 92, 5, 1, "s");
    m.rect(33, 90, 5, 1, "s");

    m.rect(2, 89, 31, 1, "k");
    m.rect(2, 88, 31, 1, "^");
    m.rect(37, 87, 4, 1, "s");
    m.rect(30, 86, 5, 1, "s");
    m.rect(23, 86, 5, 1, "=");
    m.rect(16, 86, 5, 1, "s");
    m.rect(9, 86, 5, 1, "s");
    m.rect(2, 86, 6, 1, "s");
    m.set(19, 81, "S");
    m.rect(18, 77, 3, 1, "V");
    m.rect(17, 76, 5, 1, "k");
    m.rect(7, 84, 5, 1, "s");
    m.rect(3, 82, 5, 1, "s");
    m.rect(7, 80, 5, 1, "s");
    m.rect(3, 78, 5, 1, "s");

    m.rect(2, 76, 11, 2, "s");
    m.set(5, 75, "C");
    m.set(9, 75, "T");
    m.rect(14, 62, 2, 15, "i");
    m.set(12, 68, "*");
    m.rect(12, 72, 2, 1, "s");
    m.rect(16, 68, 2, 1, "s");
    m.set(19, 66, "o");
    m.set(20, 61, "*");
    m.rect(24, 58, 2, 14, "i");
    m.rect(22, 70, 2, 1, "s");
    m.rect(23, 65, 1, 2, "<");
    m.rect(28, 62, 9, 2, "s");
    m.rect(38, 60, 4, 1, "f");
    m.rect(42, 58, 4, 2, "s");

    m.rect(2, 58, 38, 1, "k");
    m.rect(9, 57, 3, 1, "^");
    m.rect(20, 57, 3, 1, "^");
    m.set(40, 57, "O");
    m.set(44, 57, "C");
    m.set(35, 54, "o");
    m.set(27, 51, "o");
    m.set(19, 48, "o");
    m.set(11, 45, "*");
    m.rect(2, 42, 8, 2, "s");
    m.set(4, 41, "C");
    m.set(7, 41, "B");
    m.set(38, 47, "S");
    m.rect(36, 48, 4, 1, "s");

    m.rect(11, 40, 7, 1, "s");
    m.rect(19, 38, 7, 1, "s");
    m.rect(27, 36, 6, 1, "s");
    m.rect(34, 34, 7, 1, "s");
    m.rect(42, 24, 2, 10, "i");
    m.rect(41, 30, 1, 1, "<");
    m.rect(39, 30, 2, 1, "s");
    m.set(39, 27, "*");
    m.rect(34, 24, 10, 1, "s");
    m.rect(26, 22, 6, 1, "s");
    m.rect(18, 20, 7, 1, "s");
    m.rect(11, 18, 6, 1, "=");
    m.rect(2, 16, 13, 2, "s");
    m.set(5, 15, "C");
    m.set(9, 15, "R");

    m.rect(18, 14, 2, 1, "s");
    m.rect(22, 12, 4, 1, "i");
    m.rect(27, 11, 2, 1, "s");
    m.rect(31, 9, 5, 1, "i");
    m.rect(36, 7, 2, 1, "s");
    m.rect(36, 4, 10, 2, "s");
    m.rect(40, 6, 4, 1, "s");
    m.set(42, 3, "F");

    return {
        rows: m.toRows(),
        zones: [],
        windRows: [77, 90]
    };
}
