import { events } from "../core/events.js";
import { game } from "../core/game.js";
import { playAnimation } from "../components/animation.js";

/**
 * Error used to unwind a cutscene script when it is skipped.
 */
class CutsceneSkipped extends Error {}

/**
 * Runs scripted scenes: takes control from the player, moves the camera,
 * walks characters, shows dialogue and supports skipping without leaving the
 * game in an invalid state.
 *
 * Scripts are async functions receiving this director. Each helper resolves
 * immediately while skipping, and the script's own "finally" step restores
 * the final state so progression is preserved.
 */
export class CutsceneDirector {
    /** @type {boolean} */
    running = false;
    /** @type {boolean} */
    skipping = false;
    /** @type {boolean} */
    skippable = true;
    /** @type {import("./dialogue.js").Dialogue} */
    dialogue;
    /** @type {HTMLElement} */
    letterbox;
    /** @type {Set<{ resolve: Function, time: number }>} */
    #waits = new Set();
    /** @type {Set<Function>} */
    #finishers = new Set();

    /**
     * @param {import("./dialogue.js").Dialogue} dialogue - Dialogue box.
     * @param {HTMLElement} letterbox - Letterbox bars container.
     */
    constructor(dialogue, letterbox) {
        this.dialogue = dialogue;
        this.letterbox = letterbox;
    }

    /**
     * Runs a script with player control locked.
     *
     * @param {(director: CutsceneDirector) => Promise<void>} script - Scene body.
     * @param {{ letterbox?: boolean, skippable?: boolean, keepCamera?: boolean, onEnd?: () => void }} [options] - Scene options.
     * @returns {Promise<boolean>} Resolves true when skipped.
     */
    async run(script, options = {}) {
        if (this.running) return false;
        this.running = true;
        this.skipping = false;
        this.skippable = options.skippable !== false;
        game.cutscene = true;
        const player = game.player;
        if (player) {
            player.controlLocked = true;
            player.script.x = 0;
        }
        if (options.letterbox !== false) this.letterbox.classList.add("active");
        events.emit("cutscene:start");
        let skipped = false;
        try {
            await script(this);
        } catch (error) {
            if (!(error instanceof CutsceneSkipped)) throw error;
            skipped = true;
        } finally {
            skipped = skipped || this.skipping;
            options.onEnd?.();
            this.letterbox.classList.remove("active");
            if (player) {
                player.controlLocked = false;
                player.forcedAnimation = null;
                player.script.x = 0;
            }
            if (!options.keepCamera) {
                game.camera?.release();
                game.camera?.setZoom(1, 3);
            }
            game.cutscene = false;
            this.running = false;
            this.skipping = false;
            events.emit("cutscene:end", { skipped });
        }
        return skipped;
    }

    /**
     * Requests that the running scene finish as fast as possible.
     *
     * @returns {void}
     */
    skip() {
        if (!this.running || !this.skippable) return;
        this.skipping = true;
        this.dialogue.skip();
        for (const wait of this.#waits) wait.resolve();
        this.#waits.clear();
        for (const finish of this.#finishers) finish();
        this.#finishers.clear();
    }

    /**
     * Awaits a scripted action that can be completed early when skipping.
     *
     * @param {Promise<void>} promise - The action.
     * @param {() => void} finish - Completes the action immediately.
     * @returns {Promise<void>} Resolves when the action ends.
     */
    async track(promise, finish) {
        this.#checkSkip();
        this.#finishers.add(finish);
        try {
            await promise;
        } finally {
            this.#finishers.delete(finish);
        }
        this.#checkSkip();
    }

    /**
     * Throws when skipping so the rest of the script body is not executed.
     *
     * @returns {void}
     */
    #checkSkip() {
        if (this.skipping) throw new CutsceneSkipped();
    }

    /**
     * Waits for a number of seconds of game time.
     *
     * @param {number} seconds - Duration.
     * @returns {Promise<void>} Resolves after the delay or immediately when skipping.
     */
    wait(seconds) {
        this.#checkSkip();
        return new Promise((resolve) => {
            const entry = { resolve, time: seconds };
            this.#waits.add(entry);
        });
    }

    /**
     * Advances pending waits. Called every simulation step.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    update(dt) {
        for (const wait of this.#waits) {
            wait.time -= dt;
            if (wait.time <= 0) {
                this.#waits.delete(wait);
                wait.resolve();
            }
        }
    }

    /**
     * Shows dialogue lines.
     *
     * @param {import("./dialogue.js").DialogueLine[]} lines - Lines to play.
     * @returns {Promise<void>} Resolves after the last line.
     */
    async say(lines) {
        this.#checkSkip();
        await this.dialogue.play(lines);
        this.#checkSkip();
    }

    /**
     * Walks the player to an x position.
     *
     * @param {number} x - Target feet x.
     * @param {number} [speed=0.5] - Fraction of run speed.
     * @returns {Promise<void>} Resolves on arrival.
     */
    async walk(x, speed = 0.5) {
        await this.track(game.player.walkTo(x, speed), () => game.player.finishWalk());
    }

    /**
     * Turns the player to face a direction.
     *
     * @param {number} direction - -1 for left, 1 for right.
     * @returns {void}
     */
    face(direction) {
        game.player.components.movement.direction = direction;
    }

    /**
     * Forces a player animation until cleared with null.
     *
     * @param {string|null} name - Clip name.
     * @returns {void}
     */
    pose(name) {
        game.player.forcedAnimation = name;
        if (name) playAnimation(game.player, name);
    }

    /**
     * Pans the camera to center on a point.
     *
     * @param {number} x - World x.
     * @param {number} y - World y.
     * @param {number} [duration=1] - Pan time in seconds.
     * @returns {Promise<void>} Resolves when the pan ends.
     */
    async pan(x, y, duration = 1) {
        await this.track(game.camera.focusOn(x, y, duration), () => game.camera.release());
    }

    /**
     * Returns the camera to following the player.
     *
     * @param {number} [duration=0.8] - Seconds to wait while it eases back.
     * @returns {Promise<void>} Resolves after the delay.
     */
    async follow(duration = 0.8) {
        game.camera.release();
        if (duration > 0) await this.wait(duration);
    }

    /**
     * Smoothly zooms the camera.
     *
     * @param {number} zoom - Target zoom.
     * @param {number} [speed=2] - Approach speed.
     * @returns {void}
     */
    zoom(zoom, speed = 2) {
        game.camera.setZoom(zoom, speed);
    }

    /**
     * Moves an NPC.
     *
     * @param {import("../entities/props.js").Npc} npc - Character to move.
     * @param {number} x - Target left edge.
     * @param {number} y - Target top edge.
     * @param {number} [speed=200] - Speed in pixels per second.
     * @returns {Promise<void>} Resolves on arrival.
     */
    async move(npc, x, y, speed = 200) {
        await this.track(npc.moveTo(x, y, speed), () => npc.finishMove?.());
    }
}
