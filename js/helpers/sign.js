import { events } from "../core/events.js";
import { t } from "../core/i18n.js";
import { Entity } from "../entities/entity.js";
import { bindingLabel } from "../systems/input.js";

/**
 * One part of a prompt sign: plain text or a key cap.
 *
 * @typedef {{ text?: string, key?: string, action?: string }} SignPart
 */

/**
 * In-world tutorial speech bubble that shows the player's current bindings
 * in the selected language, replacing the fixed images.
 */
export class PromptSign extends Entity {
    /** @type {() => SignPart[][]} */
    #content;
    /** @type {boolean} */
    shown = false;
    /** @type {Function} */
    #unsubscribe;

    /**
     * @param {number} x - Bubble tip x in world pixels.
     * @param {number} y - Bubble tip y in world pixels.
     * @param {() => SignPart[][]} content - Builds the sign rows.
     */
    constructor(x, y, content) {
        super({ x: x - 130, y: y - 120 }, { width: 260, height: 120 }, "sign");
        this.layer = "front";
        this.#content = content;
        this.elem.classList.add("prompt-sign");
        this.elem.setAttribute("role", "note");
        this.#render();
        const refresh = () => this.#render();
        const offLanguage = events.on("language:change", refresh);
        const offSettings = events.on("settings:change", refresh);
        this.#unsubscribe = () => {
            offLanguage();
            offSettings();
        };
    }

    /**
     * Rebuilds the bubble content.
     *
     * @returns {void}
     */
    #render() {
        this.elem.textContent = "";
        const bubble = document.createElement("div");
        bubble.className = "prompt-bubble";
        for (const row of this.#content()) {
            const line = document.createElement("div");
            line.className = "prompt-row";
            for (const part of row) {
                const span = document.createElement("span");
                if (part.action || part.key) {
                    span.className = "keycap";
                    span.textContent = part.action ? bindingLabel(part.action) : part.key;
                } else {
                    span.className = "prompt-text";
                    span.textContent = t(part.text);
                }
                line.appendChild(span);
            }
            bubble.appendChild(line);
        }
        this.elem.appendChild(bubble);
    }

    /**
     * Pops the sign in.
     *
     * @returns {void}
     */
    show() {
        this.shown = true;
        this.elem.classList.add("shown");
    }

    /**
     * Hides the sign.
     *
     * @returns {void}
     */
    hide() {
        this.shown = false;
        this.elem.classList.remove("shown");
    }

    /**
     * Stops listening for language and binding changes.
     *
     * @returns {void}
     */
    dispose() {
        this.#unsubscribe();
    }
}

/**
 * Animates a title letter by letter.
 *
 * @param {HTMLElement} el - Target element.
 * @param {string} text - Title text.
 * @param {{ delayBetween?: number, startDelay?: number }} [options] - Timing in milliseconds.
 * @returns {void}
 */
export function revealTitle(el, text, options = {}) {
    const { delayBetween = 90, startDelay = 0 } = options;
    el.textContent = "";
    el.classList.remove("done");
    [...text].forEach((ch, i) => {
        const span = document.createElement("span");
        span.className = `letter${ch === " " ? " space" : ""}`;
        span.textContent = ch === " " ? " " : ch;
        span.style.animationDelay = `${startDelay + i * delayBetween}ms`;
        el.appendChild(span);
    });
}
