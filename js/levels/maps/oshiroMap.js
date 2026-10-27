import { TileCanvas } from "./tileCanvas.js";

/**
 * Builds the Celestial Resort chase map.
 *
 * Legend: "#" hotel wood, "=" crumbling floor that reforms, "~" floor that
 * collapses for good, "d" dust bunny, "h" horizontally drifting dust bunny,
 * "v" vertically drifting dust bunny, "x" ceiling debris, "D" bottom cell of
 * a slamming door, "o" booster, "*" dash crystal, "S" strawberry,
 * "C" checkpoint, "P" player start, "L" lamp, "O" Oshiro, "E" chase end,
 * "B" rubble to dash through, "s" spring, "{" and "}" springs on a wall
 * throwing left and right, "^" floor spikes and "Y" ceiling spikes.
 *
 * @returns {{ rows: string[], zones: Array<{ left: number, top: number, right: number, bottom: number }>, interiors: Array<[number, number, number, number]>, checkpoints: Record<string, [number, number]> }} Map rows in 50 pixel cells, camera zones and interior regions in cells.
 */
export function buildOshiroMap() {
    const W = 332;
    const H = 30;
    const m = new TileCanvas(W, H);

    m.rect(0, 18, 96, 2, "#");
    m.rect(0, 27, 108, 3, "#");
    m.rect(0, 18, 2, 12, "#");
    m.rect(22, 25, 4, 2, "#");
    m.set(5, 26, "P");
    m.set(18, 24, "O");
    for (const col of [8, 16, 28]) m.set(col, 20, "L");

    m.set(37, 26, "d");
    m.clear(40, 27, 3, 3);
    m.set(46, 20, "L");
    m.set(48, 19, "x");
    m.clear(50, 27, 3, 3);
    m.set(51, 22, "d");
    m.set(55, 26, "C");
    m.rect(64, 20, 1, 2, "#");
    m.set(64, 26, "D");
    m.rect(65, 20, 10, 3, "#");
    m.set(68, 26, "d");
    m.set(72, 26, "d");
    m.clear(76, 27, 4, 3);
    m.set(84, 19, "x");
    m.rect(80, 20, 1, 7, "B");
    m.rect(85, 25, 1, 2, "#");
    m.set(86, 22, "S");
    m.set(90, 20, "L");

    m.rect(96, 2, 2, 21, "#");
    m.rect(96, 2, 12, 2, "#");
    m.rect(106, 13, 2, 14, "#");
    m.rect(106, 4, 2, 4, "#");
    m.rect(103, 25, 3, 1, "#");
    m.rect(98, 23, 3, 1, "=");
    m.rect(103, 21, 3, 1, "#");
    m.rect(98, 19, 3, 1, "=");
    m.rect(102, 17, 4, 1, "#");
    m.set(99, 16, "*");
    m.rect(98, 15, 3, 1, "#");
    m.rect(101, 13, 5, 1, "=");
    m.rect(98, 11, 4, 1, "#");
    m.rect(104, 9, 2, 1, "#");
    m.set(100, 26, "C");

    m.rect(108, 2, 54, 2, "#");
    m.rect(108, 13, 8, 2, "#");
    m.set(110, 12, "C");
    m.rect(116, 13, 8, 1, "~");
    m.rect(124, 13, 4, 2, "#");
    m.set(127, 10, "o");
    m.rect(136, 13, 6, 2, "#");
    m.set(139, 10, "h");
    m.rect(142, 13, 6, 1, "=");
    m.rect(148, 13, 13, 2, "#");
    m.set(150, 4, "x");
    m.rect(156, 9, 1, 4, "#");
    m.set(157, 6, "S");
    for (const col of [114, 126, 138, 150]) m.set(col, 4, "L");
    m.rect(160, 2, 2, 7, "#");

    m.rect(162, 13, 9, 3, "#");
    m.set(164, 12, "C");
    m.rect(175, 11, 8, 3, "#");
    m.rect(189, 12, 8, 3, "#");
    m.set(192, 9, "v");
    m.set(185, 8, "*");
    m.rect(197, 6, 2, 9, "#");
    m.rect(201, 13, 2, 3, "#");
    m.rect(203, 13, 4, 1, "=");
    m.rect(207, 13, 4, 3, "#");
    m.rect(215, 12, 11, 3, "#");

    m.rect(229, 12, 61, 3, "#");
    m.rect(231, 11, 52, 1, "^");
    m.rect(226, 27, 64, 3, "#");
    m.rect(289, 15, 1, 12, "#");
    m.set(230, 26, "C");
    m.set(234, 18, "L");
    m.set(238, 26, "D");
    m.rect(243, 15, 1, 12, "B");
    m.clear(248, 27, 6, 3);
    m.set(249, 27, "=");
    m.set(252, 27, "=");
    m.set(250, 18, "L");
    m.set(258, 25, "d");
    m.set(262, 21, "v");
    m.rect(266, 23, 4, 4, "#");
    m.rect(265, 15, 6, 1, "Y");
    m.set(264, 26, "s");
    m.set(268, 18, "S");
    m.rect(272, 27, 8, 1, "~");
    m.clear(272, 28, 8, 2);
    m.set(276, 18, "L");
    m.rect(280, 23, 1, 4, "#");
    m.clear(284, 12, 4, 3);
    m.set(285, 26, "s");
    m.set(286, 17, "*");

    m.rect(288, 12, 2, 3, "#");
    m.set(288, 11, "C");
    m.rect(292, 10, 3, 2, "#");
    m.set(296, 8, "=");
    m.set(298, 8, "=");
    m.rect(300, 7, 3, 1, "#");
    m.set(303, 4, "*");
    m.rect(306, 0, 1, 7, "B");
    m.rect(306, 7, 3, 1, "#");
    m.set(311, 3, "h");
    m.set(313, 6, "=");
    m.set(315, 6, "=");
    m.rect(317, 6, 1, 1, "#");
    m.set(317, 5, "}");
    m.rect(320, 5, 12, 3, "#");
    m.rect(330, 0, 2, 5, "#");
    m.set(321, 4, "E");

    return {
        rows: m.toRows(),
        zones: [
            { left: 95 * 50, top: 2 * 50, right: 108 * 50, bottom: 30 * 50 },
            { left: 0, top: 18 * 50, right: 96 * 50, bottom: 30 * 50 },
            { left: 108 * 50, top: 2 * 50, right: 162 * 50, bottom: 15 * 50 },
            { left: 160 * 50, top: -2 * 50, right: 229 * 50, bottom: 16 * 50 },
            { left: 226 * 50, top: 12 * 50, right: 290 * 50, bottom: 30 * 50 },
            { left: 284 * 50, top: -2 * 50, right: 332 * 50, bottom: 15 * 50 }
        ],
        interiors: [[0, 0, 162, 30], [226, 12, 64, 18]],
        checkpoints: {}
    };
}
