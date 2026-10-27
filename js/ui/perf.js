import { settings } from "../core/settings.js";

/**
 * On-screen frame time overlay toggled with F3 or the settings menu.
 */
export class PerfOverlay {
    /** @type {HTMLElement} */
    root;
    /** @type {import("../core/loop.js").FrameStats} */
    stats;
    /** @type {number} */
    #timer = 0;

    /**
     * @param {HTMLElement} root - Overlay element.
     * @param {import("../core/loop.js").FrameStats} stats - Frame statistics source.
     */
    constructor(root, stats) {
        this.root = root;
        this.stats = stats;
        window.addEventListener("keydown", (event) => {
            if (event.code === "F3") {
                event.preventDefault();
                settings.showFps = !settings.showFps;
            }
        });
    }

    /**
     * Refreshes the overlay a few times per second.
     *
     * @param {number} dt - Frame time in seconds.
     * @param {number} entityCount - Number of live entities.
     * @returns {void}
     */
    update(dt, entityCount) {
        this.root.classList.toggle("hidden", !settings.showFps);
        if (!settings.showFps) return;
        this.#timer -= dt;
        if (this.#timer > 0) return;
        this.#timer = 0.25;
        const s = this.stats.summary();
        this.root.textContent =
            `FPS ${s.fps.toFixed(0)}\n` +
            `frame avg ${s.avg.toFixed(2)} ms\n` +
            `frame p95 ${s.p95.toFixed(2)} ms  max ${s.max.toFixed(1)}\n` +
            `work avg ${s.work.toFixed(2)} ms  max ${s.workMax.toFixed(1)}\n` +
            `long frames ${this.stats.longFrames}/${this.stats.totalFrames}\n` +
            `entities ${entityCount}`;
    }
}
