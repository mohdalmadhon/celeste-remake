import { events } from "../core/events.js";
import { t } from "../core/i18n.js";
import { audio } from "../systems/audio.js";
import { createIcon } from "./icons.js";

/**
 * One row of a menu.
 *
 * @typedef {object} MenuItem
 * @property {string} [id] - Identifier, used to restore the selection.
 * @property {string} [label] - Translation key of the label.
 * @property {string} [text] - Literal label, used for language names.
 * @property {"button"|"toggle"|"slider"|"choice"|"section"} [type="button"] - Row behaviour.
 * @property {() => *} [get] - Reads the current value of a setting row.
 * @property {(value: *) => void} [set] - Writes a new value.
 * @property {Array<{ value: *, label: string }>} [options] - Choices for a choice row, labels are translation keys.
 * @property {number} [min] - Slider minimum.
 * @property {number} [max] - Slider maximum.
 * @property {number} [step] - Slider step.
 * @property {() => void} [action] - Activation callback.
 * @property {() => boolean} [disabled] - Whether the row is unavailable.
 * @property {string} [icon] - Icon name from the icon sheet.
 * @property {(row: HTMLElement) => void} [decorate] - Adds custom content to the row.
 * @property {() => string} [valueText] - Custom value text.
 */

/**
 * Keyboard, controller and mouse navigable list of menu rows with
 * toggles, sliders and choice selectors, plus interface sounds.
 */
export class Menu {
    /** @type {HTMLElement} */
    root;
    /** @type {MenuItem[]} */
    items;
    /** @type {HTMLElement[]} */
    rows = [];
    /** @type {number} */
    index = 0;
    /** @type {boolean} */
    active = true;
    /** @type {(() => void)|null} */
    onBack;
    /** @type {boolean} */
    horizontal;
    /** @type {Function} */
    #off;
    /** @type {number} */
    #lockUntil = 0;

    /**
     * @param {HTMLElement} container - Element the list is rendered into.
     * @param {MenuItem[]} items - Menu rows.
     * @param {{ onBack?: () => void, horizontal?: boolean, selected?: string, className?: string }} [options] - Behaviour options.
     */
    constructor(container, items, options = {}) {
        this.items = items;
        this.onBack = options.onBack || null;
        this.horizontal = Boolean(options.horizontal);
        this.root = document.createElement("div");
        this.root.className = options.className || "menu-list";
        this.root.setAttribute("role", "menu");
        container.appendChild(this.root);
        this.#build();
        const start = options.selected ? items.findIndex((item) => item.id === options.selected) : -1;
        this.index = start >= 0 ? start : this.#firstSelectable();
        this.#highlight(false);
        this.#lockUntil = performance.now() + 150;
        this.#off = events.on("input:ui", (event) => this.#onInput(event));
    }

    /**
     * Finds the first row that can be selected.
     *
     * @returns {number} Row index.
     */
    #firstSelectable() {
        return Math.max(0, this.items.findIndex((item, i) => this.#selectable(i)));
    }

    /**
     * Whether a row can take the selection.
     *
     * @param {number} i - Row index.
     * @returns {boolean} True when selectable.
     */
    #selectable(i) {
        const item = this.items[i];
        return item && item.type !== "section" && !item.disabled?.();
    }

    /**
     * Creates the row elements.
     *
     * @returns {void}
     */
    #build() {
        this.root.textContent = "";
        this.rows = this.items.map((item, i) => {
            if (item.type === "section") {
                const section = document.createElement("div");
                section.className = "menu-section";
                section.textContent = t(item.label);
                this.root.appendChild(section);
                return section;
            }
            const row = document.createElement("button");
            row.type = "button";
            row.className = "menu-item";
            row.setAttribute("role", "menuitem");
            if (item.icon) row.appendChild(createIcon(item.icon, 24));
            const label = document.createElement("span");
            label.className = "label";
            row.appendChild(label);
            item.decorate?.(row);
            if (item.type && item.type !== "button") {
                const value = document.createElement("span");
                value.className = "value";
                row.appendChild(value);
            }
            row.addEventListener("pointerenter", () => {
                if (!this.active || !this.#selectable(i) || this.index === i) return;
                this.index = i;
                this.#highlight(true);
            });
            row.addEventListener("click", (event) => {
                if (!this.active || !this.#selectable(i)) return;
                this.index = i;
                this.#highlight(false);
                if (item.type === "slider" || item.type === "choice") {
                    const rect = row.getBoundingClientRect();
                    this.#adjust(event.clientX < rect.left + rect.width * 0.75 ? -1 : 1);
                } else {
                    this.#activate();
                }
            });
            this.root.appendChild(row);
            return row;
        });
        this.refresh();
    }

    /**
     * Updates every row label and value from its getter.
     *
     * @returns {void}
     */
    refresh() {
        this.items.forEach((item, i) => {
            const row = this.rows[i];
            if (item.type === "section") {
                row.textContent = t(item.label);
                return;
            }
            row.querySelector(".label").textContent = item.text ?? t(item.label);
            const disabled = Boolean(item.disabled?.());
            row.classList.toggle("disabled", disabled);
            row.setAttribute("aria-disabled", String(disabled));
            const valueElem = row.querySelector(".value");
            if (!valueElem) return;
            valueElem.textContent = "";
            if (item.valueText) {
                valueElem.textContent = item.valueText();
            } else if (item.type === "toggle") {
                valueElem.textContent = t(item.get() ? "option.on" : "option.off");
            } else if (item.type === "slider") {
                const meter = document.createElement("span");
                meter.className = "meter";
                const steps = Math.round((item.max - item.min) / item.step);
                const filled = Math.round((item.get() - item.min) / item.step);
                for (let s = 0; s < steps; s++) {
                    const bar = document.createElement("span");
                    if (s < filled) bar.className = "on";
                    meter.appendChild(bar);
                }
                valueElem.append(this.#arrow("◀"), meter, this.#arrow("▶"));
            } else if (item.type === "choice") {
                const current = item.options.find((option) => option.value === item.get()) || item.options[0];
                const text = document.createElement("span");
                text.textContent = t(current.label);
                valueElem.append(this.#arrow("◀"), text, this.#arrow("▶"));
            }
        });
    }

    /**
     * Creates a small arrow element.
     *
     * @param {string} glyph - Arrow character.
     * @returns {HTMLSpanElement} Arrow element.
     */
    #arrow(glyph) {
        const span = document.createElement("span");
        span.className = "arrow";
        span.textContent = glyph;
        return span;
    }

    /**
     * Moves the visual highlight to the selected row.
     *
     * @param {boolean} sound - Whether to play the move sound.
     * @returns {void}
     */
    #highlight(sound) {
        this.rows.forEach((row, i) => row.classList.toggle("selected", i === this.index));
        const row = this.rows[this.index];
        if (row) {
            row.scrollIntoView?.({ block: "nearest" });
            if (document.activeElement !== row && this.active) row.focus({ preventScroll: true });
        }
        if (sound) audio.ui("move");
        events.emit("menu:select", { item: this.items[this.index] });
    }

    /**
     * Handles navigation events.
     *
     * @param {{ action: string, repeat?: boolean }} event - Input event.
     * @returns {void}
     */
    #onInput(event) {
        if (!this.active || performance.now() < this.#lockUntil) return;
        const { action } = event;
        const next = this.horizontal ? "right" : "down";
        const previous = this.horizontal ? "left" : "up";
        if (action === next || action === previous) {
            this.#move(action === next ? 1 : -1);
            return;
        }
        if (!this.horizontal && (action === "left" || action === "right")) {
            this.#adjust(action === "right" ? 1 : -1);
            return;
        }
        if (event.repeat) return;
        if (action === "confirm" || action === "jump") {
            this.#activate();
        } else if (action === "back" || action === "dash") {
            if (this.onBack) {
                audio.ui("back");
                this.onBack();
            }
        }
    }

    /**
     * Moves the selection, skipping sections and disabled rows.
     *
     * @param {number} direction - 1 or -1.
     * @returns {void}
     */
    #move(direction) {
        const count = this.items.length;
        let i = this.index;
        for (let n = 0; n < count; n++) {
            i = (i + direction + count) % count;
            if (this.#selectable(i)) break;
        }
        if (i !== this.index) {
            this.index = i;
            this.#highlight(true);
        }
    }

    /**
     * Changes the value of a slider, choice or toggle row.
     *
     * @param {number} direction - 1 or -1.
     * @returns {void}
     */
    #adjust(direction) {
        const item = this.items[this.index];
        if (!item || item.disabled?.()) return;
        if (item.type === "slider") {
            const value = Math.round(Math.min(item.max, Math.max(item.min, item.get() + item.step * direction)) * 100) / 100;
            if (value !== item.get()) {
                item.set(value);
                audio.ui("slider");
            }
        } else if (item.type === "choice") {
            const options = item.options;
            const current = Math.max(0, options.findIndex((option) => option.value === item.get()));
            item.set(options[(current + direction + options.length) % options.length].value);
            audio.ui("toggle");
        } else if (item.type === "toggle") {
            item.set(!item.get());
            audio.ui("toggle");
        } else {
            return;
        }
        this.refresh();
    }

    /**
     * Activates the selected row.
     *
     * @returns {void}
     */
    #activate() {
        const item = this.items[this.index];
        if (!item) return;
        if (item.disabled?.()) {
            audio.ui("error");
            return;
        }
        if (item.type === "toggle" || item.type === "choice") {
            this.#adjust(1);
            return;
        }
        if (item.type === "slider") return;
        if (item.action) {
            audio.ui("confirm");
            this.#lockUntil = performance.now() + 250;
            const row = this.rows[this.index];
            row.classList.remove("pressed");
            void row.offsetWidth;
            row.classList.add("pressed");
            item.action();
        }
    }

    /**
     * Removes listeners and the list element.
     *
     * @returns {void}
     */
    destroy() {
        this.active = false;
        this.#off();
        this.root.remove();
    }
}
