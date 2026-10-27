import { COLLISION_CELL } from "../core/constants.js";

/**
 * Axis aligned box registered in the collision world.
 *
 * @typedef {object} Body
 * @property {number} x - Left edge in world pixels.
 * @property {number} y - Top edge in world pixels.
 * @property {number} w - Width in pixels.
 * @property {number} h - Height in pixels.
 * @property {"solid"|"hazard"|"trigger"} kind - How the body interacts with actors.
 * @property {boolean} [active] - Inactive bodies are ignored by every query.
 * @property {string} [direction] - Spike direction for hazards: up, down, left, right or any.
 * @property {string} [surface] - Surface material used for footstep sounds.
 * @property {boolean} [climbable] - Whether the player can grab this solid, true by default.
 * @property {Function} [onTouch] - Called when an actor collides with a solid.
 * @property {Function} [onEnter] - Called when an actor enters a trigger.
 * @property {Function} [onExit] - Called when an actor leaves a trigger.
 * @property {*} [owner] - Object that created the body.
 * @property {number[]} [cells] - Spatial hash cells currently holding the body.
 */

/**
 * Builds a body description with defaults.
 *
 * @param {number} x - Left edge.
 * @param {number} y - Top edge.
 * @param {number} w - Width.
 * @param {number} h - Height.
 * @param {"solid"|"hazard"|"trigger"} kind - Body kind.
 * @param {Partial<Body>} [extra] - Additional properties.
 * @returns {Body} The new body.
 */
export function createBody(x, y, w, h, kind, extra = {}) {
    return { x, y, w, h, kind, active: true, climbable: true, cells: [], ...extra };
}

/**
 * Tests whether two boxes overlap.
 *
 * @param {{ x: number, y: number, w: number, h: number }} a - First box.
 * @param {{ x: number, y: number, w: number, h: number }} b - Second box.
 * @returns {boolean} True when the boxes intersect.
 */
export function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Spatial hash of every solid, hazard and trigger in a level.
 */
export class CollisionWorld {
    /** @type {Map<number, Body[]>} */
    #cells = new Map();
    /** @type {Set<Body>} */
    bodies = new Set();
    /** @type {number} */
    #stamp = 0;
    /** @type {WeakMap<Body, number>} */
    #seen = new WeakMap();

    /**
     * @param {number} [cellSize] - Cell size in pixels.
     */
    constructor(cellSize = COLLISION_CELL) {
        this.cellSize = cellSize;
    }

    /**
     * Hashes a cell coordinate pair into a single number.
     *
     * @param {number} cx - Cell column.
     * @param {number} cy - Cell row.
     * @returns {number} Cell key.
     */
    #key(cx, cy) {
        return (cx + 32768) * 65536 + (cy + 32768);
    }

    /**
     * Inserts a body.
     *
     * @param {Body} body - Body to add.
     * @returns {Body} The same body.
     */
    add(body) {
        this.bodies.add(body);
        this.#insert(body);
        return body;
    }

    /**
     * Removes a body.
     *
     * @param {Body} body - Body to remove.
     * @returns {void}
     */
    remove(body) {
        this.#detach(body);
        this.bodies.delete(body);
    }

    /**
     * Re-buckets a body after its position or size changed.
     *
     * @param {Body} body - Body that moved.
     * @returns {void}
     */
    update(body) {
        this.#detach(body);
        this.#insert(body);
    }

    /**
     * Adds a body to every cell it covers.
     *
     * @param {Body} body - Body to insert.
     * @returns {void}
     */
    #insert(body) {
        const size = this.cellSize;
        const x0 = Math.floor(body.x / size);
        const y0 = Math.floor(body.y / size);
        const x1 = Math.floor((body.x + body.w - 1) / size);
        const y1 = Math.floor((body.y + body.h - 1) / size);
        body.cells = [];
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const key = this.#key(cx, cy);
                let list = this.#cells.get(key);
                if (!list) {
                    list = [];
                    this.#cells.set(key, list);
                }
                list.push(body);
                body.cells.push(key);
            }
        }
    }

    /**
     * Removes a body from its cells.
     *
     * @param {Body} body - Body to detach.
     * @returns {void}
     */
    #detach(body) {
        for (const key of body.cells || []) {
            const list = this.#cells.get(key);
            if (!list) continue;
            const index = list.indexOf(body);
            if (index !== -1) list.splice(index, 1);
        }
        body.cells = [];
    }

    /**
     * Calls a function for every active body of a kind overlapping a box.
     *
     * @param {number} x - Left edge.
     * @param {number} y - Top edge.
     * @param {number} w - Width.
     * @param {number} h - Height.
     * @param {string|null} kind - Kind filter, or null for every kind.
     * @param {(body: Body) => boolean|void} callback - Return true to stop early.
     * @returns {Body|null} The body that stopped the search, if any.
     */
    each(x, y, w, h, kind, callback) {
        const size = this.cellSize;
        const stamp = ++this.#stamp;
        const x0 = Math.floor(x / size);
        const y0 = Math.floor(y / size);
        const x1 = Math.floor((x + w - 1) / size);
        const y1 = Math.floor((y + h - 1) / size);
        for (let cx = x0; cx <= x1; cx++) {
            for (let cy = y0; cy <= y1; cy++) {
                const list = this.#cells.get(this.#key(cx, cy));
                if (!list) continue;
                for (const body of list) {
                    if (this.#seen.get(body) === stamp) continue;
                    this.#seen.set(body, stamp);
                    if (!body.active || (kind && body.kind !== kind)) continue;
                    if (x < body.x + body.w && x + w > body.x && y < body.y + body.h && y + h > body.y) {
                        if (callback(body)) return body;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Returns the first solid overlapping a box.
     *
     * @param {number} x - Left edge.
     * @param {number} y - Top edge.
     * @param {number} w - Width.
     * @param {number} h - Height.
     * @param {Body|null} [ignore] - Body to skip.
     * @returns {Body|null} The blocking solid, if any.
     */
    solidAt(x, y, w, h, ignore = null) {
        return this.each(x, y, w, h, "solid", (body) => body !== ignore);
    }
}

/**
 * Object that moves through the world one pixel at a time.
 *
 * @typedef {object} Actor
 * @property {number} x - Left edge of the hitbox.
 * @property {number} y - Top edge of the hitbox.
 * @property {number} w - Hitbox width.
 * @property {number} h - Hitbox height.
 * @property {number} remX - Sub-pixel horizontal remainder.
 * @property {number} remY - Sub-pixel vertical remainder.
 */

/**
 * Moves an actor horizontally, stopping at the first solid.
 *
 * Movement happens in whole pixels with the fractional part kept in a
 * remainder so fast objects never tunnel through thin walls.
 *
 * @param {CollisionWorld} world - Collision world.
 * @param {Actor} actor - Actor to move.
 * @param {number} amount - Distance in pixels, may be fractional.
 * @param {(solid: Body) => void} [onCollide] - Called when movement is blocked.
 * @returns {boolean} True when the actor was blocked.
 */
export function moveX(world, actor, amount, onCollide) {
    actor.remX += amount;
    let move = Math.round(actor.remX);
    if (move === 0) return false;
    actor.remX -= move;
    const sign = Math.sign(move);
    while (move !== 0) {
        const hit = world.solidAt(actor.x + sign, actor.y, actor.w, actor.h);
        if (hit) {
            actor.remX = 0;
            onCollide?.(hit);
            return true;
        }
        actor.x += sign;
        move -= sign;
    }
    return false;
}

/**
 * Moves an actor vertically, stopping at the first solid.
 *
 * @param {CollisionWorld} world - Collision world.
 * @param {Actor} actor - Actor to move.
 * @param {number} amount - Distance in pixels, may be fractional.
 * @param {(solid: Body) => void} [onCollide] - Called when movement is blocked.
 * @returns {boolean} True when the actor was blocked.
 */
export function moveY(world, actor, amount, onCollide) {
    actor.remY += amount;
    let move = Math.round(actor.remY);
    if (move === 0) return false;
    actor.remY -= move;
    const sign = Math.sign(move);
    while (move !== 0) {
        const hit = world.solidAt(actor.x, actor.y + sign, actor.w, actor.h);
        if (hit) {
            actor.remY = 0;
            onCollide?.(hit);
            return true;
        }
        actor.y += sign;
        move -= sign;
    }
    return false;
}

/**
 * Whether an actor would collide with a solid at an offset.
 *
 * @param {CollisionWorld} world - Collision world.
 * @param {Actor} actor - Actor to test.
 * @param {number} dx - Horizontal offset.
 * @param {number} dy - Vertical offset.
 * @returns {Body|null} The solid at that offset, if any.
 */
export function collideAt(world, actor, dx, dy) {
    return world.solidAt(actor.x + dx, actor.y + dy, actor.w, actor.h);
}

/**
 * Moves a solid and carries or pushes actors in its path.
 *
 * Riding actors move along with the solid. Actors the solid moves into are
 * pushed, and when they cannot be pushed they are reported as squished.
 *
 * @param {CollisionWorld} world - Collision world.
 * @param {Body} solid - Solid to move.
 * @param {number} dx - Horizontal movement in whole pixels.
 * @param {number} dy - Vertical movement in whole pixels.
 * @param {Array<Actor & { isRiding?: (solid: Body) => boolean, squish?: () => void }>} actors - Actors that may be affected.
 * @returns {void}
 */
export function moveSolid(world, solid, dx, dy, actors) {
    if (dx === 0 && dy === 0) return;
    const riders = actors.filter((actor) => actor.isRiding?.(solid));
    solid.active = false;
    solid.x += dx;
    solid.y += dy;
    world.update(solid);
    for (const actor of actors) {
        if (overlaps(actor, solid)) {
            let blocked = false;
            if (dx !== 0) {
                const push = dx > 0 ? solid.x + solid.w - actor.x : solid.x - (actor.x + actor.w);
                blocked = moveX(world, actor, push) || blocked;
            }
            if (dy !== 0) {
                const push = dy > 0 ? solid.y + solid.h - actor.y : solid.y - (actor.y + actor.h);
                blocked = moveY(world, actor, push) || blocked;
            }
            if (blocked) actor.squish?.();
        } else if (riders.includes(actor)) {
            moveX(world, actor, dx);
            moveY(world, actor, dy);
        }
    }
    solid.active = true;
}
