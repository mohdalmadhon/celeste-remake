import { ACTION_TYPES, createLevel, ENTITY_TYPES, fieldDefaults, LEVEL_LIMITS, levelProblems, newId, normalizeLevel, THEME_OPTIONS, TILE_TYPES, TRIGGER_TYPES, WEATHER_PRESETS } from "../levels/levelFormat.js";
import { button, el, fieldInputs, row, select } from "./forms.js";
import { deleteLevel, duplicateLevel, exportLevel, importLevel, listLevels, loadLevel, saveLevel } from "./levelStore.js";

const CELL = 50;
const HISTORY_LIMIT = 120;
const SPIKE_IMAGES = {
    up: "./assets/tiles/celeste/spikes.png",
    down: "./assets/tiles/celeste/spikeDown.png",
    left: "./assets/tiles/celeste/spikesFlippedLeft.png",
    right: "./assets/tiles/celeste/spikesFlippedRight.png"
};
const TOOLS = [
    ["select", "Select", "V", "Pick and drag objects, events and the start"],
    ["paint", "Paint", "B", "Draw blocks; right click erases"],
    ["erase", "Erase", "E", "Remove blocks and objects"],
    ["rect", "Fill box", "R", "Drag a box of blocks; right drag clears it"],
    ["event", "Event area", "T", "Drag an area that starts an event"],
    ["pan", "Pan", "H", "Move the view; Space or middle drag also pans"]
];

/**
 * Callbacks the editor uses to talk to the rest of the game.
 *
 * @typedef {object} EditorHost
 * @property {(level: import("../levels/levelFormat.js").LevelData, start?: { x: number, y: number }) => void} playtest - Plays a level and comes back afterwards.
 * @property {(level: import("../levels/levelFormat.js").LevelData) => void} play - Plays a level like a normal chapter.
 * @property {() => void} exit - Leaves developer mode.
 * @property {() => Promise<import("../levels/levelFormat.js").LevelData|null>} example - Loads the built-in Chapter 4 level.
 */

/**
 * Developer mode: a full screen level editor for the level file format.
 *
 * Blocks are painted on a grid with automatic edges, objects are placed
 * from a palette and edited in an inspector, and events pair a trigger
 * (an area, the start, a checkpoint, strawberries or deaths) with an
 * ordered list of actions such as dialogue, shakes, wind or dropping a
 * block. Levels are saved in the browser and can be exported to or
 * imported from JSON files.
 */
export class LevelEditor {
    /** @type {HTMLElement} */
    root;
    /** @type {EditorHost} */
    host;
    /** @type {import("../levels/levelFormat.js").LevelData|null} */
    level = null;
    /** @type {string} */
    tool = "paint";
    /** @type {string} */
    tile = "s";
    /** @type {string|null} */
    placing = null;
    /** @type {{ kind: "entity"|"event", id: string }|null} */
    selection = null;
    /** @type {boolean} */
    dirty = false;
    /** @type {{ x: number, y: number, zoom: number }} */
    view = { x: 0, y: 0, zoom: 0.6 };
    /** @type {string[]} */
    #undo = [];
    /** @type {string[]} */
    #redo = [];
    /** @type {string} */
    #lastSnapshot = "";
    /** @type {Map<string, HTMLElement>} */
    #tileElems = new Map();
    /** @type {*} */
    #drag = null;
    /** @type {{ x: number, y: number }|null} */
    #hover = null;
    /** @type {boolean} */
    #spaceHeld = false;
    /** @type {string} */
    #panel = "level";
    /** @type {number} */
    #commitTimer = 0;
    /** @type {Record<string, HTMLElement>} */
    #ui = {};
    /** @type {Array<() => void>} */
    #listeners = [];

    /**
     * @param {HTMLElement} root - Element the editor fills.
     * @param {EditorHost} host - Game callbacks.
     */
    constructor(root, host) {
        this.root = root;
        this.host = host;
    }

    /**
     * Whether the editor is showing.
     *
     * @returns {boolean} True while open.
     */
    get isOpen() {
        return !this.root.classList.contains("hidden");
    }

    /**
     * Opens developer mode, showing the level list when no level is loaded.
     *
     * @param {{ manager?: boolean }} [options] - Whether to show the level list first.
     * @returns {void}
     */
    open(options = {}) {
        if (!this.root.childElementCount) this.#build();
        this.root.classList.remove("hidden");
        document.body.classList.add("editor-open");
        this.#bindGlobal();
        if (!this.level || options.manager) this.showManager();
        else this.#renderAll();
    }

    /**
     * Hides the editor without discarding the open level.
     *
     * @returns {void}
     */
    hide() {
        this.root.classList.add("hidden");
        document.body.classList.remove("editor-open");
        for (const off of this.#listeners) off();
        this.#listeners = [];
    }

    /**
     * Loads a level into the editor.
     *
     * @param {import("../levels/levelFormat.js").LevelData} level - Level to edit.
     * @param {boolean} [dirty=false] - Whether it starts with unsaved changes.
     * @returns {void}
     */
    load(level, dirty = false) {
        this.level = normalizeLevel(level);
        this.selection = null;
        this.dirty = dirty;
        this.#undo = [];
        this.#redo = [];
        this.#lastSnapshot = JSON.stringify(this.level);
        this.#fitView();
        this.#renderAll();
        this.#closeModal();
    }

    /**
     * Creates every static part of the interface.
     *
     * @returns {void}
     */
    #build() {
        const root = this.root;
        root.className = "editor hidden";
        const top = el("header", "ed-top");
        const name = el("input", "ed-name");
        name.placeholder = "Level name";
        name.addEventListener("input", () => {
            this.level.name = name.value.slice(0, 60);
            this.#changed(true);
        });
        top.append(el("div", "ed-logo", "Developer Mode"), name,
            button("Levels", () => this.showManager(), "ed-btn", "Open, import or delete levels"),
            button("Save", () => this.save(), "ed-btn ed-primary", "Save in this browser (Ctrl+S)"),
            button("Export JSON", () => this.level && exportLevel(this.level), "ed-btn", "Download the level as a file"),
            button("Undo", () => this.undo(), "ed-btn", "Ctrl+Z"),
            button("Redo", () => this.redo(), "ed-btn", "Ctrl+Y"),
            button("▶ Playtest", () => this.playtest(), "ed-btn ed-play", "Play from the start (P plays from the cursor)"),
            button("Exit", () => this.exit(), "ed-btn ed-quiet"));
        const left = el("aside", "ed-left");
        const tools = el("div", "ed-tools");
        for (const [id, label, key, title] of TOOLS) {
            const tool = button(`${label} ${key}`, () => this.setTool(id), "ed-tool", title);
            tool.dataset.tool = id;
            tools.appendChild(tool);
        }
        const tilePalette = el("div", "ed-palette");
        Object.entries(TILE_TYPES).forEach(([ch, spec], index) => {
            const swatch = button("", () => {
                this.tile = ch;
                this.placing = null;
                if (this.tool !== "rect") this.setTool("paint");
                this.#refreshPalette();
            }, "ed-swatch", `${spec.name} (${index + 1})`);
            swatch.dataset.tile = ch;
            const preview = el("span", "ed-swatch-art");
            preview.style.backgroundImage = `url("${spec.strip}")`;
            swatch.append(preview, el("span", "ed-swatch-name", spec.name));
            tilePalette.appendChild(swatch);
        });
        const objectPalette = el("div", "ed-palette ed-objects");
        for (const [type, spec] of Object.entries(ENTITY_TYPES)) {
            const item = button("", () => {
                this.placing = type;
                this.setTool("place");
                this.#refreshPalette();
            }, "ed-swatch", spec.name);
            item.dataset.entity = type;
            const icon = el("span", `ed-icon ed-icon-${spec.icon}`);
            item.append(icon, el("span", "ed-swatch-name", spec.name));
            objectPalette.appendChild(item);
        }
        left.append(el("h3", "", "Tools"), tools, el("h3", "", "Blocks"), tilePalette, el("h3", "", "Objects"), objectPalette);

        const viewport = el("main", "ed-view");
        const world = el("div", "ed-world");
        const grid = el("div", "ed-grid");
        const tilesLayer = el("div", "ed-layer ed-tiles");
        const eventLayer = el("div", "ed-layer ed-events");
        const entityLayer = el("div", "ed-layer ed-entities");
        const cursor = el("div", "ed-cursor");
        const marquee = el("div", "ed-marquee hidden");
        world.append(grid, tilesLayer, eventLayer, entityLayer, cursor, marquee);
        viewport.appendChild(world);

        const right = el("aside", "ed-right");
        const tabs = el("div", "ed-tabs");
        for (const [id, label] of [["level", "Level"], ["object", "Selected"], ["events", "Events"]]) {
            const tab = button(label, () => {
                this.#panel = id;
                this.#renderPanel();
            }, "ed-tab");
            tab.dataset.panel = id;
            tabs.appendChild(tab);
        }
        const panel = el("div", "ed-panel");
        right.append(tabs, panel);

        const status = el("footer", "ed-status");
        const modal = el("div", "ed-modal hidden");
        root.append(top, left, viewport, right, status, modal);
        this.#ui = { name, tools, tilePalette, objectPalette, viewport, world, grid, tilesLayer, eventLayer, entityLayer, cursor, marquee, tabs, panel, status, modal };

        viewport.addEventListener("pointerdown", (event) => this.#pointerDown(event));
        viewport.addEventListener("pointermove", (event) => this.#pointerMove(event));
        viewport.addEventListener("pointerup", (event) => this.#pointerUp(event));
        viewport.addEventListener("pointercancel", (event) => this.#pointerUp(event));
        viewport.addEventListener("pointerleave", () => {
            this.#hover = null;
            this.#ui.cursor.style.display = "none";
        });
        viewport.addEventListener("wheel", (event) => this.#wheel(event), { passive: false });
        viewport.addEventListener("contextmenu", (event) => event.preventDefault());
    }

    /**
     * Installs keyboard shortcuts while the editor is open.
     *
     * @returns {void}
     */
    #bindGlobal() {
        if (this.#listeners.length) return;
        const down = (event) => this.#keyDown(event);
        const up = (event) => {
            if (event.code === "Space") this.#spaceHeld = false;
        };
        const unload = (event) => {
            if (this.dirty && this.isOpen) {
                event.preventDefault();
                event.returnValue = "";
            }
        };
        window.addEventListener("keydown", down, true);
        window.addEventListener("keyup", up, true);
        window.addEventListener("beforeunload", unload);
        this.#listeners.push(
            () => window.removeEventListener("keydown", down, true),
            () => window.removeEventListener("keyup", up, true),
            () => window.removeEventListener("beforeunload", unload)
        );
    }

    /**
     * Handles editor shortcuts and keeps keys away from the game.
     *
     * @param {KeyboardEvent} event - Key event.
     * @returns {void}
     */
    #keyDown(event) {
        if (!this.isOpen) return;
        event.stopPropagation();
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
        const ctrl = event.ctrlKey || event.metaKey;
        if (ctrl && event.code === "KeyS") {
            event.preventDefault();
            this.save();
            return;
        }
        if (typing) {
            if (event.code === "Escape") document.activeElement.blur();
            return;
        }
        if (!this.level || !this.#ui.modal.classList.contains("hidden")) {
            if (event.code === "Escape" && this.level) this.#closeModal();
            return;
        }
        if (ctrl && event.code === "KeyZ") {
            event.preventDefault();
            if (event.shiftKey) this.redo();
            else this.undo();
            return;
        }
        if (ctrl && event.code === "KeyY") {
            event.preventDefault();
            this.redo();
            return;
        }
        const tool = TOOLS.find(([, , key]) => `Key${key}` === event.code);
        if (tool && !ctrl) {
            this.setTool(tool[0]);
            return;
        }
        const digit = /^Digit([1-9])$/.exec(event.code);
        if (digit) {
            const ch = Object.keys(TILE_TYPES)[Number(digit[1]) - 1];
            if (ch) {
                this.tile = ch;
                this.setTool("paint");
            }
            return;
        }
        switch (event.code) {
            case "Space":
                this.#spaceHeld = true;
                event.preventDefault();
                break;
            case "Delete":
            case "Backspace":
                this.deleteSelection();
                break;
            case "KeyP":
                this.playtest(this.#hover ?? undefined);
                break;
            case "KeyF":
                this.#fitView();
                break;
            case "Escape":
                this.selection = null;
                this.placing = null;
                if (this.tool === "place") this.setTool("select");
                this.#renderAll();
                break;
            case "ArrowLeft":
            case "ArrowRight":
            case "ArrowUp":
            case "ArrowDown": {
                const step = 120;
                this.view.x += event.code === "ArrowLeft" ? step : event.code === "ArrowRight" ? -step : 0;
                this.view.y += event.code === "ArrowUp" ? step : event.code === "ArrowDown" ? -step : 0;
                this.#applyView();
                event.preventDefault();
                break;
            }
            default:
                break;
        }
    }

    /**
     * Switches the active tool.
     *
     * @param {string} tool - Tool id.
     * @returns {void}
     */
    setTool(tool) {
        this.tool = tool;
        if (tool !== "place") this.placing = null;
        this.#refreshPalette();
        this.#updateStatus();
    }

    /**
     * Highlights the active tool, block and object.
     *
     * @returns {void}
     */
    #refreshPalette() {
        for (const node of this.#ui.tools.children) node.classList.toggle("active", node.dataset.tool === this.tool);
        for (const node of this.#ui.tilePalette.children) node.classList.toggle("active", node.dataset.tile === this.tile && (this.tool === "paint" || this.tool === "rect"));
        for (const node of this.#ui.objectPalette.children) node.classList.toggle("active", node.dataset.entity === this.placing);
        this.#ui.viewport.dataset.tool = this.tool;
    }

    /**
     * Grid cell under a pointer event.
     *
     * @param {PointerEvent|WheelEvent} event - Pointer event.
     * @returns {{ x: number, y: number }} Cell coordinates, possibly outside the level.
     */
    #cellAt(event) {
        const rect = this.#ui.viewport.getBoundingClientRect();
        const wx = (event.clientX - rect.left - this.view.x) / this.view.zoom;
        const wy = (event.clientY - rect.top - this.view.y) / this.view.zoom;
        return { x: Math.floor(wx / CELL), y: Math.floor(wy / CELL) };
    }

    /**
     * Whether a cell lies inside the level.
     *
     * @param {{ x: number, y: number }} cell - Cell.
     * @returns {boolean} True when inside.
     */
    #inside(cell) {
        return cell.x >= 0 && cell.y >= 0 && cell.x < this.level.width && cell.y < this.level.height;
    }

    /**
     * Starts painting, placing, selecting, drawing an area or panning.
     *
     * @param {PointerEvent} event - Pointer event.
     * @returns {void}
     */
    #pointerDown(event) {
        if (!this.level) return;
        this.#ui.viewport.setPointerCapture(event.pointerId);
        const cell = this.#cellAt(event);
        const secondary = event.button === 2;
        if (event.button === 1 || this.#spaceHeld || this.tool === "pan") {
            this.#drag = { kind: "pan", startX: event.clientX, startY: event.clientY, viewX: this.view.x, viewY: this.view.y };
            this.#ui.viewport.classList.add("panning");
            return;
        }
        if (this.tool === "rect" || this.tool === "event") {
            if (!this.#inside(cell)) return;
            this.#drag = { kind: this.tool, from: cell, to: cell, clear: secondary };
            this.#drawMarquee();
            return;
        }
        if (this.tool === "paint" || this.tool === "erase") {
            const erase = this.tool === "erase" || secondary;
            this.#drag = { kind: "paint", erase };
            this.#paintAt(cell, erase);
            return;
        }
        if (this.tool === "place" && this.placing) {
            if (secondary) {
                this.#removeEntityAt(cell);
                return;
            }
            this.#placeEntity(this.placing, cell);
            return;
        }
        if (this.tool === "select") {
            const entity = this.#entityAt(cell);
            if (entity) {
                this.selection = { kind: "entity", id: entity.id };
                this.#panel = "object";
                this.#drag = { kind: "move", id: entity.id, from: cell, origin: { x: entity.x, y: entity.y } };
                this.#renderEntities();
                this.#renderPanel();
                return;
            }
            const area = this.#eventAt(cell);
            if (area) {
                this.selection = { kind: "event", id: area.id };
                this.#panel = "events";
                this.#drag = { kind: "moveArea", id: area.id, from: cell, origin: { x: area.trigger.x, y: area.trigger.y } };
                this.#renderEvents();
                this.#renderPanel();
                return;
            }
            this.selection = null;
            this.#renderEntities();
            this.#renderEvents();
            this.#renderPanel();
        }
    }

    /**
     * Continues the current drag and moves the cell cursor.
     *
     * @param {PointerEvent} event - Pointer event.
     * @returns {void}
     */
    #pointerMove(event) {
        if (!this.level) return;
        const cell = this.#cellAt(event);
        this.#hover = this.#inside(cell) ? cell : null;
        this.#moveCursor(cell);
        const drag = this.#drag;
        if (!drag) return;
        if (drag.kind === "pan") {
            this.view.x = drag.viewX + event.clientX - drag.startX;
            this.view.y = drag.viewY + event.clientY - drag.startY;
            this.#applyView();
        } else if (drag.kind === "paint") {
            this.#paintAt(cell, drag.erase);
        } else if (drag.kind === "rect" || drag.kind === "event") {
            drag.to = {
                x: Math.min(this.level.width - 1, Math.max(0, cell.x)),
                y: Math.min(this.level.height - 1, Math.max(0, cell.y))
            };
            this.#drawMarquee();
        } else if (drag.kind === "move") {
            const entity = this.level.entities.find((item) => item.id === drag.id);
            if (!entity) return;
            entity.x = Math.min(this.level.width - 1, Math.max(0, drag.origin.x + cell.x - drag.from.x));
            entity.y = Math.min(this.level.height - 1, Math.max(0, drag.origin.y + cell.y - drag.from.y));
            this.#renderEntities();
        } else if (drag.kind === "moveArea") {
            const event2 = this.level.events.find((item) => item.id === drag.id);
            if (!event2) return;
            const trigger = event2.trigger;
            trigger.x = Math.min(this.level.width - trigger.w, Math.max(0, drag.origin.x + cell.x - drag.from.x));
            trigger.y = Math.min(this.level.height - trigger.h, Math.max(0, drag.origin.y + cell.y - drag.from.y));
            this.#renderEvents();
        }
        this.#updateStatus();
    }

    /**
     * Finishes the current drag and records an undo step.
     *
     * @param {PointerEvent} event - Pointer event.
     * @returns {void}
     */
    #pointerUp(event) {
        const drag = this.#drag;
        this.#drag = null;
        this.#ui.viewport.classList.remove("panning");
        if (this.#ui.viewport.hasPointerCapture?.(event.pointerId)) this.#ui.viewport.releasePointerCapture(event.pointerId);
        if (!drag || !this.level) return;
        if (drag.kind === "rect") {
            const box = this.#box(drag.from, drag.to);
            for (let y = box.y; y < box.y + box.h; y++) {
                for (let x = box.x; x < box.x + box.w; x++) this.#setTile(x, y, drag.clear ? "." : this.tile);
            }
            this.#ui.marquee.classList.add("hidden");
            this.#refreshTiles(box.x - 1, box.y - 1, box.w + 2, box.h + 2);
            this.#changed();
        } else if (drag.kind === "event") {
            const box = this.#box(drag.from, drag.to);
            this.#ui.marquee.classList.add("hidden");
            const target = this.selection?.kind === "event" ? this.level.events.find((item) => item.id === this.selection.id && item.trigger.type === "enter" && item.redraw) : null;
            if (target) {
                Object.assign(target.trigger, box);
                delete target.redraw;
            } else {
                const created = { id: newId("ev"), name: `Event ${this.level.events.length + 1}`, once: true, trigger: { type: "enter", ...box }, actions: [{ type: "toast", text: "Something happened" }] };
                this.level.events.push(created);
                this.selection = { kind: "event", id: created.id };
            }
            this.#panel = "events";
            this.setTool("select");
            this.#renderEvents();
            this.#renderPanel();
            this.#changed();
        } else if (drag.kind === "paint" || drag.kind === "move" || drag.kind === "moveArea") {
            this.#changed();
            if (drag.kind !== "paint") this.#renderPanel();
        }
    }

    /**
     * Zooms around the cursor, or scrolls with Shift.
     *
     * @param {WheelEvent} event - Wheel event.
     * @returns {void}
     */
    #wheel(event) {
        event.preventDefault();
        if (!this.level) return;
        if (event.shiftKey || (!event.ctrlKey && Math.abs(event.deltaX) > Math.abs(event.deltaY))) {
            this.view.x -= event.shiftKey ? event.deltaY : event.deltaX;
            this.#applyView();
            return;
        }
        const rect = this.#ui.viewport.getBoundingClientRect();
        const mx = event.clientX - rect.left;
        const my = event.clientY - rect.top;
        const zoom = Math.min(2, Math.max(0.15, this.view.zoom * Math.exp(-event.deltaY * 0.0015)));
        this.view.x = mx - (mx - this.view.x) * (zoom / this.view.zoom);
        this.view.y = my - (my - this.view.y) * (zoom / this.view.zoom);
        this.view.zoom = zoom;
        this.#applyView();
        this.#updateStatus();
    }

    /**
     * Normalised box between two cells.
     *
     * @param {{ x: number, y: number }} a - One corner.
     * @param {{ x: number, y: number }} b - Other corner.
     * @returns {{ x: number, y: number, w: number, h: number }} Box in cells.
     */
    #box(a, b) {
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        return { x, y, w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
    }

    /**
     * Shows the box being dragged.
     *
     * @returns {void}
     */
    #drawMarquee() {
        const drag = this.#drag;
        const box = this.#box(drag.from, drag.to);
        const marquee = this.#ui.marquee;
        marquee.classList.remove("hidden");
        marquee.classList.toggle("ed-marquee-event", drag.kind === "event");
        marquee.classList.toggle("ed-marquee-clear", Boolean(drag.clear));
        Object.assign(marquee.style, { left: `${box.x * CELL}px`, top: `${box.y * CELL}px`, width: `${box.w * CELL}px`, height: `${box.h * CELL}px` });
        marquee.textContent = `${box.w} × ${box.h}`;
    }

    /**
     * Moves the hover highlight.
     *
     * @param {{ x: number, y: number }} cell - Hovered cell.
     * @returns {void}
     */
    #moveCursor(cell) {
        const cursor = this.#ui.cursor;
        if (!this.#inside(cell)) {
            cursor.style.display = "none";
            return;
        }
        cursor.style.display = "";
        cursor.style.transform = `translate(${cell.x * CELL}px, ${cell.y * CELL}px)`;
        cursor.classList.toggle("ed-cursor-erase", this.tool === "erase");
    }

    /**
     * Paints or erases at a cell.
     *
     * @param {{ x: number, y: number }} cell - Target cell.
     * @param {boolean} erase - Whether to erase.
     * @returns {void}
     */
    #paintAt(cell, erase) {
        if (!this.#inside(cell)) return;
        if (erase && this.tool === "erase" && this.#removeEntityAt(cell, false)) return;
        const ch = erase ? "." : this.tile;
        if (this.level.tiles[cell.y][cell.x] === ch) return;
        this.#setTile(cell.x, cell.y, ch);
        this.#refreshTiles(cell.x - 1, cell.y - 1, 3, 3);
        this.dirty = true;
        this.#updateStatus();
    }

    /**
     * Writes one tile character.
     *
     * @param {number} x - Column.
     * @param {number} y - Row.
     * @param {string} ch - Tile character.
     * @returns {void}
     */
    #setTile(x, y, ch) {
        const rowText = this.level.tiles[y];
        this.level.tiles[y] = rowText.slice(0, x) + ch + rowText.slice(x + 1);
    }

    /**
     * Places an object, moving unique ones such as the start instead of
     * adding a second copy.
     *
     * @param {string} type - Object type.
     * @param {{ x: number, y: number }} cell - Target cell.
     * @returns {void}
     */
    #placeEntity(type, cell) {
        if (!this.#inside(cell)) return;
        const spec = ENTITY_TYPES[type];
        let entity = spec.unique ? this.level.entities.find((item) => item.type === type) : null;
        if (entity) {
            entity.x = cell.x;
            entity.y = cell.y;
        } else {
            const existing = this.#entityAt(cell);
            if (existing && existing.type === type) {
                this.selection = { kind: "entity", id: existing.id };
                this.#renderEntities();
                this.#renderPanel();
                return;
            }
            entity = { id: newId(type), type, x: cell.x, y: cell.y, ...fieldDefaults(spec.fields) };
            this.level.entities.push(entity);
        }
        this.selection = { kind: "entity", id: entity.id };
        this.#panel = "object";
        this.#renderEntities();
        this.#renderPanel();
        this.#changed();
    }

    /**
     * Removes the object at a cell.
     *
     * @param {{ x: number, y: number }} cell - Cell.
     * @param {boolean} [record=true] - Whether to record an undo step now.
     * @returns {boolean} True when something was removed.
     */
    #removeEntityAt(cell, record = true) {
        const entity = this.#entityAt(cell);
        if (!entity) return false;
        this.level.entities = this.level.entities.filter((item) => item !== entity);
        if (this.selection?.id === entity.id) this.selection = null;
        this.#renderEntities();
        this.#renderPanel();
        if (record) this.#changed();
        else this.dirty = true;
        return true;
    }

    /**
     * Topmost object on a cell.
     *
     * @param {{ x: number, y: number }} cell - Cell.
     * @returns {*} The object or undefined.
     */
    #entityAt(cell) {
        for (let i = this.level.entities.length - 1; i >= 0; i--) {
            const entity = this.level.entities[i];
            const wide = entity.type === "zipMover" ? 2 : 1;
            if (cell.y === entity.y && cell.x >= entity.x && cell.x < entity.x + wide) return entity;
        }
        return undefined;
    }

    /**
     * Event whose area covers a cell.
     *
     * @param {{ x: number, y: number }} cell - Cell.
     * @returns {*} The event or undefined.
     */
    #eventAt(cell) {
        return [...this.level.events].reverse().find((event) => {
            const t = event.trigger;
            return t.type === "enter" && cell.x >= t.x && cell.x < t.x + t.w && cell.y >= t.y && cell.y < t.y + t.h;
        });
    }

    /**
     * Deletes the selected object or event.
     *
     * @returns {void}
     */
    deleteSelection() {
        if (!this.selection) return;
        if (this.selection.kind === "entity") {
            this.level.entities = this.level.entities.filter((item) => item.id !== this.selection.id);
        } else {
            this.level.events = this.level.events.filter((item) => item.id !== this.selection.id);
        }
        this.selection = null;
        this.#renderEntities();
        this.#renderEvents();
        this.#renderPanel();
        this.#changed();
    }

    /**
     * Records the current level for undo once a change is complete.
     *
     * @param {boolean} [soon=false] - Wait briefly so typing becomes one step.
     * @returns {void}
     */
    #changed(soon = false) {
        this.dirty = true;
        this.#updateStatus();
        clearTimeout(this.#commitTimer);
        const commit = () => {
            const snapshot = JSON.stringify(this.level);
            if (snapshot === this.#lastSnapshot) return;
            this.#undo.push(this.#lastSnapshot);
            if (this.#undo.length > HISTORY_LIMIT) this.#undo.shift();
            this.#redo = [];
            this.#lastSnapshot = snapshot;
        };
        if (soon) this.#commitTimer = setTimeout(commit, 400);
        else commit();
    }

    /**
     * Steps back one change.
     *
     * @returns {void}
     */
    undo() {
        if (!this.level || !this.#undo.length) return;
        this.#redo.push(JSON.stringify(this.level));
        this.#restore(this.#undo.pop());
    }

    /**
     * Repeats an undone change.
     *
     * @returns {void}
     */
    redo() {
        if (!this.level || !this.#redo.length) return;
        this.#undo.push(JSON.stringify(this.level));
        this.#restore(this.#redo.pop());
    }

    /**
     * Replaces the level with a snapshot.
     *
     * @param {string} snapshot - Serialised level.
     * @returns {void}
     */
    #restore(snapshot) {
        this.level = JSON.parse(snapshot);
        this.#lastSnapshot = snapshot;
        if (this.selection && ![...this.level.entities, ...this.level.events].some((item) => item.id === this.selection.id)) this.selection = null;
        this.dirty = true;
        this.#renderAll();
    }

    /**
     * Saves the level in the browser.
     *
     * @returns {boolean} True when it was stored.
     */
    save() {
        if (!this.level) return false;
        const ok = saveLevel(this.level);
        if (ok) {
            this.dirty = false;
            this.flash("Saved");
        } else {
            this.flash("Could not save: browser storage is full or blocked", true);
        }
        this.#updateStatus();
        return ok;
    }

    /**
     * Shows a short message in the status bar.
     *
     * @param {string} text - Message.
     * @param {boolean} [error=false] - Style it as a problem.
     * @returns {void}
     */
    flash(text, error = false) {
        const note = el("div", `ed-note${error ? " ed-note-error" : ""}`, text);
        this.root.appendChild(note);
        setTimeout(() => note.classList.add("leaving"), 1800);
        setTimeout(() => note.remove(), 2300);
    }

    /**
     * Plays the level, from the start or from a chosen cell.
     *
     * @param {{ x: number, y: number }} [from] - Cell to start on instead of the player start.
     * @returns {void}
     */
    playtest(from) {
        if (!this.level) return;
        const problems = levelProblems(this.level);
        if (problems.length) {
            this.#message("This level can't be played yet", problems);
            return;
        }
        if (from && this.level.tiles[from.y]?.[from.x] !== ".") {
            this.flash("Hover an empty cell to play from it", true);
            return;
        }
        this.host.playtest(structuredClone(this.level), from);
    }

    /**
     * Leaves developer mode, asking first when there are unsaved changes.
     *
     * @returns {void}
     */
    exit() {
        if (this.dirty) {
            this.#confirm("Leave without saving?", "Your latest changes are not saved in this browser.", "Leave", () => this.host.exit(), "Save and leave", () => {
                if (this.save()) this.host.exit();
            });
            return;
        }
        this.host.exit();
    }

    /**
     * Fits the whole level into the view.
     *
     * @returns {void}
     */
    #fitView() {
        if (!this.level) return;
        const rect = this.#ui.viewport.getBoundingClientRect();
        const width = rect.width || window.innerWidth - 520;
        const height = rect.height || window.innerHeight - 120;
        const zoom = Math.min(1, Math.max(0.15, Math.min((width - 40) / (this.level.width * CELL), (height - 40) / (this.level.height * CELL))));
        this.view.zoom = zoom;
        this.view.x = (width - this.level.width * CELL * zoom) / 2;
        this.view.y = (height - this.level.height * CELL * zoom) / 2;
        this.#applyView();
    }

    /**
     * Applies pan and zoom to the world element.
     *
     * @returns {void}
     */
    #applyView() {
        this.#ui.world.style.transform = `translate(${Math.round(this.view.x)}px, ${Math.round(this.view.y)}px) scale(${this.view.zoom})`;
    }

    /**
     * Redraws everything.
     *
     * @returns {void}
     */
    #renderAll() {
        if (!this.level) return;
        this.#ui.name.value = this.level.name;
        const world = this.#ui.world;
        world.style.width = `${this.level.width * CELL}px`;
        world.style.height = `${this.level.height * CELL}px`;
        world.dataset.theme = this.level.settings.theme;
        this.#ui.tilesLayer.textContent = "";
        this.#tileElems.clear();
        this.#refreshTiles(0, 0, this.level.width, this.level.height);
        this.#renderEntities();
        this.#renderEvents();
        this.#renderPanel();
        this.#refreshPalette();
        this.#applyView();
        this.#updateStatus();
    }

    /**
     * Updates the tile elements in a region, choosing edge variants from
     * the neighbours like the game does.
     *
     * @param {number} x0 - Left column.
     * @param {number} y0 - Top row.
     * @param {number} w - Width.
     * @param {number} h - Height.
     * @returns {void}
     */
    #refreshTiles(x0, y0, w, h) {
        const level = this.level;
        const solid = (x, y) => x < 0 || y < 0 || x >= level.width || y >= level.height || level.tiles[y][x] !== ".";
        for (let y = Math.max(0, y0); y < Math.min(level.height, y0 + h); y++) {
            for (let x = Math.max(0, x0); x < Math.min(level.width, x0 + w); x++) {
                const key = `${x},${y}`;
                const ch = level.tiles[y][x];
                let node = this.#tileElems.get(key);
                if (ch === ".") {
                    if (node) {
                        node.remove();
                        this.#tileElems.delete(key);
                    }
                    continue;
                }
                if (!node) {
                    node = el("div", "ed-tile");
                    node.style.left = `${x * CELL}px`;
                    node.style.top = `${y * CELL}px`;
                    this.#ui.tilesLayer.appendChild(node);
                    this.#tileElems.set(key, node);
                }
                const mask = (solid(x, y - 1) ? 0 : 1) | (solid(x + 1, y) ? 0 : 2) | (solid(x, y + 1) ? 0 : 4) | (solid(x - 1, y) ? 0 : 8);
                node.style.backgroundImage = `url("${TILE_TYPES[ch].strip}")`;
                node.style.backgroundPosition = `${-mask * CELL}px 0px`;
            }
        }
    }

    /**
     * Redraws the placed objects.
     *
     * @returns {void}
     */
    #renderEntities() {
        const layer = this.#ui.entityLayer;
        layer.textContent = "";
        for (const entity of this.level.entities) {
            const spec = ENTITY_TYPES[entity.type];
            const node = el("div", `ed-entity ed-icon ed-icon-${spec.icon}`);
            node.style.left = `${entity.x * CELL}px`;
            node.style.top = `${entity.y * CELL}px`;
            node.title = spec.name;
            if (entity.type === "spike") node.style.backgroundImage = `url("${SPIKE_IMAGES[entity.dir]}")`;
            if (entity.type === "spike") node.dataset.dir = entity.dir;
            if (entity.type === "falling" && entity.trigger === "event") node.classList.add("ed-waits");
            if (this.selection?.kind === "entity" && this.selection.id === entity.id) node.classList.add("selected");
            layer.appendChild(node);
            if ((entity.type === "dustBunny" || entity.type === "zipMover") && (entity.dx || entity.dy)) {
                const path = el("div", "ed-path");
                const sx = entity.x * CELL + (entity.type === "zipMover" ? CELL : CELL / 2);
                const sy = entity.y * CELL + CELL / 2;
                const length = Math.hypot(entity.dx, entity.dy) * CELL;
                Object.assign(path.style, { left: `${sx}px`, top: `${sy}px`, width: `${length}px`, transform: `rotate(${Math.atan2(entity.dy, entity.dx)}rad)` });
                layer.appendChild(path);
            }
        }
    }

    /**
     * Redraws the event areas.
     *
     * @returns {void}
     */
    #renderEvents() {
        const layer = this.#ui.eventLayer;
        layer.textContent = "";
        for (const event of this.level.events) {
            if (event.trigger.type !== "enter") continue;
            const t = event.trigger;
            const node = el("div", "ed-area", event.name);
            Object.assign(node.style, { left: `${t.x * CELL}px`, top: `${t.y * CELL}px`, width: `${t.w * CELL}px`, height: `${t.h * CELL}px` });
            if (this.selection?.kind === "event" && this.selection.id === event.id) node.classList.add("selected");
            layer.appendChild(node);
        }
    }

    /**
     * Updates the status bar.
     *
     * @returns {void}
     */
    #updateStatus() {
        if (!this.#ui.status || !this.level) return;
        const hover = this.#hover ? `${this.#hover.x}, ${this.#hover.y}` : "—";
        const toolName = this.tool === "place" ? `Place ${ENTITY_TYPES[this.placing]?.name ?? ""}` : TOOLS.find(([id]) => id === this.tool)?.[1] ?? this.tool;
        this.#ui.status.textContent = `${toolName}  ·  Cell ${hover}  ·  ${this.level.width} × ${this.level.height}  ·  Zoom ${Math.round(this.view.zoom * 100)}%  ·  ${this.dirty ? "Unsaved changes" : "Saved"}  ·  Space drag to pan, wheel to zoom, F to fit, P to play from the cursor`;
    }

    /**
     * Fills the side panel for the active tab.
     *
     * @returns {void}
     */
    #renderPanel() {
        if (!this.level) return;
        for (const tab of this.#ui.tabs.children) tab.classList.toggle("active", tab.dataset.panel === this.#panel);
        const panel = this.#ui.panel;
        panel.textContent = "";
        if (this.#panel === "level") this.#levelPanel(panel);
        else if (this.#panel === "object") this.#objectPanel(panel);
        else this.#eventsPanel(panel);
    }

    /**
     * Level name, size and play settings.
     *
     * @param {HTMLElement} panel - Panel element.
     * @returns {void}
     */
    #levelPanel(panel) {
        const level = this.level;
        const text = (value, onInput) => {
            const input = el("input", "ed-input");
            input.value = value;
            input.addEventListener("input", () => onInput(input.value));
            return input;
        };
        const number = (value, min, max, onInput) => {
            const input = el("input", "ed-input");
            input.type = "number";
            input.min = String(min);
            input.max = String(max);
            input.value = String(value);
            input.addEventListener("change", () => onInput(Math.round(Math.min(max, Math.max(min, Number(input.value) || min)))));
            return input;
        };
        panel.append(
            row("Name", text(level.name, (value) => {
                level.name = value.slice(0, 60) || "Untitled level";
                this.#ui.name.value = level.name;
                this.#changed(true);
            })),
            row("Author", text(level.author, (value) => {
                level.author = value.slice(0, 60);
                this.#changed(true);
            })),
            row("Background", select(THEME_OPTIONS.map(([id, name]) => [id, name]), level.settings.theme, (value) => {
                level.settings.theme = value;
                this.#ui.world.dataset.theme = value;
                this.#changed();
            })),
            row("Weather", select([["none", "Clear"], ["snow", "Snow"], ["heavy", "Heavy snow"], ["blizzard", "Blizzard"]].filter(([id]) => WEATHER_PRESETS[id]), level.settings.weather, (value) => {
                level.settings.weather = value;
                this.#changed();
            })),
            row("Time limit (s)", number(level.settings.timeLimit, 30, 3600, (value) => {
                level.settings.timeLimit = value;
                this.#changed();
            })),
            row("Lives", number(level.settings.lives, 1, 99, (value) => {
                level.settings.lives = value;
                this.#changed();
            })),
            row("Dashes", number(level.settings.dashes, 0, 2, (value) => {
                level.settings.dashes = value;
                this.#changed();
            }))
        );
        const size = el("div", "ed-group");
        const width = number(level.width, LEVEL_LIMITS.minWidth, LEVEL_LIMITS.maxWidth, () => {});
        const height = number(level.height, LEVEL_LIMITS.minHeight, LEVEL_LIMITS.maxHeight, () => {});
        const anchor = select([["top", "Keep the top"], ["bottom", "Keep the bottom"]], "bottom", () => {});
        size.append(el("h4", "", "Size in cells"), row("Width", width), row("Height", height), row("When resizing", anchor),
            button("Apply size", () => this.#resize(Number(width.value), Number(height.value), anchor.value), "ed-btn"));
        const problems = levelProblems(level);
        const check = el("div", "ed-group");
        check.append(el("h4", "", "Ready to play?"));
        if (problems.length) for (const problem of problems) check.appendChild(el("p", "ed-problem", problem));
        else check.appendChild(el("p", "ed-ok", "Looks playable. Press Playtest to try it."));
        const counts = el("p", "ed-muted", `${level.entities.length} objects · ${level.events.length} events · ${level.entities.filter((e) => e.type === "checkpoint").length} checkpoints · ${level.entities.filter((e) => e.type === "strawberry").length} strawberries`);
        check.appendChild(counts);
        panel.append(size, check);
    }

    /**
     * Changes the level size, keeping the top or bottom edge in place.
     *
     * @param {number} width - New width.
     * @param {number} height - New height.
     * @param {string} anchor - "top" or "bottom".
     * @returns {void}
     */
    #resize(width, height, anchor) {
        const level = this.level;
        width = Math.round(Math.min(LEVEL_LIMITS.maxWidth, Math.max(LEVEL_LIMITS.minWidth, width || level.width)));
        height = Math.round(Math.min(LEVEL_LIMITS.maxHeight, Math.max(LEVEL_LIMITS.minHeight, height || level.height)));
        const shift = anchor === "bottom" ? height - level.height : 0;
        const rows = [];
        for (let y = 0; y < height; y++) {
            const source = level.tiles[y - shift] ?? "";
            rows.push(source.slice(0, width).padEnd(width, "."));
        }
        level.tiles = rows;
        level.width = width;
        level.height = height;
        level.entities = level.entities
            .map((entity) => ({ ...entity, y: entity.y + shift }))
            .filter((entity) => entity.x < width && entity.y >= 0 && entity.y < height);
        for (const event of level.events) {
            if (event.trigger.type !== "enter") continue;
            const t = event.trigger;
            t.y = Math.max(0, Math.min(height - 1, t.y + shift));
            t.x = Math.min(width - 1, t.x);
            t.w = Math.max(1, Math.min(t.w, width - t.x));
            t.h = Math.max(1, Math.min(t.h, height - t.y));
        }
        this.#changed();
        this.#fitView();
        this.#renderAll();
    }

    /**
     * Inspector for the selected object.
     *
     * @param {HTMLElement} panel - Panel element.
     * @returns {void}
     */
    #objectPanel(panel) {
        const entity = this.selection?.kind === "entity" ? this.level.entities.find((item) => item.id === this.selection.id) : null;
        if (!entity) {
            panel.append(el("p", "ed-muted", "Nothing selected. Use the Select tool (V) and click an object, or pick one from the Objects list and click the map to place it."));
            return;
        }
        const spec = ENTITY_TYPES[entity.type];
        panel.append(el("h4", "", spec.name), el("p", "ed-muted", `Cell ${entity.x}, ${entity.y} · id ${entity.id}`));
        panel.appendChild(fieldInputs(spec.fields, entity, () => {
            this.#renderEntities();
            this.#changed(true);
        }));
        if (entity.type === "falling" && entity.trigger === "event") {
            panel.appendChild(el("p", "ed-muted", "Add a \"Drop falling block\" action to an event and pick this block to make it fall."));
        }
        panel.appendChild(button("Delete object", () => this.deleteSelection(), "ed-btn ed-danger"));
    }

    /**
     * Event list and the editor for the selected event.
     *
     * @param {HTMLElement} panel - Panel element.
     * @returns {void}
     */
    #eventsPanel(panel) {
        const level = this.level;
        const list = el("div", "ed-event-list");
        for (const event of level.events) {
            const item = button(`${event.name} · ${TRIGGER_TYPES[event.trigger.type].name}`, () => {
                this.selection = { kind: "event", id: event.id };
                this.#renderEvents();
                this.#renderPanel();
            }, "ed-event-item");
            if (this.selection?.kind === "event" && this.selection.id === event.id) item.classList.add("active");
            list.appendChild(item);
        }
        if (!level.events.length) list.appendChild(el("p", "ed-muted", "No events yet. Drag an area with the Event area tool (T), or add one that starts another way."));
        const add = el("div", "ed-row");
        const triggerChoice = select(Object.entries(TRIGGER_TYPES).map(([id, spec]) => [id, spec.name]), "start", () => {});
        add.append(triggerChoice, button("+ Event", () => {
            const type = triggerChoice.value;
            if (type === "enter") {
                this.setTool("event");
                this.flash("Drag an area on the map for the new event");
                return;
            }
            const created = { id: newId("ev"), name: `Event ${level.events.length + 1}`, once: true, trigger: { type, ...fieldDefaults(TRIGGER_TYPES[type].fields) }, actions: [] };
            level.events.push(created);
            this.selection = { kind: "event", id: created.id };
            this.#changed();
            this.#renderPanel();
        }, "ed-btn"));
        panel.append(el("h4", "", "Events"), list, add);

        const event = this.selection?.kind === "event" ? level.events.find((item) => item.id === this.selection.id) : null;
        if (!event) return;
        const editor = el("div", "ed-group ed-event");
        const name = el("input", "ed-input");
        name.value = event.name;
        name.addEventListener("input", () => {
            event.name = name.value.slice(0, 60);
            this.#renderEvents();
            this.#changed(true);
        });
        const once = el("input", "ed-check");
        once.type = "checkbox";
        once.checked = event.once;
        once.addEventListener("change", () => {
            event.once = once.checked;
            this.#changed();
        });
        editor.append(el("h4", "", "Selected event"), row("Name", name), row("Only once", once));
        const trigger = select(Object.entries(TRIGGER_TYPES).map(([id, spec]) => [id, spec.name]), event.trigger.type, (type) => {
            const keep = event.trigger.type === "enter" ? { x: event.trigger.x, y: event.trigger.y, w: event.trigger.w, h: event.trigger.h } : null;
            event.trigger = { type, ...fieldDefaults(TRIGGER_TYPES[type].fields) };
            if (type === "enter") Object.assign(event.trigger, keep ?? { x: 0, y: 0, w: 3, h: 3 });
            this.#renderEvents();
            this.#changed();
            this.#renderPanel();
        });
        editor.append(row("Starts when", trigger), fieldInputs(TRIGGER_TYPES[event.trigger.type].fields, event.trigger, () => this.#changed(true)));
        if (event.trigger.type === "enter") {
            const t = event.trigger;
            editor.append(el("p", "ed-muted", `Area: column ${t.x}, row ${t.y}, ${t.w} × ${t.h} cells. Drag it with the Select tool.`),
                button("Redraw area", () => {
                    event.redraw = true;
                    this.setTool("event");
                    this.flash("Drag the new area on the map");
                }, "ed-btn"));
        }
        const actions = el("div", "ed-actions");
        const targets = level.entities.filter((item) => item.type === "falling").map((item) => [item.id, `Block at ${item.x}, ${item.y}${item.trigger === "event" ? "" : " (falls when stood on)"}`]);
        event.actions.forEach((action, index) => {
            const card = el("div", "ed-action");
            const head = el("div", "ed-action-head");
            head.append(el("span", "ed-action-name", `${index + 1}. ${ACTION_TYPES[action.type].name}`),
                button("↑", () => {
                    if (index === 0) return;
                    [event.actions[index - 1], event.actions[index]] = [event.actions[index], event.actions[index - 1]];
                    this.#changed();
                    this.#renderPanel();
                }, "ed-btn ed-mini", "Run earlier"),
                button("↓", () => {
                    if (index === event.actions.length - 1) return;
                    [event.actions[index + 1], event.actions[index]] = [event.actions[index], event.actions[index + 1]];
                    this.#changed();
                    this.#renderPanel();
                }, "ed-btn ed-mini", "Run later"),
                button("✕", () => {
                    event.actions.splice(index, 1);
                    this.#changed();
                    this.#renderPanel();
                }, "ed-btn ed-mini ed-danger", "Remove action"));
            card.append(head, fieldInputs(ACTION_TYPES[action.type].fields, action, () => this.#changed(true), { targets }));
            actions.appendChild(card);
        });
        const addAction = el("div", "ed-row");
        const actionChoice = select(Object.entries(ACTION_TYPES).map(([id, spec]) => [id, spec.name]), "dialogue", () => {});
        addAction.append(actionChoice, button("+ Action", () => {
            const type = actionChoice.value;
            const action = { type, ...fieldDefaults(ACTION_TYPES[type].fields) };
            if (type === "dialogue") action.lines = [{ speaker: "madeline", emotion: "normal", text: "" }];
            event.actions.push(action);
            this.#changed();
            this.#renderPanel();
        }, "ed-btn"));
        editor.append(el("h4", "", "Actions, in order"), actions, addAction,
            button("Duplicate event", () => {
                const copy = structuredClone(event);
                copy.id = newId("ev");
                copy.name = `${event.name} copy`;
                if (copy.trigger.type === "enter") copy.trigger.x = Math.min(level.width - copy.trigger.w, copy.trigger.x + 2);
                level.events.push(copy);
                this.selection = { kind: "event", id: copy.id };
                this.#renderEvents();
                this.#changed();
                this.#renderPanel();
            }, "ed-btn"),
            button("Delete event", () => this.deleteSelection(), "ed-btn ed-danger"));
        panel.appendChild(editor);
    }

    /**
     * Shows the level list: open, play, export, duplicate, delete, import
     * and new.
     *
     * @returns {void}
     */
    showManager() {
        const modal = this.#openModal("ed-manager");
        const head = el("div", "ed-modal-head");
        head.append(el("h2", "", "Your levels"),
            button("New level", () => this.#newLevelDialog(), "ed-btn ed-primary"),
            button("Import JSON", () => this.#import(), "ed-btn"),
            button("Open Chapter 4 as an example", async () => {
                const example = await this.host.example();
                if (example) this.load(duplicateLevel(example, " (my copy)"), true);
            }, "ed-btn"));
        const list = el("div", "ed-level-list");
        const levels = listLevels();
        if (!levels.length) list.appendChild(el("p", "ed-muted", "Nothing saved yet. Start a new level, import a JSON file, or open Chapter 4 to see how a finished level is put together."));
        for (const info of levels) {
            const item = el("div", "ed-level-item");
            const when = new Date(info.updated).toLocaleString();
            item.append(el("div", "ed-level-name", info.name), el("div", "ed-muted", `${info.width} × ${info.height} · saved ${when}`));
            const actions = el("div", "ed-row");
            actions.append(
                button("Edit", () => {
                    const level = loadLevel(info.id);
                    if (level) this.#guard(() => this.load(level));
                }, "ed-btn ed-primary"),
                button("Play", () => {
                    const level = loadLevel(info.id);
                    if (!level) return;
                    const problems = levelProblems(level);
                    if (problems.length) this.#message("This level can't be played yet", problems);
                    else this.host.play(level);
                }, "ed-btn ed-play"),
                button("Export", () => {
                    const level = loadLevel(info.id);
                    if (level) exportLevel(level);
                }, "ed-btn"),
                button("Duplicate", () => {
                    const level = loadLevel(info.id);
                    if (!level) return;
                    saveLevel(duplicateLevel(level));
                    this.showManager();
                }, "ed-btn"),
                button("Delete", () => this.#confirm(`Delete "${info.name}"?`, "This removes it from this browser. Export it first if you want to keep a copy.", "Delete", () => {
                    deleteLevel(info.id);
                    if (this.level?.id === info.id) this.dirty = true;
                    this.showManager();
                }), "ed-btn ed-danger"));
            item.appendChild(actions);
            list.appendChild(item);
        }
        const foot = el("div", "ed-row ed-modal-foot");
        if (this.level) foot.appendChild(button("Back to the editor", () => this.#closeModal(), "ed-btn"));
        foot.appendChild(button("Back to the main menu", () => this.exit(), "ed-btn ed-quiet"));
        modal.append(head, list, foot);
    }

    /**
     * Runs an action, asking first if it would throw away unsaved changes.
     *
     * @param {() => void} action - Action to run.
     * @returns {void}
     */
    #guard(action) {
        if (!this.dirty || !this.level) {
            action();
            return;
        }
        this.#confirm("Discard unsaved changes?", `"${this.level.name}" has changes that are not saved.`, "Discard", action, "Save first", () => {
            if (this.save()) action();
        });
    }

    /**
     * Asks for the size of a new level.
     *
     * @returns {void}
     */
    #newLevelDialog() {
        const modal = this.#openModal("ed-small");
        const width = el("input", "ed-input");
        width.type = "number";
        width.value = "60";
        const height = el("input", "ed-input");
        height.type = "number";
        height.value = "24";
        modal.append(el("h2", "", "New level"),
            el("p", "ed-muted", "Size is in 50 pixel cells. One screen is 24 × 10 cells. You can change it later from the Level tab."),
            row("Width", width), row("Height", height),
            el("div", "ed-row", ""));
        const actions = modal.lastChild;
        actions.append(button("Create", () => this.#guard(() => {
            const w = Math.round(Math.min(LEVEL_LIMITS.maxWidth, Math.max(LEVEL_LIMITS.minWidth, Number(width.value) || 60)));
            const h = Math.round(Math.min(LEVEL_LIMITS.maxHeight, Math.max(LEVEL_LIMITS.minHeight, Number(height.value) || 24)));
            this.load(createLevel(w, h), true);
        }), "ed-btn ed-primary"), button("Cancel", () => this.showManager(), "ed-btn ed-quiet"));
    }

    /**
     * Imports a level file and opens it.
     *
     * @returns {Promise<void>} Resolves when done.
     */
    async #import() {
        try {
            const level = await importLevel();
            if (!level) return;
            const clash = loadLevel(level.id);
            const opened = clash ? duplicateLevel(level, " (imported)") : level;
            this.#guard(() => {
                this.load(opened, true);
                this.flash(`Imported "${opened.name}". Save it to keep it here.`);
            });
        } catch (error) {
            this.#message("Couldn't import that file", [error.message]);
        }
    }

    /**
     * Opens the modal with a fresh body.
     *
     * @param {string} [className] - Extra class for sizing.
     * @returns {HTMLElement} The modal box to fill.
     */
    #openModal(className = "") {
        const modal = this.#ui.modal;
        modal.textContent = "";
        modal.classList.remove("hidden");
        const box = el("div", `ed-modal-box ${className}`);
        modal.appendChild(box);
        return box;
    }

    /**
     * Closes the modal.
     *
     * @returns {void}
     */
    #closeModal() {
        this.#ui.modal?.classList.add("hidden");
        if (this.#ui.modal) this.#ui.modal.textContent = "";
    }

    /**
     * Shows a message with a list of details.
     *
     * @param {string} title - Heading.
     * @param {string[]} lines - Details.
     * @returns {void}
     */
    #message(title, lines) {
        const box = this.#openModal("ed-small");
        box.append(el("h2", "", title));
        for (const line of lines) box.appendChild(el("p", "ed-problem", line));
        box.appendChild(button("OK", () => (this.level ? this.#closeModal() : this.showManager()), "ed-btn ed-primary"));
    }

    /**
     * Asks a yes or no question, with an optional third choice.
     *
     * @param {string} title - Question.
     * @param {string} text - Explanation.
     * @param {string} yesLabel - Label of the main choice.
     * @param {() => void} onYes - Main choice.
     * @param {string} [altLabel] - Label of the alternative.
     * @param {() => void} [onAlt] - Alternative choice.
     * @returns {void}
     */
    #confirm(title, text, yesLabel, onYes, altLabel, onAlt) {
        const box = this.#openModal("ed-small");
        const actions = el("div", "ed-row");
        actions.append(button(yesLabel, () => {
            this.#closeModal();
            onYes();
        }, "ed-btn ed-danger"));
        if (altLabel) actions.append(button(altLabel, () => {
            this.#closeModal();
            onAlt();
        }, "ed-btn ed-primary"));
        actions.append(button("Cancel", () => this.#closeModal(), "ed-btn ed-quiet"));
        box.append(el("h2", "", title), el("p", "", text), actions);
    }
}
