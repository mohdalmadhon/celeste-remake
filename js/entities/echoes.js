import { addAnimation, playAnimation } from "../components/animation.js";
import { game } from "../core/game.js";
import { SFX } from "../helpers/sound.js";
import { audio } from "../systems/audio.js";
import { createBody } from "../systems/physics.js";
import { Entity } from "./entity.js";

/**
 * A translucent memory of someone Madeline met, floating near the summit.
 * Speaks once when approached.
 */
export class Echo extends Entity {
    /** @type {boolean} */
    spoken = false;
    /** @type {number} */
    #time = Math.random() * 6;
    /** @type {number} */
    baseY;
    /** @type {number} */
    radius;

    /**
     * @param {string} id - Identifier.
     * @param {number} x - Feet center x.
     * @param {number} y - Feet y.
     * @param {{ sheet: string, frameWidth: number, frameHeight: number, scale: number, sheetWidth: number, sheetHeight: number, row: number, frames: number, fps?: number, facing?: number }} sprite - Sprite description.
     * @param {number} [radius=140] - Distance that triggers the memory.
     */
    constructor(id, x, y, sprite, radius = 140) {
        const width = sprite.frameWidth * sprite.scale;
        const height = sprite.frameHeight * sprite.scale;
        super({ x: x - width / 2, y: y - height }, { width, height }, id);
        this.baseY = y - height;
        this.radius = radius;
        this.elem.classList.add("echo");
        this.setSpriteSheet(sprite.sheet, sprite);
        addAnimation(this, "idle", { row: sprite.row, startFrame: 0, frameCount: sprite.frames, fps: sprite.fps ?? 8 });
        playAnimation(this, "idle");
        this.facing = sprite.facing ?? -1;
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Floats, shimmers and fades in as Madeline gets closer.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        this.#time += dt;
        this.position.y = this.baseY + Math.sin(this.#time * 1.6) * 4 - 6;
        const player = game.player;
        if (!player) return;
        const dx = player.box.x + player.box.w / 2 - (this.position.x + this.dimensions.width / 2);
        const dy = player.box.y - this.position.y;
        const distance = Math.hypot(dx, dy);
        const target = this.spoken ? 0.35 : Math.max(0.25, Math.min(0.85, 1.2 - distance / 400));
        this.visual.opacity += (target - this.visual.opacity) * Math.min(1, dt * 3);
        if (Math.random() < dt * 6) {
            game.particles?.burst({ x: this.position.x + this.dimensions.width / 2, y: this.position.y + this.dimensions.height * 0.6, count: 1, color: "rgba(170,200,255,0.8)", size: 3, speed: 20, angle: -Math.PI / 2, spread: 1.2, life: 0.9, jitter: 18 });
        }
    }

    /**
     * Whether the player is close enough to hear this echo.
     *
     * @returns {boolean} True when within the trigger radius.
     */
    inRange() {
        const player = game.player;
        if (!player || this.spoken) return false;
        const dx = player.box.x + player.box.w / 2 - (this.position.x + this.dimensions.width / 2);
        return Math.abs(dx) < this.radius && Math.abs(player.box.y + player.box.h - (this.baseY + this.dimensions.height)) < 120;
    }

    /**
     * Dissolves the echo into light after it has spoken.
     *
     * @returns {void}
     */
    fade() {
        this.spoken = true;
        audio.play(SFX.summitFly, { volume: 0.35, rate: 1.2 });
        game.particles?.burst({ x: this.position.x + this.dimensions.width / 2, y: this.position.y + this.dimensions.height / 2, count: 18, color: "#b9d4ff", size: 4, speed: 120, life: 0.8, drag: 3 });
    }
}

/**
 * The part of Madeline that doubts her: replays Madeline's own path a moment
 * behind her. Touching her is fatal, so the player has to keep moving.
 */
export class BadelineChaser extends Entity {
    /** @type {Array<{ x: number, y: number, col: number, row: number, facing: number, bx: number, by: number }>} */
    #trail = [];
    /** @type {number} */
    delaySteps;
    /** @type {boolean} */
    active = false;
    /** @type {import("../systems/physics.js").Body} */
    body;
    /** @type {number} */
    #warmup = 0;

    /**
     * @param {number} [delay=1.3] - Seconds she trails behind.
     */
    constructor(delay = 1.3) {
        super({ x: -500, y: -500 }, { width: 64, height: 64 }, "badeline");
        this.delaySteps = Math.round(delay * 120);
        this.elem.classList.add("badeline");
        this.elem.style.transformOrigin = "33px 61px";
        this.setSpriteSheet("./assets/player3.png", { frameWidth: 64, frameHeight: 64 });
        this.body = createBody(-500, -500, 20, 36, "hazard", { direction: "any", active: false });
        this.visible = false;
        this.setUpdate((self) => self.step());
    }

    /**
     * Appears and starts following.
     *
     * @param {number} x - Left edge to appear at.
     * @param {number} y - Top edge to appear at.
     * @returns {void}
     */
    start(x, y) {
        this.active = true;
        this.visible = true;
        this.#trail = [];
        this.#warmup = 0;
        this.position.x = x;
        this.position.y = y;
        this.snap();
        game.particles?.burst({ x: x + 32, y: y + 36, count: 20, color: "#a46ad8", size: 5, speed: 160, life: 0.6 });
        audio.play(SFX.mirrorLanding, { volume: 0.6 });
    }

    /**
     * Stops following and hides.
     *
     * @returns {void}
     */
    stop() {
        this.active = false;
        this.body.active = false;
    }

    /**
     * Restarts the delay after a death so the player is not instantly caught.
     *
     * @returns {void}
     */
    reset() {
        if (!this.active) return;
        this.#trail = [];
        this.#warmup = 0;
        this.body.active = false;
        this.visual.opacity = 0.3;
    }

    /**
     * Records the player's position and replays it after the delay.
     *
     * @returns {void}
     */
    step() {
        if (!this.active) return;
        const player = game.player;
        if (!player.alive) return;
        const animation = player.components.animation;
        const clip = animation.sprites[animation.state.sprite];
        const col = clip ? (clip.frames ? clip.frames[animation.state.frame] : clip.startFrame + animation.state.frame) : 0;
        this.#trail.push({
            x: player.position.x, y: player.position.y,
            bx: player.box.x, by: player.box.y,
            col: Math.min(15, col), row: 10,
            facing: player.components.movement.direction
        });
        this.#warmup++;
        if (this.#trail.length > this.delaySteps) {
            const sample = this.#trail.shift();
            this.position.x = sample.x;
            this.position.y = sample.y;
            this.facing = sample.facing;
            this.setFrame(sample.col % 16, 10);
            this.body.x = sample.bx + 2;
            this.body.y = sample.by + 4;
            this.body.active = true;
            game.level.world.update(this.body);
            this.visual.opacity = Math.min(1, this.visual.opacity + 0.03);
            if (Math.random() < 0.3) {
                game.particles?.burst({ x: sample.bx + 12, y: sample.by + 20, count: 1, color: "#8e4fc9", size: 4, speed: 25, life: 0.5, jitter: 10 });
            }
        } else {
            this.body.active = false;
        }
    }
}

