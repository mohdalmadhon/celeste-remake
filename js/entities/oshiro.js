import { addAnimation, playAnimation } from "../components/animation.js";
import { game } from "../core/game.js";
import { SFX } from "../helpers/sound.js";
import { audio } from "../systems/audio.js";
import { createBody } from "../systems/physics.js";
import { Entity } from "./entity.js";
import { addBossAnimations } from "./hazards.js";

/**
 * Mr. Oshiro in his hotel manager form, used in cutscenes.
 */
export class OshiroHost extends Entity {
    /** @type {{ x: number, y: number, speed: number, resolve: Function }|null} */
    #move = null;
    /** @type {number} */
    #time = 0;
    /** @type {number} */
    baseY;

    /**
     * @param {number} x - Left edge.
     * @param {number} y - Top edge.
     */
    constructor(x, y) {
        super({ x, y }, { width: 192, height: 192 }, "oshiro");
        this.baseY = y;
        this.elem.classList.add("oshiro-host");
        this.setSpriteSheet("./assets/generated/sprites/oshiro.png", { frameWidth: 96, frameHeight: 96, scale: 2, sheetWidth: 2976, sheetHeight: 672 });
        addAnimation(this, "idle", { row: 0, startFrame: 0, frameCount: 11, fps: 10 });
        addAnimation(this, "move", { row: 1, startFrame: 0, frameCount: 11, fps: 12 });
        addAnimation(this, "sweeping", { row: 2, startFrame: 0, frameCount: 7, fps: 9 });
        addAnimation(this, "side", { row: 3, startFrame: 0, frameCount: 7, fps: 9 });
        addAnimation(this, "fall", { row: 4, startFrame: 0, frameCount: 9, fps: 12, loop: false });
        addAnimation(this, "recover", { row: 5, startFrame: 0, frameCount: 8, fps: 10, loop: false, next: "idle" });
        addAnimation(this, "appear", { row: 6, startFrame: 0, frameCount: 31, fps: 20, loop: false, next: "idle" });
        playAnimation(this, "sweeping");
        this.facing = -1;
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Floats to a position.
     *
     * @param {number} x - Target left edge.
     * @param {number} y - Target top edge.
     * @param {number} [speed=160] - Speed in pixels per second.
     * @returns {Promise<void>} Resolves on arrival.
     */
    moveTo(x, y, speed = 160) {
        return new Promise((resolve) => {
            this.#move = { x, y, speed, resolve };
            playAnimation(this, "move");
        });
    }

    /**
     * Bobs gently and follows scripted movement.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        this.#time += dt;
        const move = this.#move;
        if (move) {
            const dx = move.x - this.position.x;
            const dy = move.y - this.baseY;
            const distance = Math.hypot(dx, dy);
            if (distance <= move.speed * dt) {
                this.position.x = move.x;
                this.baseY = move.y;
                this.#move = null;
                playAnimation(this, "idle");
                move.resolve();
            } else {
                this.position.x += (dx / distance) * move.speed * dt;
                this.baseY += (dy / distance) * move.speed * dt;
                if (Math.abs(dx) > 1) this.facing = Math.sign(dx);
            }
        }
        this.position.y = this.baseY + Math.sin(this.#time * 2.2) * 3;
    }
}

/**
 * Chase tuning for one stretch of the pursuit.
 *
 * @typedef {object} ChasePhase
 * @property {number} cooldown - Seconds between charges.
 * @property {number} windup - Telegraph duration before a charge.
 * @property {number} speed - Charge speed in pixels per second.
 * @property {number} lag - How quickly Oshiro tracks the player's height.
 */

/**
 * Oshiro's boss form: hovers at the trailing edge of the screen, tracks the
 * player's height, winds up with a clear flash and sound, then charges across
 * the screen. Touching him is fatal.
 */
export class OshiroBoss extends Entity {
    /** @type {"hidden"|"appear"|"follow"|"windup"|"dash"|"recover"|"defeated"} */
    status = "hidden";
    /** @type {import("../systems/physics.js").Body} */
    body;
    /** @type {ChasePhase} */
    phase = { cooldown: 2.6, windup: 0.8, speed: 950, lag: 2.5 };
    /** @type {number} */
    #timer = 0;
    /** @type {number} */
    #dashY = 0;
    /** @type {number} */
    #time = 0;
    /** @type {number} */
    proximity = 0;
    /** @type {boolean} */
    active = false;
    /** @type {HTMLElement|null} */
    #warning = null;

    constructor() {
        super({ x: -500, y: 0 }, { width: 288, height: 288 }, "oshiro-boss");
        this.elem.classList.add("oshiro-boss");
        this.elem.style.transformOrigin = "50% 50%";
        this.layer = "front";
        this.setSpriteSheet("./assets/generated/sprites/oshiro_boss.png", { frameWidth: 96, frameHeight: 96, scale: 3, sheetWidth: 1248, sheetHeight: 576 });
        addBossAnimations(this);
        this.body = createBody(-500, 0, 84, 84, "hazard", { direction: "any", active: false });
        this.visible = false;
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Center point of the boss.
     *
     * @returns {{ x: number, y: number }} World position.
     */
    center() {
        return { x: this.position.x + 144, y: this.position.y + 150 };
    }

    /**
     * Places the boss with its center at a point.
     *
     * @param {number} x - Center x.
     * @param {number} y - Center y.
     * @returns {void}
     */
    setCenter(x, y) {
        this.position.x = x - 144;
        this.position.y = y - 150;
        this.body.x = x - 42;
        this.body.y = y - 42;
        game.level?.world.update(this.body);
    }

    /**
     * Starts the chase from the left edge of the view.
     *
     * @returns {void}
     */
    start() {
        this.active = true;
        this.visible = true;
        this.status = "appear";
        this.#timer = 0.8;
        const camera = game.camera;
        const player = game.player;
        this.setCenter(camera.position.x + 90, player.box.y + 10);
        this.snap();
        playAnimation(this, "respawn", true);
        audio.play(SFX.hairCharged, { volume: 0.5, rate: 0.6 });
    }

    /**
     * Stops the chase immediately.
     *
     * @returns {void}
     */
    stop() {
        this.active = false;
        this.status = "hidden";
        this.visible = false;
        this.body.active = false;
        this.#clearWarning();
    }

    /**
     * Shows the horizontal warning stripe at the charge height.
     *
     * @param {number} y - World y of the charge line.
     * @returns {void}
     */
    #showWarning(y) {
        if (!this.#warning) {
            this.#warning = document.createElement("div");
            this.#warning.className = "charge-warning";
            game.level.layers.fx.appendChild(this.#warning);
        }
        this.#warning.style.transform = `translate3d(${Math.round(game.camera.position.x)}px,${Math.round(y - 40)}px,0)`;
        this.#warning.classList.add("show");
    }

    /**
     * Hides the warning stripe.
     *
     * @returns {void}
     */
    #clearWarning() {
        this.#warning?.classList.remove("show");
    }

    /**
     * Runs the pursuit state machine.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        if (!this.active) return;
        this.#time += dt;
        const camera = game.camera;
        const player = game.player;
        const target = { x: player.box.x + player.box.w / 2, y: player.box.y + player.box.h / 2 };
        const c = this.center();
        const homeX = camera.position.x + 70;
        switch (this.status) {
            case "appear":
                this.#timer -= dt;
                this.setCenter(homeX, c.y + (target.y - c.y) * Math.min(1, dt * this.phase.lag));
                if (this.#timer <= 0) {
                    this.status = "follow";
                    this.#timer = this.phase.cooldown;
                    this.body.active = true;
                }
                break;
            case "follow": {
                const y = c.y + (target.y - c.y) * Math.min(1, dt * this.phase.lag) + Math.sin(this.#time * 3) * 0.6;
                const x = c.x + (homeX - c.x) * Math.min(1, dt * 4);
                this.setCenter(x, y);
                this.#timer -= dt;
                if (this.#timer <= 0 && player.alive && !game.cutscene) {
                    this.status = "windup";
                    this.#timer = this.phase.windup;
                    this.#dashY = target.y;
                    playAnimation(this, "charge", true);
                    audio.tone(160, this.phase.windup, 0.12, "sfx", undefined, "sawtooth");
                    game.camera.shake(2, this.phase.windup);
                }
                break;
            }
            case "windup": {
                this.#timer -= dt;
                const y = c.y + (target.y - c.y) * Math.min(1, dt * this.phase.lag * 1.5);
                this.#dashY = y;
                this.setCenter(homeX - 20 * (1 - this.#timer / this.phase.windup), y);
                this.#showWarning(y);
                this.visual.offsetX = Math.round((Math.random() * 2 - 1) * 3);
                if (this.#timer <= 0.15 && this.components.animation.state.sprite !== "chargeFlash") {
                    playAnimation(this, "chargeFlash", true);
                }
                if (this.#timer <= 0) {
                    this.status = "dash";
                    this.visual.offsetX = 0;
                    this.#clearWarning();
                    playAnimation(this, "dash", true);
                    audio.play(SFX.dashRight, { volume: 0.7, rate: 0.6 });
                    game.camera.shake(5, 0.2);
                }
                break;
            }
            case "dash":
                this.setCenter(c.x + this.phase.speed * dt, this.#dashY);
                if (Math.random() < 0.7) {
                    game.particles?.burst({ x: c.x - 40, y: this.#dashY + (Math.random() - 0.5) * 60, count: 1, color: "#9be8ff", size: 6, speed: 60, angle: Math.PI, spread: 0.6, life: 0.4 });
                }
                for (const entity of game.level.entities) {
                    if (entity.nudge && Math.abs(entity.position.x + 25 - c.x) < 40 && Math.abs(entity.position.y - this.#dashY) < 160) entity.nudge(40);
                }
                if (c.x > camera.position.x + camera.viewWidth + 200) {
                    this.status = "recover";
                    this.body.active = false;
                    this.visible = false;
                    this.#timer = 0.6;
                }
                break;
            case "recover":
                this.#timer -= dt;
                if (this.#timer <= 0) this.start();
                break;
            default:
                break;
        }
        const distance = Math.hypot(target.x - this.center().x, target.y - this.center().y);
        this.proximity = this.visible ? Math.max(0, 1 - distance / 700) : 0;
    }

    /**
     * Puts the boss away after a death so the player gets a fair restart.
     *
     * @returns {void}
     */
    reset() {
        if (!this.active) return;
        this.#clearWarning();
        this.status = "recover";
        this.visible = false;
        this.body.active = false;
        this.#timer = 1.2;
    }
}
