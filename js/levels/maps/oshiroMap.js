import { TileCanvas } from "./tileCanvas.js";

/**
 * Builds the Celestial Resort chase map.
 *
 * Legend: "#" hotel wood, "=" crumbling floor that reforms, "~" floor that
 * collapses for good, "d" dust bunny, "h" horizontally drifting dust bunny,
 * "v" vertically drifting dust bunny, "x" ceiling debris, "D" bottom cell of
 * a slamming door, "o" booster, "*" dash crystal, "S" strawberry,
 * "C" checkpoint, "P" player start, "L" lamp, "O" Oshiro, "E" chase end.
 *
 * @returns {{ rows: string[], zones: Array<{ left: number, top: number, right: number, bottom: number }>, interiors: Array<[number, number, number, number]>, checkpoints: Record<string, [number, number]> }} Map rows in 50 pixel cells, camera zones and interior regions in cells.
 */
export function buildOshiroMap() {
    const W = 236;
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
    m.rect(215, 12, 21, 3, "#");
    m.rect(233, 2, 3, 10, "#");
    m.set(222, 11, "E");

    return {
        rows: m.toRows(),
        zones: [
            { left: 95 * 50, top: 2 * 50, right: 108 * 50, bottom: 30 * 50 },
            { left: 0, top: 18 * 50, right: 96 * 50, bottom: 30 * 50 },
            { left: 108 * 50, top: 2 * 50, right: 162 * 50, bottom: 15 * 50 },
            { left: 160 * 50, top: -2 * 50, right: 236 * 50, bottom: 16 * 50 }
        ],
        interiors: [[0, 0, 162, 30]],
        checkpoints: {}
    };
}
