import { VIEW_HEIGHT, VIEW_WIDTH } from "../core/constants.js";
import { settings } from "../core/settings.js";

/**
 * Rectangle in world pixels.
 *
 * @typedef {object} Rect
 * @property {number} left - Left edge.
 * @property {number} top - Top edge.
 * @property {number} right - Right edge.
 * @property {number} bottom - Bottom edge.
 */

/**
 * Smooth follow camera with look-ahead, level bounds, framing zones,
 * scripted focus targets and restrained screen shake.
 */
export class Camera {
    /** @type {{ x: number, y: number }} */
    position = { x: 0, y: 0 };
    /** @type {{ x: number, y: number }} */
    previous = { x: 0, y: 0 };
    /** @type {*} */
    target = null;
    /** @type {Rect|null} */
    bounds = null;
    /** @type {Rect[]} */
    zones = [];
    /** @type {Rect|null} */
    #activeZone = null;
    /** @type {{ x: number, y: number }} */
    #lookAhead = { x: 0, y: 0 };
    /** @type {{ x: number, y: number, from: { x: number, y: number }, time: number, duration: number, ease: (t: number) => number }|null} */
    #focus = null;
    /** @type {boolean} */
    #holdFocus = false;
    /** @type {number} */
    #shakeTime = 0;
    /** @type {number} */
    #shakeDuration = 0;
    /** @type {number} */
    #shakeStrength = 0;
    /** @type {{ x: number, y: number }} */
    shakeOffset = { x: 0, y: 0 };
    /** @type {number} */
    zoom = 1;
    /** @type {number} */
    #zoomTarget = 1;
    /** @type {number} */
    #zoomSpeed = 2;
    /** @type {number} */
    followSharpness = 7;
    /** @type {number} */
    verticalSharpness = 5;
    /** @type {{ x: number, y: number }} */
    offset = { x: 0, y: 0 };

    /**
     * @param {*} [target] - Object with position and optional velocity to follow.
     */
    constructor(target = null) {
        this.target = target;
    }

    /**
     * Width of the visible area in world pixels at the current zoom.
     *
     * @returns {number} Visible width.
     */
    get viewWidth() {
        return VIEW_WIDTH / this.zoom;
    }

    /**
     * Height of the visible area in world pixels at the current zoom.
     *
     * @returns {number} Visible height.
     */
    get viewHeight() {
        return VIEW_HEIGHT / this.zoom;
    }

    /**
     * Computes the point the camera wants to center on.
     *
     * @returns {{ x: number, y: number }} Desired center in world pixels.
     */
    #desiredCenter() {
        const target = this.target;
        const center = target.cameraFocus ? target.cameraFocus() : {
            x: target.position.x + (target.dimensions?.width || 0) / 2,
            y: target.position.y + (target.dimensions?.height || 0) / 2
        };
        return { x: center.x + this.#lookAhead.x + this.offset.x, y: center.y + this.#lookAhead.y + this.offset.y };
    }

    /**
     * Lowest world y the camera can ever show with the current bounds.
     *
     * @returns {number} Bottom edge in world pixels, Infinity without bounds.
     */
    get lowestVisibleY() {
        const bounds = this.#currentBounds();
        return bounds ? bounds.bottom : Infinity;
    }

    /**
     * Returns the bounds the camera must stay inside right now.
     *
     * @returns {Rect|null} Active bounds.
     */
    #currentBounds() {
        return this.#activeZone || this.bounds;
    }

    /**
     * Keeps a top-left camera position inside the active bounds.
     *
     * @param {number} x - Desired left edge.
     * @param {number} y - Desired top edge.
     * @returns {{ x: number, y: number }} Clamped position.
     */
    clamp(x, y) {
        const bounds = this.#currentBounds();
        if (!bounds) return { x, y };
        const width = this.viewWidth;
        const height = this.viewHeight;
        const maxX = bounds.right - width;
        const maxY = bounds.bottom - height;
        const cx = maxX < bounds.left ? (bounds.left + bounds.right - width) / 2 : Math.min(Math.max(x, bounds.left), maxX);
        const cy = maxY < bounds.top ? (bounds.top + bounds.bottom - height) / 2 : Math.min(Math.max(y, bounds.top), maxY);
        return { x: cx, y: cy };
    }

    /**
     * Moves the camera to its target instantly, used when a level loads or the player respawns.
     *
     * @returns {void}
     */
    snap() {
        this.#updateZone(true);
        this.#lookAhead.x = 0;
        this.#lookAhead.y = 0;
        if (this.target) {
            const center = this.#desiredCenter();
            const clamped = this.clamp(center.x - this.viewWidth / 2, center.y - this.viewHeight / 2);
            this.position.x = clamped.x;
            this.position.y = clamped.y;
        }
        this.previous.x = this.position.x;
        this.previous.y = this.position.y;
    }

    /**
     * Selects the framing zone that contains the target.
     *
     * @param {boolean} [force=false] - Whether to switch even without leaving the current zone.
     * @returns {void}
     */
    #updateZone(force = false) {
        if (!this.target || !this.zones.length) {
            this.#activeZone = null;
            return;
        }
        const center = this.target.cameraFocus ? this.target.cameraFocus() : this.target.position;
        const inside = (zone) => center.x >= zone.left && center.x < zone.right && center.y >= zone.top && center.y < zone.bottom;
        if (!force && this.#activeZone && inside(this.#activeZone)) return;
        this.#activeZone = this.zones.find(inside) || null;
    }

    /**
     * Pans the camera to center on a world point for a cutscene.
     *
     * @param {number} x - World x to center on.
     * @param {number} y - World y to center on.
     * @param {number} [duration=1] - Pan duration in seconds.
     * @param {(t: number) => number} [ease] - Easing function.
     * @returns {Promise<void>} Resolves when the pan finishes.
     */
    focusOn(x, y, duration = 1, ease = easeInOutSine) {
        this.#holdFocus = true;
        this.#focus = { x, y, from: { ...this.position }, time: 0, duration: Math.max(0.0001, duration), ease };
        return new Promise((resolve) => {
            this.#focus.resolve = resolve;
        });
    }

    /**
     * Releases a cutscene focus so the camera eases back to following its target.
     *
     * @returns {void}
     */
    release() {
        this.#holdFocus = false;
        this.#focus?.resolve?.();
        this.#focus = null;
    }

    /**
     * Whether a scripted focus currently controls the camera.
     *
     * @returns {boolean} True during a cutscene focus.
     */
    get focused() {
        return this.#holdFocus;
    }

    /**
     * Starts a screen shake scaled by the accessibility setting.
     *
     * @param {number} strength - Maximum offset in pixels.
     * @param {number} duration - Duration in seconds.
     * @returns {void}
     */
    shake(strength, duration) {
        const scaled = strength * settings.screenShake;
        if (scaled <= 0.1) return;
        if (scaled >= this.#shakeStrength * (this.#shakeTime / Math.max(this.#shakeDuration, 0.0001))) {
            this.#shakeStrength = scaled;
            this.#shakeDuration = duration;
            this.#shakeTime = duration;
        }
    }

    /**
     * Smoothly changes the zoom level.
     *
     * @param {number} zoom - Target zoom, 1 being the default framing.
     * @param {number} [speed=2] - Approach speed.
     * @returns {void}
     */
    setZoom(zoom, speed = 2) {
        this.#zoomTarget = zoom;
        this.#zoomSpeed = speed;
    }

    /**
     * Advances the camera by one simulation step.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    update(dt) {
        this.previous.x = this.position.x;
        this.previous.y = this.position.y;
        if (this.zoom !== this.#zoomTarget) {
            const k = 1 - Math.exp(-this.#zoomSpeed * dt);
            this.zoom += (this.#zoomTarget - this.zoom) * k;
            if (Math.abs(this.zoom - this.#zoomTarget) < 0.0005) this.zoom = this.#zoomTarget;
        }
        if (this.#focus) {
            const focus = this.#focus;
            focus.time = Math.min(focus.duration, focus.time + dt);
            const t = focus.ease(focus.time / focus.duration);
            const goal = this.clamp(focus.x - this.viewWidth / 2, focus.y - this.viewHeight / 2);
            this.position.x = focus.from.x + (goal.x - focus.from.x) * t;
            this.position.y = focus.from.y + (goal.y - focus.from.y) * t;
            if (focus.time >= focus.duration && focus.resolve) {
                const resolve = focus.resolve;
                focus.resolve = null;
                resolve();
            }
        } else if (this.target && !this.#holdFocus) {
            this.#follow(dt);
        }
        this.#updateShake(dt);
    }

    /**
     * Follows the target with damping, look-ahead and a safety frame.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    #follow(dt) {
        this.#updateZone();
        const velocity = this.target.velocity || { x: 0, y: 0 };
        const strength = settings.cameraLookAhead;
        const aheadX = Math.max(-140, Math.min(140, velocity.x * 0.28)) * strength;
        const aheadY = (velocity.y > 300 ? Math.min(90, (velocity.y - 300) * 0.25) : 0) * strength;
        const lookK = 1 - Math.exp(-3 * dt);
        this.#lookAhead.x += (aheadX - this.#lookAhead.x) * lookK;
        this.#lookAhead.y += (aheadY - this.#lookAhead.y) * lookK;
        const center = this.#desiredCenter();
        const goal = this.clamp(center.x - this.viewWidth / 2, center.y - this.viewHeight / 2);
        const kx = 1 - Math.exp(-this.followSharpness * dt);
        const ky = 1 - Math.exp(-this.verticalSharpness * dt);
        let x = this.position.x + (goal.x - this.position.x) * kx;
        let y = this.position.y + (goal.y - this.position.y) * ky;
        const focus = this.target.cameraFocus ? this.target.cameraFocus() : this.target.position;
        const marginX = this.viewWidth * 0.3;
        const marginTop = this.viewHeight * 0.25;
        const marginBottom = this.viewHeight * 0.3;
        x = Math.min(Math.max(x, focus.x - this.viewWidth + marginX), focus.x - marginX);
        y = Math.min(Math.max(y, focus.y - this.viewHeight + marginBottom), focus.y - marginTop);
        const clamped = this.clamp(x, y);
        this.position.x = clamped.x;
        this.position.y = clamped.y;
    }

    /**
     * Decays the active shake and picks a new random offset.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    #updateShake(dt) {
        if (this.#shakeTime <= 0) {
            this.shakeOffset.x = 0;
            this.shakeOffset.y = 0;
            return;
        }
        this.#shakeTime = Math.max(0, this.#shakeTime - dt);
        const amount = this.#shakeStrength * (this.#shakeTime / this.#shakeDuration);
        this.shakeOffset.x = Math.round((Math.random() * 2 - 1) * amount);
        this.shakeOffset.y = Math.round((Math.random() * 2 - 1) * amount);
    }

    /**
     * Interpolated position used for rendering between simulation steps.
     *
     * @param {number} alpha - Interpolation factor from 0 to 1.
     * @returns {{ x: number, y: number }} Render position.
     */
    renderPosition(alpha) {
        return {
            x: this.previous.x + (this.position.x - this.previous.x) * alpha + this.shakeOffset.x,
            y: this.previous.y + (this.position.y - this.previous.y) * alpha + this.shakeOffset.y
        };
    }
}

/**
 * Sinusoidal ease in and out.
 *
 * @param {number} t - Progress from 0 to 1.
 * @returns {number} Eased progress.
 */
export function easeInOutSine(t) {
    return -(Math.cos(Math.PI * t) - 1) / 2;
}

/**
 * Cubic ease out.
 *
 * @param {number} t - Progress from 0 to 1.
 * @returns {number} Eased progress.
 */
export function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}
