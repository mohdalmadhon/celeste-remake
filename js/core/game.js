import { events } from "./events.js";

/**
 * Shared runtime context: the active level, camera, player and effect systems.
 *
 * Systems read from this object instead of importing each other, which keeps
 * the module graph free of circular runtime dependencies.
 */
export const game = {
    /** @type {import("../level.js").Level|null} */
    level: null,
    /** @type {import("../systems/camera.js").Camera|null} */
    camera: null,
    /** @type {import("../entities/player.js").Player|null} */
    player: null,
    /** @type {import("../systems/particles.js").ParticleSystem|null} */
    particles: null,
    /** @type {import("../systems/particles.js").AfterimagePool|null} */
    afterimages: null,
    /** @type {import("../systems/weather.js").Weather|null} */
    weather: null,
    /** @type {import("../systems/parallax.js").Parallax|null} */
    parallax: null,
    /** @type {HTMLElement|null} */
    container: null,
    /** @type {HTMLElement|null} */
    worldLayer: null,
    /** @type {"boot"|"menu"|"playing"|"paused"|"transition"|"over"} */
    state: "boot",
    /** @type {number} */
    freezeTimer: 0,
    /** @type {number} */
    time: 0,
    /** @type {boolean} */
    cutscene: false,
    /** @type {boolean} */
    invincible: false,
    /** @type {*} */
    chapter: null,

    /**
     * Pauses the simulation briefly to emphasise an impact.
     *
     * @param {number} seconds - Freeze duration.
     * @returns {void}
     */
    hitStop(seconds) {
        this.freezeTimer = Math.max(this.freezeTimer, seconds);
    },

    /**
     * Flashes the screen white when flashes are enabled.
     *
     * @param {number} [strength=0.6] - Peak opacity.
     * @param {number} [duration=0.25] - Fade duration in seconds.
     * @returns {void}
     */
    flash(strength = 0.6, duration = 0.25) {
        events.emit("fx:flash", { strength, duration });
    }
};
