import { VIEW_HEIGHT, VIEW_WIDTH } from "../core/constants.js";
import { settings } from "../core/settings.js";

/**
 * Weather configuration for a scene.
 *
 * @typedef {object} WeatherOptions
 * @property {"snow"|"blizzard"|"dust"|"none"} type - Kind of particles.
 * @property {number} [density=1] - Multiplier on the flake count.
 * @property {number} [wind=-20] - Base horizontal drift in pixels per second.
 * @property {number} [gusts=1] - Strength of periodic gusts.
 */

const MAX_FLAKES = 170;

/**
 * Screen space weather layer: falling snow with depth, wind gusts and
 * camera parallax, or floating dust inside buildings.
 */
export class Weather {
    /** @type {HTMLDivElement} */
    layer;
    /** @type {Array<{ elem: HTMLDivElement, x: number, y: number, depth: number, phase: number, active: boolean, size: number }>} */
    #flakes = [];
    /** @type {WeatherOptions} */
    options = { type: "none" };
    /** @type {number} */
    #time = 0;
    /** @type {{ x: number, y: number }|null} */
    #lastCamera = null;
    /** @type {number} */
    windNow = 0;

    /**
     * @param {HTMLElement} container - Element the weather layer is appended to.
     */
    constructor(container) {
        this.layer = document.createElement("div");
        this.layer.className = "weather";
        container.appendChild(this.layer);
        for (let i = 0; i < MAX_FLAKES; i++) {
            const elem = document.createElement("div");
            elem.className = "flake";
            elem.style.display = "none";
            this.layer.appendChild(elem);
            this.#flakes.push({ elem, x: 0, y: 0, depth: 1, phase: 0, active: false, size: 2 });
        }
    }

    /**
     * Switches the weather type and repopulates the flakes.
     *
     * @param {WeatherOptions} options - Weather configuration.
     * @returns {void}
     */
    set(options) {
        this.options = { density: 1, wind: -20, gusts: 1, ...options };
        this.layer.dataset.type = this.options.type;
        this.#lastCamera = null;
        const base = { snow: 90, blizzard: 160, dust: 45, none: 0 }[this.options.type] ?? 0;
        const count = Math.min(MAX_FLAKES, Math.round(base * this.options.density * Math.max(0.25, settings.vfxIntensity)));
        this.#flakes.forEach((flake, index) => {
            flake.active = index < count;
            flake.elem.style.display = flake.active ? "" : "none";
            if (flake.active) this.#reset(flake, true);
        });
    }

    /**
     * Places a flake at a random position.
     *
     * @param {typeof this.#flakes[number]} flake - Flake record.
     * @param {boolean} anywhere - Whether to spawn anywhere on screen or above it.
     * @returns {void}
     */
    #reset(flake, anywhere) {
        const dust = this.options.type === "dust";
        flake.depth = 0.35 + Math.random() * (dust ? 0.8 : 1.1);
        flake.x = Math.random() * (VIEW_WIDTH + 200) - 100;
        flake.y = anywhere ? Math.random() * VIEW_HEIGHT : -10 - Math.random() * 40;
        flake.phase = Math.random() * Math.PI * 2;
        const size = dust ? 1.5 + flake.depth * 1.5 : 1.5 + flake.depth * 2.6;
        if (Math.abs(size - flake.size) > 0.2) {
            flake.size = size;
            flake.elem.style.width = `${size.toFixed(1)}px`;
            flake.elem.style.height = `${size.toFixed(1)}px`;
        }
        flake.elem.style.opacity = (dust ? 0.25 + flake.depth * 0.3 : 0.35 + flake.depth * 0.45).toFixed(2);
    }

    /**
     * Advances the weather once per rendered frame.
     *
     * @param {number} dt - Frame time in seconds.
     * @param {{ x: number, y: number }|null} camera - Current camera position for parallax.
     * @returns {void}
     */
    update(dt, camera) {
        if (this.options.type === "none") return;
        this.#time += dt;
        const dust = this.options.type === "dust";
        const blizzard = this.options.type === "blizzard";
        const gust = Math.max(0, Math.sin(this.#time * 0.35) * Math.sin(this.#time * 0.9 + 1)) * (blizzard ? 340 : 70) * this.options.gusts;
        this.windNow = this.options.wind + gust * Math.sign(this.options.wind || -1);
        let camDx = 0;
        let camDy = 0;
        if (camera) {
            if (this.#lastCamera) {
                camDx = camera.x - this.#lastCamera.x;
                camDy = camera.y - this.#lastCamera.y;
                if (Math.abs(camDx) > 300 || Math.abs(camDy) > 300) {
                    camDx = 0;
                    camDy = 0;
                }
            }
            this.#lastCamera = { x: camera.x, y: camera.y };
        }
        for (const flake of this.#flakes) {
            if (!flake.active) continue;
            const fall = dust ? 6 + flake.depth * 4 : (blizzard ? 70 : 28) + flake.depth * (blizzard ? 90 : 45);
            const sway = Math.sin(this.#time * (dust ? 0.6 : 1.4) + flake.phase) * (dust ? 14 : 18);
            flake.x += (this.windNow * flake.depth + sway) * dt - camDx * flake.depth * 0.7;
            flake.y += (dust ? Math.sin(this.#time * 0.5 + flake.phase) * 8 : fall) * dt - camDy * flake.depth * 0.7;
            if (flake.y > VIEW_HEIGHT + 10) {
                this.#reset(flake, false);
            } else if (flake.y < -60) {
                flake.y = VIEW_HEIGHT + 5;
            }
            if (flake.x < -110) flake.x += VIEW_WIDTH + 220;
            else if (flake.x > VIEW_WIDTH + 110) flake.x -= VIEW_WIDTH + 220;
            flake.elem.style.transform = `translate3d(${flake.x.toFixed(1)}px,${flake.y.toFixed(1)}px,0)`;
        }
    }
}
