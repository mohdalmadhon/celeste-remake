import { addAnimation, playAnimation } from "../components/animation.js";
import { game } from "../core/game.js";
import { SFX } from "../helpers/sound.js";
import { audio } from "../systems/audio.js";
import { createBody, moveSolid } from "../systems/physics.js";
import { Entity } from "./entity.js";

/**
 * Dust bunny: a spiky ball of dust that kills on touch, optionally drifting along a path.
 */
export class DustBunny extends Entity {
    /** @type {import("../systems/physics.js").Body} */
    body;
    /** @type {{ x: number, y: number }} */
    home;
    /** @type {{ x: number, y: number }} */
    travel;
    /** @type {number} */
    speed;
    /** @type {number} */
    #time = 0;

    /**
     * @param {number} x - Center x.
     * @param {number} y - Center y.
     * @param {{ dx?: number, dy?: number, speed?: number, phase?: number }} [path] - Optional back and forth movement.
     */
    constructor(x, y, path = {}) {
        super({ x: x - 24, y: y - 24 }, { width: 48, height: 48 }, "dust-bunny");
        this.home = { x: x - 24, y: y - 24 };
        this.travel = { x: path.dx ?? 0, y: path.dy ?? 0 };
        this.speed = path.speed ?? 1;
        this.#time = path.phase ?? 0;
        this.elem.classList.add("dust-bunny");
        this.setSpriteSheet("./assets/generated/sprites/dust_bunny.png", { stretch: true });
        this.elem.style.transformOrigin = "50% 50%";
        this.body = createBody(x - 16, y - 16, 32, 32, "hazard", { direction: "any" });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Wobbles and moves along its path.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        this.#time += dt * this.speed;
        const t = (Math.sin(this.#time) + 1) / 2;
        this.position.x = this.home.x + this.travel.x * t;
        this.position.y = this.home.y + this.travel.y * t;
        this.visual.rotation = Math.sin(this.#time * 5) * 8;
        const pulse = 1 + Math.sin(this.#time * 9) * 0.06;
        this.visual.scaleX = pulse;
        this.visual.scaleY = 2 - pulse;
        if (this.travel.x || this.travel.y) {
            this.body.x = this.position.x + 8;
            this.body.y = this.position.y + 8;
            game.level?.world.update(this.body);
        }
    }
}

/**
 * Ceiling debris that warns with falling dust, then drops a deadly chunk.
 */
export class DebrisDropper extends Entity {
    /** @type {"idle"|"warning"|"falling"|"done"} */
    status = "idle";
    /** @type {number} */
    #timer = 0;
    /** @type {number} */
    #vy = 0;
    /** @type {{ x: number, y: number }} */
    home;
    /** @type {import("../systems/physics.js").Body} */
    body;
    /** @type {number} */
    triggerX;

    /**
     * @param {number} x - Left edge of the ceiling cell.
     * @param {number} y - Top edge of the ceiling cell.
     * @param {number} triggerX - Player x that starts the warning.
     */
    constructor(x, y, triggerX) {
        super({ x: x + 5, y: y + 5 }, { width: 40, height: 40 }, "debris");
        this.home = { x: x + 5, y: y + 5 };
        this.triggerX = triggerX;
        this.elem.classList.add("debris");
        this.setSpriteSheet("./assets/generated/tiles/resort_debris.png", { stretch: true });
        this.elem.style.transformOrigin = "50% 50%";
        this.body = createBody(x + 10, y + 10, 30, 30, "hazard", { direction: "any", active: false });
        this.visible = false;
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Runs the warning, fall and shatter sequence.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        const player = game.player;
        if (this.status === "idle") {
            if (player && player.box.x + player.box.w / 2 >= this.triggerX) {
                this.status = "warning";
                this.#timer = 0.55;
                this.visible = true;
                audio.play(SFX.crack, { volume: 0.35, rate: 1.3 });
            }
        } else if (this.status === "warning") {
            this.#timer -= dt;
            this.visual.offsetX = Math.round((Math.random() * 2 - 1) * 2);
            if (Math.random() < 0.5) {
                game.particles?.burst({ x: this.home.x + 20, y: this.home.y + 10, count: 1, color: "rgba(200,170,190,0.8)", size: 3, speed: 30, angle: Math.PI / 2, spread: 0.5, gravity: 400, life: 0.5 });
            }
            if (this.#timer <= 0) {
                this.status = "falling";
                this.visual.offsetX = 0;
                this.body.active = true;
                this.#vy = 0;
            }
        } else if (this.status === "falling") {
            this.#vy = Math.min(1100, this.#vy + 2600 * dt);
            this.position.y += this.#vy * dt;
            this.visual.rotation += dt * 360;
            this.body.y = this.position.y + 5;
            game.level.world.update(this.body);
            const ground = game.level.world.solidAt(this.position.x + 5, this.position.y + 5, 30, 34);
            if (ground) {
                this.status = "done";
                this.body.active = false;
                this.visible = false;
                audio.play(SFX.breakBridge, { volume: 0.3, rate: 1.4 });
                game.camera?.shake(2, 0.12);
                game.particles?.burst({ x: this.position.x + 20, y: this.position.y + 30, count: 10, color: "#8b5a4e", size: 5, speed: 160, gravity: 900, life: 0.5, angle: -Math.PI / 2, spread: 2.4 });
            }
        }
    }

    /**
     * Rearms the dropper.
     *
     * @returns {void}
     */
    reset() {
        this.status = "idle";
        this.position.x = this.home.x;
        this.position.y = this.home.y;
        this.body.x = this.home.x + 5;
        this.body.y = this.home.y + 5;
        this.body.active = false;
        game.level?.world.update(this.body);
        this.visible = false;
        this.visual.rotation = 0;
        this.snap();
    }
}

/**
 * Door that slams shut after the player passes a trigger, closing a route.
 */
export class SlamDoor extends Entity {
    /** @type {"open"|"closing"|"closed"} */
    status = "open";
    /** @type {import("../systems/physics.js").Body} */
    body;
    /** @type {{ x: number, y: number }} */
    home;
    /** @type {number} */
    triggerX;
    /** @type {number} */
    delay;
    /** @type {number} */
    #timer = 0;
    /** @type {number} */
    #travel = 0;

    /**
     * @param {number} x - Left edge of the doorway.
     * @param {number} y - Top edge of the doorway when closed.
     * @param {number} height - Doorway height in pixels.
     * @param {number} triggerX - Player x that starts the countdown.
     * @param {number} [delay=0.9] - Seconds between the warning and the slam.
     */
    constructor(x, y, height, triggerX, delay = 0.9) {
        super({ x, y: y - height }, { width: 50, height }, "door");
        this.home = { x, y: y - height };
        this.triggerX = triggerX;
        this.delay = delay;
        this.elem.classList.add("slam-door");
        this.setSpriteSheet("./assets/generated/tiles/resort_door.png", { stretch: true });
        this.body = createBody(x, y - height, 50, height, "solid", { surface: "wood", climbable: true });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Counts down after the trigger, shakes as a warning, then slams down.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        const player = game.player;
        if (this.status === "open") {
            if (player && player.box.x + player.box.w / 2 >= this.triggerX) {
                this.status = "closing";
                this.#timer = this.delay;
                audio.play(SFX.crack, { volume: 0.4, rate: 0.8 });
            }
            return;
        }
        if (this.status === "closing") {
            this.#timer -= dt;
            this.visual.offsetX = this.#timer > 0 ? Math.round((Math.random() * 2 - 1) * 1.5) : 0;
            if (this.#timer <= 0) {
                const step = Math.min(this.dimensions.height - this.#travel, Math.round(1400 * dt));
                if (step > 0) {
                    moveSolid(game.level.world, this.body, 0, step, player ? [player.box] : []);
                    this.#travel += step;
                    this.position.y = this.body.y;
                }
                if (this.#travel >= this.dimensions.height) {
                    this.status = "closed";
                    game.camera?.shake(4, 0.2);
                    audio.play(SFX.quack, { volume: 0.4, rate: 0.7 });
                }
            }
        }
    }

    /**
     * Raises the door again.
     *
     * @returns {void}
     */
    reset() {
        this.status = "open";
        this.#travel = 0;
        this.position.y = this.home.y;
        this.body.y = this.home.y;
        game.level?.world.update(this.body);
        this.visual.offsetX = 0;
        this.snap();
    }
}

/**
 * Hanging lamp prop that sways when something passes.
 */
export class Lamp extends Entity {
    /** @type {number} */
    #angle = 0;
    /** @type {number} */
    #velocity = 0;

    /**
     * @param {number} x - Attachment x.
     * @param {number} y - Attachment y.
     */
    constructor(x, y) {
        super({ x: x - 25, y }, { width: 50, height: 100 }, "lamp");
        this.layer = "back";
        this.elem.classList.add("lamp");
        this.elem.style.transformOrigin = "50% 0%";
        this.setSpriteSheet("./assets/generated/tiles/resort_lamp.png", { stretch: true });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Swings like a damped pendulum, nudged by the player and screen shakes.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        const player = game.player;
        if (player) {
            const dx = player.box.x + player.box.w / 2 - (this.position.x + 25);
            const dy = player.box.y - this.position.y;
            if (Math.abs(dx) < 40 && dy > 0 && dy < 120) this.#velocity += player.velocity.x * 0.02;
        }
        this.#velocity += -this.#angle * 30 * dt;
        this.#velocity *= Math.exp(-1.5 * dt);
        this.#angle += this.#velocity * dt;
        this.visual.rotation = this.#angle;
    }

    /**
     * Pushes the lamp, used by Oshiro's charges.
     *
     * @param {number} amount - Angular impulse.
     * @returns {void}
     */
    nudge(amount) {
        this.#velocity += amount;
    }
}

/**
 * Registers frame clips for Oshiro's boss form.
 *
 * @param {Entity} entity - Boss entity.
 * @returns {void}
 */
export function addBossAnimations(entity) {
    addAnimation(entity, "idle", { row: 0, startFrame: 0, frameCount: 8, fps: 10 });
    addAnimation(entity, "charge", { row: 1, startFrame: 0, frameCount: 6, fps: 12 });
    addAnimation(entity, "chargeFlash", { row: 1, startFrame: 6, frameCount: 7, fps: 14, loop: false, next: "dash" });
    addAnimation(entity, "dash", { row: 2, startFrame: 0, frameCount: 4, fps: 16 });
    addAnimation(entity, "hurt", { row: 3, startFrame: 0, frameCount: 5, fps: 8 });
    addAnimation(entity, "respawn", { row: 4, startFrame: 0, frameCount: 13, fps: 16, loop: false, next: "idle" });
    addAnimation(entity, "transform", { row: 5, startFrame: 0, frameCount: 12, fps: 12, loop: false, next: "idle" });
    playAnimation(entity, "idle");
}
