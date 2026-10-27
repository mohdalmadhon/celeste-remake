/**
 * Left edge of the Forsaken City map in world pixels.
 *
 * @type {number}
 */
export const CITY_ORIGIN_X = -50;

/**
 * Top edge of the Forsaken City map in world pixels.
 *
 * @type {number}
 */
export const CITY_ORIGIN_Y = -3100;

/**
 * Top-left corners of the crumbling girders, aligned to the map grid.
 *
 * @type {ReadonlyArray<[number, number]>}
 */
export const CITY_CRUMBLES = Object.freeze([[3300, -1100], [3450, -1200], [3300, -1250], [3450, -1350]]);

/**
 * Forsaken City terrain on a 50 pixel grid, aligned from the original level,
 * with the space the player can never reach filled in as solid rock.
 *
 * Legend: "i" ice, "d" dirt, "s" snowy dirt, "g" steel girder, "b" stone
 * beam, "^" "v" "<" ">" spikes pointing up, down, left and right.
 *
 * @returns {string[]} Map rows, top to bottom, starting at CITY_ORIGIN_Y.
 */
export function buildCityMap() {
    return [
        "...............................................................................",
        "...............................................................................",
        "...............................................................................",
        "..................................................................ggggggg......",
        "..................................................................iiiiiii......",
        "..................................................................iiiiiii......",
        "..................................................................g..iiii......",
        "........................................................................i......",
        "........................................................................i......",
        "........................................................................i......",
        "........................................................................i......",
        ".......................................................bbbbbbbbbbbbbbbb.b...bb.",
        ".................................................iiiiiiiiiiiiiiiiiiiiii.b......",
        "................................................g............gdddg.iiii.b......",
        "................................................g............gdddg.iiii.b......",
        "................................................g............gdddg..iii.b......",
        "................................................ggg..........ggggg..iii.b......",
        ".................................................ii....^^...........<ii.b......",
        ".................................................ii....ii...........<ii.b......",
        ".................................................ii.................<ii.b......",
        ".................................................ii..............bb.<ii.b......",
        ".................................................ii..............bb.....b......",
        ".................................................ii..............bb.....b......",
        ".................................................ii..............bb.....b......",
        ".................................................ii..............bb....ib......",
        ".................................................ii...^......iiiibb.....b......",
        ".................................................ii^^^i..^^^^i....b.....b......",
        ".................................................iiiiii..iiiigbbbbb.....b......",
        ".................................................ii..........g...bg.....b......",
        ".................................................................bg.....i......",
        "................................................>.................g.....i......",
        "................................................>.................g.....b......",
        ".................................................^^iiii..iiiiiiii.iiiiiii......",
        "........................................................ii.....ii.i.....i......",
        "........................................................ii..............i......",
        "........................................................ii....ggg.......i......",
        ".......................................................ii......ii.......i......",
        ".......................................................ii.......i.......i......",
        "......................................................ii........i.......i......",
        "......................................................ii................i......",
        "......................................................ii................i......",
        "......................................................iiig..gigii.......i......",
        "............................................iiiiiiiiiiiiig..gigiiiiiiii^.......",
        "...........................................i.............i..gigiiiiiiiii.......",
        "..........................................i..............g..gig..gdddd..i......",
        "..........................................i..............g..<ig..gddddd.i......",
        "..........................................i.....ggg.........<ig..gddddddi......",
        "..........................................i....<g..g..........g..gggggggi......",
        "..........................................i....<g..g..........ddddddddddi......",
        "..........................................i.....g..g..........ddddddddddi......",
        "..........................................ig.......g....ddddddddddddddddi......",
        "..........................................ig.......g....ddddddddddddddddi......",
        ".........................ggggbbbgiiiiiibbbbg...iiii.^^^^^^^^^^^^^^^^^^ddd......",
        ".........................g..gb..giiiiii...bg...ii...ddddddddddddddddddddd......",
        "....................bbbbbgggg...g.........bg...ii...ddddddddddddddddddddd......",
        "....................b.....................bg...ii...ddddddddddddddddddddd......",
        "....................b......................g...ii...ddddddddddddddddddddd......",
        "....................b.............^^^..........ii...ddddddddddddddddddddd......",
        "....................b.............iii..........ii...ddddddddddddddddddddd......",
        "....................b........gg....i.....iiiiiiii...ddddddddddddddddddddd......",
        "....................b........gg....i..bb.iiiiiiiidddddddddddddddddddddddd......",
        "....................b...iiigggg...bbbbbiiiiiiiiiidddddddddddddddddddddddd......",
        "..igiiiddddgbbbbbbbbb...i....dd^^^bbddddddddddddddddddddddddddddddddddddd......",
        ".d.gg..dd..g............i....dddddddddddddddddddddddddddddddddddddddddddd......",
        ".d.gg..d...........iiiiii....dddddddddddddddddddddddddddddddddddddddddddd......",
        ".d.................iiiiiidddddddddddddddddddddddddddddddddddddddddddddddd......",
        ".g..........ggg......iiiddddddddddddddddddddddddddddddddddddddddddddddddd......",
        ".g..........ggg......iddddddddddddddddddddddddddddddddddddddddddddddddddd......",
        ".g...........ii.......ddddddddddddddddddddddddddddddddddddddddddddddddddd......",
        ".g.....ddd...iii^^^....dddddddddddddddddddddddddddddddddddddddddddddddddd......",
        "..sd...ddd^^^iiiiii.....ddddddddddddddddddddddddddddddddddddddddddddddddd......",
        "...d^^^dd.diiiiiiii.....ddddddddddddddddddddddddddddddddddddddddddddddddd......",
        "...dddd.ddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd......",
        ".dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd......",
        ".dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd......",
        ".dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd......",
        ".dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd......"
    ];
}
