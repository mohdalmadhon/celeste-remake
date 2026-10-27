/**
 * Size of one physical screen pixel in game pixels. Positions are snapped to
 * this grid so movement is as fine as the display allows without blurring
 * pixel art between device pixels.
 *
 * @type {{ step: number }}
 */
export const pixelGrid = { step: 1 };

/**
 * Updates the snapping grid from the stage scale and the device pixel ratio.
 *
 * @param {number} scale - Stage scale factor applied to the game.
 * @returns {void}
 */
export function setPixelScale(scale) {
    const ratio = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const devicePixels = Math.max(1, scale * ratio);
    pixelGrid.step = 1 / devicePixels;
}

/**
 * Snaps a game-space coordinate to the nearest physical pixel.
 *
 * @param {number} value - Coordinate in game pixels.
 * @returns {number} Snapped coordinate rounded to two decimals.
 */
export function snapPixel(value) {
    const step = pixelGrid.step;
    const snapped = step === 1 ? Math.round(value) : Math.round(value / step) * step;
    return Math.round(snapped * 100) / 100;
}
