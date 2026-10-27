import { settings } from "../core/settings.js";

/**
 * Parameters for a particle burst.
 *
 * @typedef {object} BurstOptions
 * @property {number} x - Spawn center x in world pixels.
 * @property {number} y - Spawn center y in world pixels.
 * @property {number} [count=8] - Particles at full effect intensity.
 * @property {string} [color="#fff"] - CSS colour.
 * @property {number} [size=4] - Particle size in pixels.
 * @property {number} [speed=120] - Initial speed in pixels per second.
 * @property {number} [spread=Math.PI*2] - Angular spread in radians.
 * @property {number} [angle=0] - Direction of the burst in radians.
 * @property {number} [life=0.5] - Lifetime in seconds.
 * @property {number} [gravity=0] - Downward acceleration.
 * @property {number} [drag=3] - Exponential drag per second.
 * @property {number} [jitter=4] - Random spawn offset radius.
 * @property {boolean} [shrink=true] - Whether particles shrink as they fade.
 */

/**
 * Fixed pool of DOM particles reused for dust, sparks, death bursts and pickups.
 *
 * Elements are created once and only their transform and opacity change, so
 * effects never allocate during gameplay.
 */
export class ParticleSystem {
    /** @type {Array<{ elem: HTMLDivElement, active: boolean, x: number, y: number, px: number, py: number, vx: number, vy: number, life: number, max: number, size: number, gravity: number, drag: number, shrink: boolean, color: string, shown: boolean }>} */
    #pool = [];
    /** @type {number} */
    #cursor = 0;

    /**
     * @param {HTMLElement} layer - Container inside the world layer.
     * @param {number} [capacity=220] - Maximum simultaneous particles.
     */
    constructor(layer, capacity = 220) {
        this.layer = layer;
        for (let i = 0; i < capacity; i++) {
            const elem = document.createElement("div");
            elem.className = "particle";
            elem.style.display = "none";
            layer.appendChild(elem);
            this.#pool.push({
                elem, active: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, life: 0, max: 1,
                size: 4, gravity: 0, drag: 0, shrink: true, color: "", shown: false
            });
        }
    }

    /**
     * Takes the next free particle, recycling the oldest when full.
     *
     * @returns {typeof this.#pool[number]} A particle record.
     */
    #take() {
        for (let i = 0; i < this.#pool.length; i++) {
            const index = (this.#cursor + i) % this.#pool.length;
            if (!this.#pool[index].active) {
                this.#cursor = index + 1;
                return this.#pool[index];
            }
        }
        this.#cursor = (this.#cursor + 1) % this.#pool.length;
        return this.#pool[this.#cursor];
    }

    /**
     * Emits a burst of particles scaled by the visual effects setting.
     *
     * @param {BurstOptions} options - Burst parameters.
     * @returns {void}
     */
    burst(options) {
        const count = Math.round((options.count ?? 8) * settings.vfxIntensity);
        const spread = options.spread ?? Math.PI * 2;
        const baseAngle = options.angle ?? 0;
        const jitter = options.jitter ?? 4;
        for (let i = 0; i < count; i++) {
            const p = this.#take();
            const angle = baseAngle + (Math.random() - 0.5) * spread;
            const speed = (options.speed ?? 120) * (0.5 + Math.random() * 0.7);
            p.active = true;
            p.x = options.x + (Math.random() - 0.5) * jitter * 2;
            p.y = options.y + (Math.random() - 0.5) * jitter * 2;
            p.px = p.x;
            p.py = p.y;
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
            p.max = (options.life ?? 0.5) * (0.7 + Math.random() * 0.6);
            p.life = p.max;
            p.size = options.size ?? 4;
            p.gravity = options.gravity ?? 0;
            p.drag = options.drag ?? 3;
            p.shrink = options.shrink ?? true;
            const color = options.color ?? "#fff";
            if (p.color !== color) {
                p.color = color;
                p.elem.style.background = color;
            }
            p.elem.style.width = `${p.size}px`;
            p.elem.style.height = `${p.size}px`;
        }
    }

    /**
     * Small puff of dust used for jumps and landings.
     *
     * @param {number} x - World x.
     * @param {number} y - World y of the ground.
     * @param {number} [strength=1] - Size multiplier.
     * @param {string} [color] - Dust colour.
     * @returns {void}
     */
    dust(x, y, strength = 1, color = "rgba(235, 240, 255, 0.85)") {
        this.burst({ x, y: y - 2, count: 5 * strength, color, size: 5, speed: 90 * strength, angle: -Math.PI / 2, spread: Math.PI * 0.9, life: 0.35, gravity: 160, drag: 5, jitter: 10 });
    }

    /**
     * Advances every active particle.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    update(dt) {
        for (const p of this.#pool) {
            if (!p.active) continue;
            p.px = p.x;
            p.py = p.y;
            p.life -= dt;
            if (p.life <= 0) {
                p.active = false;
                continue;
            }
            const damping = Math.exp(-p.drag * dt);
            p.vx *= damping;
            p.vy = p.vy * damping + p.gravity * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        }
    }

    /**
     * Writes particle transforms to the DOM.
     *
     * @param {number} alpha - Interpolation factor.
     * @returns {void}
     */
    render(alpha) {
        for (const p of this.#pool) {
            if (!p.active) {
                if (p.shown) {
                    p.shown = false;
                    p.elem.style.display = "none";
                }
                continue;
            }
            if (!p.shown) {
                p.shown = true;
                p.elem.style.display = "";
            }
            const t = p.life / p.max;
            const x = Math.round(p.px + (p.x - p.px) * alpha);
            const y = Math.round(p.py + (p.y - p.py) * alpha);
            const scale = p.shrink ? Math.max(0.2, t) : 1;
            p.elem.style.transform = `translate3d(${x}px,${y}px,0) scale(${scale.toFixed(2)})`;
            p.elem.style.opacity = Math.min(1, t * 1.6).toFixed(2);
        }
    }

    /**
     * Deactivates every particle, used on room resets.
     *
     * @returns {void}
     */
    clear() {
        for (const p of this.#pool) p.active = false;
    }
}

/**
 * Pool of fading sprite copies used for dash trails.
 */
export class AfterimagePool {
    /** @type {Array<{ elem: HTMLDivElement, life: number, max: number, shown: boolean }>} */
    #pool = [];
    /** @type {number} */
    #cursor = 0;

    /**
     * @param {HTMLElement} layer - Container inside the world layer.
     * @param {number} [capacity=10] - Number of reusable copies.
     */
    constructor(layer, capacity = 10) {
        for (let i = 0; i < capacity; i++) {
            const elem = document.createElement("div");
            elem.className = "afterimage";
            elem.style.display = "none";
            layer.appendChild(elem);
            this.#pool.push({ elem, life: 0, max: 1, shown: false });
        }
    }

    /**
     * Spawns a copy of an entity's current frame.
     *
     * @param {import("../entities/entity.js").Entity} entity - Source entity.
     * @param {string} sheet - Tinted sheet URL.
     * @param {number} [life=0.3] - Fade time in seconds.
     * @returns {void}
     */
    spawn(entity, sheet, life = 0.3) {
        if (settings.vfxIntensity <= 0) return;
        const item = this.#pool[this.#cursor];
        this.#cursor = (this.#cursor + 1) % this.#pool.length;
        const style = item.elem.style;
        style.width = `${entity.dimensions.width}px`;
        style.height = `${entity.dimensions.height}px`;
        style.backgroundImage = `url("${sheet}")`;
        style.backgroundPosition = entity.elem.style.backgroundPosition;
        style.transformOrigin = entity.elem.style.transformOrigin || "";
        const flip = entity.components.movement?.direction ?? entity.facing;
        const v = entity.visual;
        style.transform = `translate3d(${Math.round(entity.position.x + v.offsetX)}px,${Math.round(entity.position.y + v.offsetY)}px,0) scale(${flip * v.scaleX},${v.scaleY})`;
        style.display = "";
        style.opacity = "0.6";
        item.life = life;
        item.max = life;
        item.shown = true;
    }

    /**
     * Fades active copies.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    update(dt) {
        for (const item of this.#pool) {
            if (!item.shown) continue;
            item.life -= dt;
            if (item.life <= 0) {
                item.shown = false;
                item.elem.style.display = "none";
            } else {
                item.elem.style.opacity = (0.6 * item.life / item.max).toFixed(2);
            }
        }
    }

    /**
     * Hides every copy.
     *
     * @returns {void}
     */
    clear() {
        for (const item of this.#pool) {
            item.shown = false;
            item.life = 0;
            item.elem.style.display = "none";
        }
    }
}
