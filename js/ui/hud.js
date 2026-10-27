import { events } from "../core/events.js";
import { t } from "../core/i18n.js";
import { createIcon } from "./icons.js";

/**
 * Formats seconds as m:ss.
 *
 * @param {number} seconds - Time in seconds.
 * @returns {string} Formatted time.
 */
export function formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

/**
 * Formats an elapsed time as m:ss.cc for results screens.
 *
 * @param {number} seconds - Time in seconds.
 * @returns {string} Formatted time.
 */
export function formatPrecise(seconds) {
    const total = Math.max(0, seconds);
    const minutes = Math.floor(total / 60);
    const rest = total - minutes * 60;
    return `${minutes}:${rest.toFixed(2).padStart(5, "0")}`;
}

/**
 * Heads-up display with strawberries, countdown timer, lives and deaths.
 *
 * Text nodes are only written when a displayed value changes.
 */
export class Hud {
    /** @type {HTMLElement} */
    root;
    /** @type {Record<string, HTMLElement>} */
    #fields = {};
    /** @type {Record<string, string>} */
    #last = {};
    /** @type {number} */
    #berryPulse = 0;

    /**
     * @param {HTMLElement} root - HUD container.
     */
    constructor(root) {
        this.root = root;
        root.textContent = "";
        const left = document.createElement("div");
        left.className = "hud-group hud-left";
        const right = document.createElement("div");
        right.className = "hud-group hud-right";
        const make = (parent, icon, name, label) => {
            const item = document.createElement("div");
            item.className = `hud-item hud-${name}`;
            item.appendChild(createIcon(icon, 26));
            const value = document.createElement("span");
            value.className = "hud-value";
            item.appendChild(value);
            item.dataset.label = label;
            parent.appendChild(item);
            this.#fields[name] = value;
            this.#fields[`${name}Item`] = item;
        };
        make(left, "strawberry", "berries", "hud.strawberries");
        make(left, "skull", "deaths", "hud.deaths");
        make(right, "clock", "timer", "hud.time");
        make(right, "heart", "lives", "hud.lives");
        root.append(left, right);
        events.on("language:change", () => this.#applyLabels());
        this.#applyLabels();
    }

    /**
     * Updates accessible labels for the current language.
     *
     * @returns {void}
     */
    #applyLabels() {
        for (const name of ["berries", "deaths", "timer", "lives"]) {
            const item = this.#fields[`${name}Item`];
            item.setAttribute("aria-label", t(item.dataset.label));
        }
    }

    /**
     * Writes a value only when it changed.
     *
     * @param {string} name - Field name.
     * @param {string} value - Display text.
     * @returns {void}
     */
    #set(name, value) {
        if (this.#last[name] === value) return;
        this.#last[name] = value;
        this.#fields[name].textContent = value;
    }

    /**
     * Refreshes the display from the session state.
     *
     * @param {{ strawberries: number, total: number, timeRemaining: number, lives: number, deaths: number, assist: boolean }} state - Values to show.
     * @param {number} dt - Frame time for animations.
     * @returns {void}
     */
    update(state, dt) {
        this.#set("berries", `${state.strawberries}/${state.total}`);
        this.#set("deaths", String(state.deaths));
        this.#set("timer", state.assist ? "∞" : formatTime(state.timeRemaining));
        this.#set("lives", state.assist ? "∞" : String(Math.max(0, state.lives)));
        const urgent = !state.assist && state.timeRemaining <= 30;
        if (this.#last.urgent !== String(urgent)) {
            this.#last.urgent = String(urgent);
            this.#fields.timerItem.classList.toggle("urgent", urgent);
        }
        if (this.#berryPulse > 0) {
            this.#berryPulse -= dt;
            if (this.#berryPulse <= 0) this.#fields.berriesItem.classList.remove("pulse");
        }
    }

    /**
     * Highlights the strawberry counter after a pickup.
     *
     * @returns {void}
     */
    pulseBerries() {
        this.#fields.berriesItem.classList.remove("pulse");
        void this.#fields.berriesItem.offsetWidth;
        this.#fields.berriesItem.classList.add("pulse");
        this.#berryPulse = 0.6;
    }

    /**
     * Shows or hides the HUD.
     *
     * @param {boolean} visible - Whether the HUD is visible.
     * @returns {void}
     */
    setVisible(visible) {
        this.root.classList.toggle("hidden", !visible);
    }
}
