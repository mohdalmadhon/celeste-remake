import { RENDER_CHUNK, VIEW_HEIGHT, VIEW_WIDTH } from "./core/constants.js";
import { Entity } from "./entities/entity.js";
import { CollisionWorld, createBody } from "./systems/physics.js";

/**
 * Description of a static tile.
 *
 * @typedef {object} TileOptions
 * @property {number} x - Left edge in world pixels.
 * @property {number} y - Top edge in world pixels.
 * @property {number} w - Width in pixels.
 * @property {number} h - Height in pixels.
 * @property {string} src - Image URL.
 * @property {boolean} [solid=true] - Whether the tile blocks movement.
 * @property {string} [layer="tiles"] - Render layer: back, tiles or front.
 * @property {string[]} [classes] - Extra CSS classes.
 * @property {string} [backgroundSize] - CSS background-size override.
 * @property {string} [backgroundPosition] - CSS background-position override.
 * @property {Partial<import("./systems/physics.js").Body>} [body] - Extra body properties.
 * @property {{ x: number, y: number, w: number, h: number }} [hitbox] - Collision box relative to the tile.
 * @property {"solid"|"hazard"|"trigger"} [kind] - Body kind, solid by default when solid is true.
 */

/**
 * A playable level: DOM layers, static tile chunks, dynamic entities and the collision world.
 *
 * Static tiles are written once into chunk containers that are hidden when
 * off screen, so each frame only the world transform and the dynamic
 * entities are updated.
 */
export class Level {
    /** @type {string} */
    id;
    /** @type {HTMLElement} */
    parent;
    /** @type {HTMLDivElement} */
    root;
    /** @type {Record<string, HTMLDivElement>} */
    layers = {};
    /** @type {CollisionWorld} */
    world = new CollisionWorld();
    /** @type {Entity[]} */
    entities = [];
    /** @type {Array<(entities: Entity[], dt: number) => void>} */
    systems = [];
    /** @type {Map<string, { elem: HTMLDivElement, x: number, y: number, visible: boolean }>} */
    #chunks = new Map();
    /** @type {{ left: number, top: number, right: number, bottom: number }} */
    contentBounds = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    /** @type {((dt: number) => void)|null} */
    conditions = null;
    /** @type {boolean} */
    end = false;
    /** @type {{ width: number, height: number }} */
    dimensions;
    /** @type {string} */
    #lastWorldTransform = "";

    /**
     * @param {{ width: number, height: number }} [dimensions] - Nominal level size.
     * @param {HTMLElement} [parent] - Element the level root is appended to.
     * @param {string} [id] - Level identifier.
     */
    constructor(dimensions = { width: VIEW_WIDTH, height: VIEW_HEIGHT }, parent = document.body, id = "") {
        this.dimensions = dimensions;
        this.parent = parent;
        this.id = id;
        this.root = document.createElement("div");
        this.root.className = "level";
        for (const name of ["back", "tiles", "entities", "fx", "front"]) {
            const layer = document.createElement("div");
            layer.className = `layer layer-${name}`;
            this.root.appendChild(layer);
            this.layers[name] = layer;
        }
        parent.appendChild(this.root);
    }

    /**
     * Returns the chunk container for a world position, creating it when needed.
     *
     * @param {string} layer - Layer name.
     * @param {number} x - World x.
     * @param {number} y - World y.
     * @returns {HTMLDivElement} The chunk element.
     */
    #chunk(layer, x, y) {
        const cx = Math.floor(x / RENDER_CHUNK.width);
        const cy = Math.floor(y / RENDER_CHUNK.height);
        const key = `${layer}:${cx}:${cy}`;
        let chunk = this.#chunks.get(key);
        if (!chunk) {
            const elem = document.createElement("div");
            elem.className = "chunk";
            elem.style.transform = `translate(${cx * RENDER_CHUNK.width}px, ${cy * RENDER_CHUNK.height}px)`;
            this.layers[layer].appendChild(elem);
            chunk = { elem, x: cx * RENDER_CHUNK.width, y: cy * RENDER_CHUNK.height, visible: true };
            this.#chunks.set(key, chunk);
        }
        return chunk;
    }

    /**
     * Grows the content bounds to include a rectangle.
     *
     * @param {number} x - Left edge.
     * @param {number} y - Top edge.
     * @param {number} w - Width.
     * @param {number} h - Height.
     * @returns {void}
     */
    includeBounds(x, y, w, h) {
        const b = this.contentBounds;
        b.left = Math.min(b.left, x);
        b.top = Math.min(b.top, y);
        b.right = Math.max(b.right, x + w);
        b.bottom = Math.max(b.bottom, y + h);
    }

    /**
     * Adds a static tile and its collision body.
     *
     * @param {TileOptions} options - Tile description.
     * @returns {{ elem: HTMLDivElement, body: import("./systems/physics.js").Body|null }} Created element and body.
     */
    addTile(options) {
        const layer = options.layer || "tiles";
        const chunk = this.#chunk(layer, options.x, options.y);
        const elem = document.createElement("div");
        elem.className = "tile";
        if (options.classes) elem.classList.add(...options.classes);
        elem.style.left = `${options.x - chunk.x}px`;
        elem.style.top = `${options.y - chunk.y}px`;
        elem.style.width = `${options.w}px`;
        elem.style.height = `${options.h}px`;
        if (options.src) elem.style.backgroundImage = `url("${options.src}")`;
        if (options.backgroundSize) elem.style.backgroundSize = options.backgroundSize;
        if (options.backgroundPosition) elem.style.backgroundPosition = options.backgroundPosition;
        chunk.elem.appendChild(elem);
        if (layer === "tiles") this.includeBounds(options.x, options.y, options.w, options.h);
        let body = null;
        const kind = options.kind || (options.solid === false ? null : "solid");
        if (kind) {
            const box = options.hitbox || { x: 0, y: 0, w: options.w, h: options.h };
            body = createBody(options.x + box.x, options.y + box.y, box.w, box.h, kind, { ...options.body, elem });
            this.world.add(body);
        }
        return { elem, body };
    }

    /**
     * Adds a collision body that has no visual.
     *
     * @param {import("./systems/physics.js").Body} body - Body to add.
     * @returns {import("./systems/physics.js").Body} The same body.
     */
    addBody(body) {
        return this.world.add(body);
    }

    /**
     * Adds a dynamic entity to a render layer.
     *
     * @param {Entity} entity - Entity to add.
     * @param {string} [layer] - Layer name, defaults to the entity's own layer.
     * @returns {Entity} The same entity.
     */
    addEntity(entity) {
        if (!(entity instanceof Entity)) return entity;
        if (!this.entities.includes(entity)) {
            this.entities.push(entity);
        }
        const target = this.layers[entity.layer] || this.layers.entities;
        if (entity.elem.parentNode !== target) target.appendChild(entity.elem);
        return entity;
    }

    /**
     * Removes a dynamic entity and its element.
     *
     * @param {Entity} entity - Entity to remove.
     * @returns {void}
     */
    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index !== -1) this.entities.splice(index, 1);
        entity.elem.remove();
        if (entity.body) this.world.remove(entity.body);
    }

    /**
     * Kept for compatibility with older level scripts; entities mount when added.
     *
     * @returns {void}
     */
    mountEntities() {
        for (const entity of this.entities) this.addEntity(entity);
    }

    /**
     * Registers a system that runs after entity updates every step.
     *
     * @param {(entities: Entity[], dt: number) => void} func - System function.
     * @returns {void}
     */
    addSystem(func) {
        if (typeof func !== "function") throw new TypeError(`${func} is not a function`);
        this.systems.push(func);
    }

    /**
     * Unregisters a system.
     *
     * @param {(entities: Entity[], dt: number) => void} func - System function.
     * @returns {void}
     */
    removeSystem(func) {
        const index = this.systems.indexOf(func);
        if (index !== -1) this.systems.splice(index, 1);
    }

    /**
     * Sets the per-step level script.
     *
     * @param {(dt: number) => void} func - Level script.
     * @returns {void}
     */
    setConditions(func) {
        this.conditions = func;
    }

    /**
     * Advances the level by one simulation step.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    update(dt) {
        for (const entity of this.entities) entity.savePrevious();
        if (this.conditions) this.conditions(dt);
        for (let i = 0; i < this.entities.length; i++) {
            const entity = this.entities[i];
            if (entity.update && !entity.freeze) entity.update(entity, dt, this.entities);
        }
        for (const system of this.systems) system(this.entities, dt);
    }

    /**
     * Renders the level for the current camera.
     *
     * @param {number} alpha - Interpolation factor between steps.
     * @param {import("./systems/camera.js").Camera} camera - Active camera.
     * @returns {void}
     */
    render(alpha, camera) {
        const pos = camera.renderPosition(alpha);
        const zoom = camera.zoom;
        const x = Math.round(pos.x * zoom);
        const y = Math.round(pos.y * zoom);
        const transform = zoom === 1
            ? `translate3d(${-x}px,${-y}px,0)`
            : `translate3d(${-x}px,${-y}px,0) scale(${zoom.toFixed(4)})`;
        if (transform !== this.#lastWorldTransform) {
            this.#lastWorldTransform = transform;
            this.root.style.transform = transform;
        }
        const view = {
            left: pos.x,
            top: pos.y,
            right: pos.x + camera.viewWidth,
            bottom: pos.y + camera.viewHeight
        };
        for (const chunk of this.#chunks.values()) {
            const visible = chunk.x + RENDER_CHUNK.width + 200 > view.left && chunk.x - 200 < view.right &&
                chunk.y + RENDER_CHUNK.height + 200 > view.top && chunk.y - 200 < view.bottom;
            if (visible !== chunk.visible) {
                chunk.visible = visible;
                chunk.elem.style.display = visible ? "" : "none";
            }
        }
        for (const entity of this.entities) entity.render(alpha, view);
    }

    /**
     * Removes kept entities and tears down the level DOM.
     *
     * @returns {void}
     */
    destroy() {
        this.root.remove();
        this.entities.length = 0;
        this.systems.length = 0;
        this.#chunks.clear();
    }

    /**
     * Kept for compatibility: removes every entity from the level.
     *
     * @returns {void}
     */
    removeEntities() {
        this.destroy();
    }
}
