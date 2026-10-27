import { events } from "./events.js";
import { game } from "./game.js";
import { chapterRecord, persistSave, save } from "./save.js";
import { settings } from "./settings.js";
import { Camera } from "../systems/camera.js";
import { audio } from "../systems/audio.js";
import { input } from "../systems/input.js";
import { AfterimagePool, ParticleSystem } from "../systems/particles.js";

/**
 * Definition of a playable chapter.
 *
 * @typedef {object} ChapterDefinition
 * @property {string} id - Unique id used in saves.
 * @property {number} number - Display number, 0 for the prologue.
 * @property {string} nameKey - Translation key of the chapter name.
 * @property {string} [subtitleKey] - Translation key of the subtitle.
 * @property {string} art - Chapter select image.
 * @property {number} timeLimit - Countdown in seconds.
 * @property {number} lives - Lives per attempt.
 * @property {number} strawberries - Number of strawberries in the chapter.
 * @property {(context: ChapterContext) => Promise<ChapterRuntime>} build - Creates the level.
 * @property {boolean} [custom] - Levels made in the editor; they never touch the story save.
 */

/**
 * Objects passed to a chapter while it builds.
 *
 * @typedef {object} ChapterContext
 * @property {HTMLElement} world - Element hosting the level.
 * @property {Session} session - The running session.
 * @property {boolean} fresh - Whether the chapter starts from the beginning.
 */

/**
 * Live chapter returned by a chapter build function.
 *
 * @typedef {object} ChapterRuntime
 * @property {import("../level.js").Level} level - The level.
 * @property {Record<string, { x: number, y: number }>} checkpoints - Respawn points by id; "start" is required.
 * @property {(dt: number) => void} [step] - Per step script.
 * @property {(checkpoint: string) => void} [onRespawn] - Resets props after a death.
 * @property {(checkpoint: string, fresh: boolean) => void} [onStart] - Runs after the player is placed.
 * @property {() => void} [onExit] - Cleans up when leaving the chapter.
 * @property {string[]} [preload] - Sounds to preload.
 */

/**
 * Plays one chapter: owns the camera, effects, timer, lives, deaths,
 * checkpoints, strawberries and the death and respawn flow.
 */
export class Session {
    /** @type {ChapterDefinition} */
    chapter;
    /** @type {ChapterRuntime|null} */
    runtime = null;
    /** @type {string} */
    checkpoint = "start";
    /** @type {Set<string>} */
    strawberries = new Set();
    /** @type {number} */
    timeRemaining = 0;
    /** @type {number} */
    elapsed = 0;
    /** @type {number} */
    lives = 3;
    /** @type {number} */
    deaths = 0;
    /** @type {boolean} */
    finished = false;
    /** @type {boolean} */
    respawning = false;
    /** @type {Array<Function>} */
    #unsubscribe = [];
    /** @type {*} */
    ui;

    /**
     * @param {ChapterDefinition} chapter - Chapter to play.
     * @param {*} ui - User interface facade with hud, transition, toast and screens.
     */
    constructor(chapter, ui) {
        this.chapter = chapter;
        this.ui = ui;
    }

    /**
     * Builds the chapter and places the player.
     *
     * @param {{ checkpoint?: string, resume?: import("./save.js").SessionRecord|null }} [options] - Start point.
     * @returns {Promise<void>} Resolves when the chapter is playable.
     */
    async start(options = {}) {
        const resume = options.resume || null;
        this.checkpoint = resume?.checkpoint || options.checkpoint || "start";
        this.strawberries = new Set(resume?.strawberries || []);
        this.timeRemaining = resume?.timeRemaining ?? this.chapter.timeLimit;
        this.elapsed = resume?.elapsed ?? 0;
        this.lives = resume?.lives ?? this.chapter.lives;
        this.deaths = resume?.deaths ?? 0;
        this.finished = false;
        game.chapter = this.chapter;
        game.session = this;
        game.camera = new Camera(game.player);
        game.player.dashEnabled = true;
        game.player.maxDashes = 1;
        game.player.wind = 0;
        game.worldLayer.textContent = "";
        this.runtime = await this.chapter.build({ world: game.worldLayer, session: this, fresh: !resume && this.checkpoint === "start" });
        const level = this.runtime.level;
        game.level = level;
        game.particles = new ParticleSystem(level.layers.fx);
        game.afterimages = new AfterimagePool(level.layers.entities);
        level.addEntity(game.player);
        const bounds = level.cameraBounds || {
            left: level.contentBounds.left,
            top: level.contentBounds.top,
            right: level.contentBounds.right,
            bottom: level.contentBounds.bottom
        };
        game.camera.bounds = bounds;
        game.camera.zones = level.cameraZones || [];
        if (level.killY === undefined) level.killY = bounds.bottom + 120;
        if (this.runtime.preload) audio.preload(this.runtime.preload);
        this.#placePlayer(this.checkpoint);
        this.#listen();
        this.runtime.onStart?.(this.checkpoint, !resume && this.checkpoint === "start");
        this.persist();
    }

    /**
     * Puts the player at a checkpoint and snaps the camera.
     *
     * @param {string} id - Checkpoint id.
     * @returns {void}
     */
    #placePlayer(id) {
        const point = this.runtime.checkpoints[id] || this.runtime.checkpoints.start;
        game.player.respawn(point.x, point.y);
        game.player.visual.scaleX = 1;
        game.player.visual.scaleY = 1;
        game.player.components.movement.direction = point.facing ?? 1;
        game.camera.snap();
    }

    /**
     * Subscribes to gameplay events for the duration of the session.
     *
     * @returns {void}
     */
    #listen() {
        this.#unsubscribe.push(
            events.on("player:burst", () => this.#onDeath()),
            events.on("strawberry:collect", ({ id }) => {
                this.strawberries.add(id);
                this.ui.hud.pulseBerries();
                const record = chapterRecord(this.chapter.id);
                if (!record.strawberries.includes(id)) record.strawberries.push(id);
                this.persist();
            })
        );
    }

    /**
     * Records a reached checkpoint.
     *
     * @param {string} id - Checkpoint id.
     * @returns {void}
     */
    reachCheckpoint(id) {
        if (this.checkpoint === id) return;
        this.checkpoint = id;
        this.ui.toast?.(this.chapter.checkpointNames?.[id] || "toast.checkpoint");
        this.persist();
    }

    /**
     * Handles a death: counts it, then respawns at the checkpoint or ends the run.
     *
     * @returns {Promise<void>} Resolves after the respawn.
     */
    async #onDeath() {
        if (this.respawning || this.finished) return;
        this.respawning = true;
        this.deaths++;
        chapterRecord(this.chapter.id).deaths++;
        if (!settings.assistMode) this.lives--;
        await delay(380);
        if (this.lives <= 0 && !settings.assistMode) {
            this.respawning = false;
            this.persist();
            events.emit("session:gameover", this);
            return;
        }
        await this.ui.transition.cover("wipe", 0.22);
        for (const entity of game.level.entities) {
            if (entity.following) entity.reset?.();
        }
        game.particles.clear();
        game.afterimages.clear();
        this.runtime.onRespawn?.(this.checkpoint);
        this.#placePlayer(this.checkpoint);
        input.consume("jump");
        this.persist();
        await this.ui.transition.reveal("wipe", 0.28);
        this.respawning = false;
    }

    /**
     * Advances the chapter by one simulation step.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        if (!this.runtime) return;
        input.step(dt);
        if (game.freezeTimer > 0) {
            game.freezeTimer = Math.max(0, game.freezeTimer - dt);
            game.camera.update(dt * 0.25);
            return;
        }
        game.time += dt;
        this.runtime.step?.(dt);
        game.level.update(dt);
        game.particles.update(dt);
        game.afterimages.update(dt);
        game.camera.update(dt);
        this.ui.cutscenes.update(dt);
        if (!this.finished && !game.cutscene) {
            this.elapsed += dt;
            if (!settings.assistMode) {
                this.timeRemaining = Math.max(0, this.timeRemaining - dt);
                if (this.timeRemaining <= 0 && !this.respawning) {
                    this.finished = true;
                    events.emit("session:gameover", this);
                }
            }
        }
    }

    /**
     * Draws the chapter.
     *
     * @param {number} alpha - Interpolation factor.
     * @param {number} frameDt - Frame time in seconds.
     * @returns {void}
     */
    render(alpha, frameDt) {
        if (!this.runtime) return;
        game.level.render(alpha, game.camera);
        game.particles.render(alpha);
        const cam = game.camera.renderPosition(alpha);
        game.parallax?.render(cam, frameDt);
        game.weather?.update(frameDt, cam);
        this.ui.hud.update({
            strawberries: this.strawberries.size,
            total: this.chapter.strawberries,
            timeRemaining: this.timeRemaining,
            lives: this.lives,
            deaths: this.deaths,
            assist: settings.assistMode
        }, frameDt);
    }

    /**
     * Calculates the chapter score from strawberries and time.
     *
     * @returns {{ score: number, berryScore: number, timeScore: number }} Score breakdown.
     */
    score() {
        const berryScore = this.chapter.strawberries ? Math.round((this.strawberries.size / this.chapter.strawberries) * 100) : 100;
        const par = this.chapter.timeLimit * 0.6;
        const timeScore = this.elapsed <= par ? 100 : Math.max(40, Math.round(100 - ((this.elapsed - par) / (this.chapter.timeLimit - par)) * 60));
        const deathPenalty = Math.min(20, this.deaths);
        return { score: Math.max(0, Math.round((berryScore + timeScore) / 2) - deathPenalty), berryScore, timeScore };
    }

    /**
     * Completes the chapter, updates the save and unlocks the next one.
     *
     * @param {number} chapterIndex - Index of this chapter in the chapter list.
     * @returns {{ score: number, berryScore: number, timeScore: number }} Final score.
     */
    complete(chapterIndex) {
        this.finished = true;
        const result = this.score();
        if (this.chapter.custom) return result;
        const record = chapterRecord(this.chapter.id);
        record.completed = true;
        record.bestTime = record.bestTime === null ? this.elapsed : Math.min(record.bestTime, this.elapsed);
        record.bestScore = Math.max(record.bestScore || 0, result.score);
        save.unlocked = Math.max(save.unlocked, chapterIndex + 2);
        save.session = null;
        persistSave();
        return result;
    }

    /**
     * Writes the resumable state of this run to the save file.
     *
     * @returns {void}
     */
    persist() {
        if (this.finished || this.chapter.custom) return;
        save.started = true;
        save.session = {
            chapter: this.chapter.id,
            checkpoint: this.checkpoint,
            strawberries: [...this.strawberries],
            timeRemaining: this.timeRemaining,
            elapsed: this.elapsed,
            lives: this.lives,
            deaths: this.deaths
        };
        persistSave();
    }

    /**
     * Tears the chapter down.
     *
     * @returns {void}
     */
    destroy() {
        for (const remove of this.#unsubscribe) remove();
        this.#unsubscribe = [];
        this.runtime?.onExit?.();
        game.level?.destroy();
        game.level = null;
        this.runtime = null;
    }
}

/**
 * Resolves after a delay in real time.
 *
 * @param {number} ms - Delay in milliseconds.
 * @returns {Promise<void>} Resolves after the delay.
 */
export function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

