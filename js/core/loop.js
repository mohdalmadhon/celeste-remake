import { FIXED_STEP, MAX_FRAME_TIME } from "./constants.js";
import { settings } from "./settings.js";

const SAMPLE_COUNT = 240;

/**
 * Rolling frame time statistics gathered from requestAnimationFrame timestamps.
 */
export class FrameStats {
    /** @type {Float32Array} */
    #samples = new Float32Array(SAMPLE_COUNT);
    /** @type {Float32Array} */
    #work = new Float32Array(SAMPLE_COUNT);
    /** @type {number} */
    #index = 0;
    /** @type {number} */
    #count = 0;
    /** @type {number} */
    longFrames = 0;
    /** @type {number} */
    totalFrames = 0;

    /**
     * Records the duration of one presented frame and the time spent working in it.
     *
     * @param {number} frameMs - Time since the previous frame in milliseconds.
     * @param {number} workMs - Time spent updating and rendering in milliseconds.
     * @returns {void}
     */
    record(frameMs, workMs) {
        this.#samples[this.#index] = frameMs;
        this.#work[this.#index] = workMs;
        this.#index = (this.#index + 1) % SAMPLE_COUNT;
        this.#count = Math.min(SAMPLE_COUNT, this.#count + 1);
        this.totalFrames++;
        if (frameMs > 25) this.longFrames++;
    }

    /**
     * Summarises the recorded samples.
     *
     * @returns {{ fps: number, avg: number, p95: number, max: number, work: number, workMax: number }} Statistics in milliseconds and frames per second.
     */
    summary() {
        if (!this.#count) return { fps: 0, avg: 0, p95: 0, max: 0, work: 0, workMax: 0 };
        const frames = Array.from(this.#samples.subarray(0, this.#count)).sort((a, b) => a - b);
        const work = this.#work.subarray(0, this.#count);
        const avg = frames.reduce((sum, value) => sum + value, 0) / frames.length;
        let workSum = 0;
        let workMax = 0;
        for (const value of work) {
            workSum += value;
            workMax = Math.max(workMax, value);
        }
        return {
            fps: 1000 / avg,
            avg,
            p95: frames[Math.floor(frames.length * 0.95)],
            max: frames[frames.length - 1],
            work: workSum / work.length,
            workMax
        };
    }

    /**
     * Clears every sample.
     *
     * @returns {void}
     */
    reset() {
        this.#count = 0;
        this.#index = 0;
        this.longFrames = 0;
        this.totalFrames = 0;
    }
}

/**
 * Callbacks driven by the loop.
 *
 * @typedef {object} LoopHandlers
 * @property {(dt: number) => void} step - Fixed time step simulation.
 * @property {(frameDt: number) => void} frame - Called once per frame before simulation.
 * @property {(alpha: number, frameDt: number) => void} render - Draws the current state.
 */

/**
 * Fixed time step game loop on top of requestAnimationFrame.
 *
 * Simulation always advances in {@link FIXED_STEP} increments so physics stay
 * identical at any refresh rate, while rendering happens once per display frame.
 */
export class GameLoop {
    /** @type {LoopHandlers} */
    #handlers;
    /** @type {number} */
    #accumulator = 0;
    /** @type {number} */
    #last = 0;
    /** @type {number} */
    #lastPresented = 0;
    /** @type {number|null} */
    #frameId = null;
    /** @type {FrameStats} */
    stats = new FrameStats();
    /** @type {number} */
    timeScale = 1;
    /** @type {boolean} */
    simulate = true;

    /**
     * @param {LoopHandlers} handlers - Loop callbacks.
     */
    constructor(handlers) {
        this.#handlers = handlers;
        this.tick = this.tick.bind(this);
    }

    /**
     * Starts the loop if it is not running.
     *
     * @returns {void}
     */
    start() {
        if (this.#frameId !== null) return;
        this.#last = performance.now();
        this.#lastPresented = this.#last;
        this.#frameId = requestAnimationFrame(this.tick);
    }

    /**
     * Stops the loop.
     *
     * @returns {void}
     */
    stop() {
        if (this.#frameId !== null) cancelAnimationFrame(this.#frameId);
        this.#frameId = null;
    }

    /**
     * Drops accumulated time, used after loading so no catch-up burst happens.
     *
     * @returns {void}
     */
    resetTiming() {
        this.#accumulator = 0;
        this.#last = performance.now();
    }

    /**
     * Runs one animation frame.
     *
     * @param {number} now - High resolution timestamp from requestAnimationFrame.
     * @returns {void}
     */
    tick(now) {
        this.#frameId = requestAnimationFrame(this.tick);
        const cap = settings.frameCap;
        if (cap > 0 && now - this.#lastPresented < 1000 / cap - 1) {
            return;
        }
        const frameMs = now - this.#lastPresented;
        this.#lastPresented = now;
        const workStart = performance.now();
        let frameDt = (now - this.#last) / 1000;
        this.#last = now;
        if (frameDt > MAX_FRAME_TIME) frameDt = MAX_FRAME_TIME;
        if (frameDt < 0) frameDt = 0;
        this.#handlers.frame(frameDt);
        if (this.simulate) {
            this.#accumulator += frameDt * this.timeScale;
            let steps = 0;
            while (this.#accumulator >= FIXED_STEP && steps < 12) {
                this.#handlers.step(FIXED_STEP);
                this.#accumulator -= FIXED_STEP;
                steps++;
            }
            if (steps >= 12) this.#accumulator = 0;
        }
        this.#handlers.render(this.#accumulator / FIXED_STEP, frameDt);
        this.stats.record(frameMs, performance.now() - workStart);
    }
}
