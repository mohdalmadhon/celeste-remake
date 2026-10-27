import { VIEW_HEIGHT, VIEW_WIDTH } from "../core/constants.js";
import { settings } from "../core/settings.js";
import { setPixelScale } from "../core/pixels.js";

/**
 * Scales the 1200x500 game stage to the window according to the display
 * scale setting: fit to the window, the largest whole multiple, or native size.
 *
 * @returns {number} Applied scale factor.
 */
export function applyDisplayScale() {
    const stage = document.getElementById("stage");
    const gameElem = document.getElementById("game");
    const guide = document.getElementById("controls-guide");
    const guideHeight = guide && !guide.classList.contains("hidden") ? guide.offsetHeight + 10 : 0;
    const availableWidth = window.innerWidth - 16;
    const availableHeight = window.innerHeight - guideHeight - 16;
    const fit = Math.min(availableWidth / VIEW_WIDTH, availableHeight / VIEW_HEIGHT);
    let scale = 1;
    if (settings.displayScale === "fit") scale = Math.max(0.4, fit);
    else if (settings.displayScale === "integer") scale = Math.max(1, Math.floor(fit));
    stage.style.width = `${Math.round(VIEW_WIDTH * scale)}px`;
    stage.style.height = `${Math.round(VIEW_HEIGHT * scale)}px`;
    gameElem.style.transform = scale === 1 ? "" : `scale(${scale})`;
    setPixelScale(scale);
    return scale;
}
