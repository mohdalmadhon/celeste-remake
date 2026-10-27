/**
 * Sprite sheet description used to compute background positions.
 *
 * @typedef {object} SpriteSheet
 * @property {string} src - Image URL.
 * @property {number} frameWidth - Width of one frame in the source image.
 * @property {number} frameHeight - Height of one frame in the source image.
 * @property {number} scale - Display scale applied to the image.
 * @property {number} [sheetWidth] - Source image width, required when scale is not 1.
 * @property {number} [sheetHeight] - Source image height, required when scale is not 1.
 */

/**
 * Visual-only transform applied on top of the entity position.
 *
 * @typedef {object} VisualState
 * @property {number} scaleX - Horizontal stretch.
 * @property {number} scaleY - Vertical stretch.
 * @property {number} offsetX - Horizontal pixel offset.
 * @property {number} offsetY - Vertical pixel offset.
 * @property {number} rotation - Rotation in degrees.
 * @property {number} opacity - Opacity from 0 to 1.
 */

/**
 * Base game object rendered as an absolutely positioned DOM element.
 *
 * Position updates are interpolated between fixed simulation steps and the
 * element is only touched when its transform, frame or visibility changes.
 */
export class Entity {
    /** @type {string} */
    id = "";
    /** @type {boolean} */
    freeze = false;
    /** @type {boolean} */
    alive = true;
    /** @type {{ x: number, y: number }} */
    position = { x: 0, y: 0 };
    /** @type {{ x: number, y: number }} */
    previous = { x: 0, y: 0 };
    /** @type {{ width: number, height: number }} */
    dimensions = { width: 0, height: 0 };
    /** @type {Record<string, *>} */
    components = {};
    /** @type {HTMLDivElement} */
    elem;
    /** @type {((entity: Entity, dt: number, entities: Entity[]) => void)|undefined} */
    update;
    /** @type {SpriteSheet|null} */
    sheet = null;
    /** @type {VisualState} */
    visual = { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 1 };
    /** @type {number} */
    facing = 1;
    /** @type {boolean} */
    visible = true;
    /** @type {string} */
    layer = "entities";
    /** @type {string} */
    #lastTransform = "";
    /** @type {string} */
    #lastFrame = "";
    /** @type {number} */
    #lastOpacity = 1;
    /** @type {boolean} */
    #lastShown = true;

    /**
     * @param {{ x: number, y: number }} [position] - Top-left position in world pixels.
     * @param {{ width: number, height: number }} [dimensions] - Element size in pixels.
     * @param {string} [id] - Optional identifier.
     */
    constructor(position = { x: 0, y: 0 }, dimensions = { height: 0, width: 0 }, id = "") {
        this.position = { x: position.x, y: position.y };
        this.previous = { x: position.x, y: position.y };
        this.dimensions = { width: dimensions.width, height: dimensions.height };
        this.id = id;
        this.elem = document.createElement("div");
        this.elem.className = "entity";
        this.elem.style.width = `${this.dimensions.width}px`;
        this.elem.style.height = `${this.dimensions.height}px`;
    }

    /**
     * Sets the background image. Pass sheet details to enable frame selection.
     *
     * @param {string} [src=""] - Image URL.
     * @param {Partial<SpriteSheet>} [options] - Frame layout and scale.
     * @returns {void}
     */
    setSpriteSheet(src = "", options = {}) {
        this.spriteSheet = src;
        this.elem.style.backgroundImage = `url("${src}")`;
        if (options.frameWidth) {
            this.sheet = {
                src,
                frameWidth: options.frameWidth,
                frameHeight: options.frameHeight ?? options.frameWidth,
                scale: options.scale ?? 1,
                sheetWidth: options.sheetWidth,
                sheetHeight: options.sheetHeight
            };
            if (this.sheet.scale !== 1 && this.sheet.sheetWidth) {
                this.elem.style.backgroundSize = `${this.sheet.sheetWidth * this.sheet.scale}px ${this.sheet.sheetHeight * this.sheet.scale}px`;
            }
            this.#lastFrame = "";
        } else if (options.stretch) {
            this.elem.style.backgroundSize = "100% 100%";
        }
    }

    /**
     * Shows a frame of the sprite sheet.
     *
     * @param {number} column - Frame column.
     * @param {number} row - Frame row.
     * @returns {void}
     */
    setFrame(column, row) {
        const key = `${column},${row}`;
        if (key === this.#lastFrame) return;
        this.#lastFrame = key;
        const sheet = this.sheet;
        const width = sheet ? sheet.frameWidth * sheet.scale : this.dimensions.width;
        const height = sheet ? sheet.frameHeight * sheet.scale : this.dimensions.height;
        this.elem.style.backgroundPosition = `${-column * width}px ${-row * height}px`;
    }

    /**
     * Assigns the per-step update function.
     *
     * @param {(entity: Entity, dt: number, entities: Entity[]) => void} func - Update callback.
     * @returns {void}
     */
    setUpdate(func) {
        if (typeof func !== "function") {
            throw new TypeError(`${func} is not a function`);
        }
        this.update = func;
    }

    /**
     * Stores the current position as the interpolation start for the next step.
     *
     * @returns {void}
     */
    savePrevious() {
        this.previous.x = this.position.x;
        this.previous.y = this.position.y;
    }

    /**
     * Cancels interpolation, used after teleporting.
     *
     * @returns {void}
     */
    snap() {
        this.savePrevious();
    }

    /**
     * Whether the entity overlaps a world-space rectangle.
     *
     * @param {number} left - Left edge.
     * @param {number} top - Top edge.
     * @param {number} right - Right edge.
     * @param {number} bottom - Bottom edge.
     * @returns {boolean} True when inside the rectangle.
     */
    intersectsView(left, top, right, bottom) {
        const margin = 64;
        return this.position.x + this.dimensions.width + margin > left &&
            this.position.x - margin < right &&
            this.position.y + this.dimensions.height + margin > top &&
            this.position.y - margin < bottom;
    }

    /**
     * Writes the interpolated transform to the DOM element when it changed.
     *
     * @param {number} alpha - Interpolation factor between the last two steps.
     * @param {{ left: number, top: number, right: number, bottom: number }} view - Visible world rectangle.
     * @returns {void}
     */
    render(alpha, view) {
        const shown = this.visible && this.intersectsView(view.left, view.top, view.right, view.bottom);
        if (shown !== this.#lastShown) {
            this.#lastShown = shown;
            this.elem.style.display = shown ? "" : "none";
        }
        if (!shown) return;
        const v = this.visual;
        const x = Math.round(this.previous.x + (this.position.x - this.previous.x) * alpha + v.offsetX);
        const y = Math.round(this.previous.y + (this.position.y - this.previous.y) * alpha + v.offsetY);
        const sx = (this.components.movement?.direction ?? this.facing) * v.scaleX;
        let transform = `translate3d(${x}px,${y}px,0)`;
        if (sx !== 1 || v.scaleY !== 1) transform += ` scale(${sx.toFixed(3)},${v.scaleY.toFixed(3)})`;
        if (v.rotation) transform += ` rotate(${v.rotation.toFixed(1)}deg)`;
        if (transform !== this.#lastTransform) {
            this.#lastTransform = transform;
            this.elem.style.transform = transform;
        }
        if (v.opacity !== this.#lastOpacity) {
            this.#lastOpacity = v.opacity;
            this.elem.style.opacity = String(v.opacity);
        }
    }
}
