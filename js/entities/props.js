import { addAnimation, playAnimation } from "../components/animation.js";
import { events } from "../core/events.js";
import { game } from "../core/game.js";
import { SFX } from "../helpers/sound.js";
import { audio } from "../systems/audio.js";
import { createBody, moveSolid } from "../systems/physics.js";
import { Entity } from "./entity.js";

/**
 * Collectable strawberry that follows the player and is secured on landing.
 */
export class Strawberry extends Entity {
    /** @type {boolean} */
    collected = false;
    /** @type {boolean} */
    following = false;
    /** @type {number} */
    #time = 0;
    /** @type {{ x: number, y: number }} */
    home;
    /** @type {number} */
    #groundTime = 0;
    /** @type {import("../systems/physics.js").Body} */
    body;

    /**
     * @param {string} id - Unique strawberry id.
     * @param {number} x - Center x.
     * @param {number} y - Center y.
     * @param {boolean} [ghost=false] - Draw as an already collected ghost berry.
     */
    constructor(id, x, y, ghost = false) {
        super({ x: x - 32, y: y - 32 }, { width: 64, height: 64 }, id);
        this.home = { x: x - 32, y: y - 32 };
        this.elem.classList.add("strawberry");
        const sheet = ghost ? "./assets/generated/sprites/ghostberry.png" : "./assets/generated/sprites/strawberry.png";
        this.setSpriteSheet(sheet, { frameWidth: 32, frameHeight: 32, scale: 2, sheetWidth: 1152, sheetHeight: ghost ? 64 : 96 });
        addAnimation(this, "idle", { row: 0, startFrame: 0, frameCount: 36, fps: 18 });
        addAnimation(this, "collect", { row: 1, startFrame: 0, frameCount: 5, fps: 14, loop: false });
        playAnimation(this, "idle");
        this.body = createBody(x - 20, y - 20, 40, 40, "trigger", {
            onEnter: () => this.#touch()
        });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Starts following the player when touched.
     *
     * @returns {void}
     */
    #touch() {
        if (this.collected || this.following) return;
        this.following = true;
        this.body.active = false;
        audio.play(SFX.strawberryGold, { volume: 0.4, rate: 1.2 });
    }

    /**
     * Bobs in place, follows the player and collects once the player is safely grounded.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        this.#time += dt;
        if (this.collected) {
            this.position.y -= 30 * dt;
            this.visual.opacity = Math.max(0, this.visual.opacity - dt * 1.4);
            return;
        }
        const player = game.player;
        if (this.following && player) {
            const tx = player.box.x + player.box.w / 2 - 32 - player.components.movement.direction * 40;
            const ty = player.box.y - 46;
            this.position.x += (tx - this.position.x) * Math.min(1, dt * 8);
            this.position.y += (ty - this.position.y) * Math.min(1, dt * 8);
            if (player.onGround && player.alive) {
                this.#groundTime += dt;
                if (this.#groundTime > 0.15) this.collect();
            } else {
                this.#groundTime = 0;
            }
            return;
        }
        this.position.y = this.home.y + Math.sin(this.#time * 3) * 4;
    }

    /**
     * Secures the strawberry and plays its pickup feedback.
     *
     * @returns {void}
     */
    collect() {
        if (this.collected) return;
        this.collected = true;
        this.following = false;
        playAnimation(this, "collect");
        audio.play(SFX.strawberry, { volume: 0.7 });
        const cx = this.position.x + 32;
        const cy = this.position.y + 32;
        game.particles?.burst({ x: cx, y: cy, count: 14, color: "#ff5d6c", size: 5, speed: 180, life: 0.5, drag: 4 });
        game.particles?.burst({ x: cx, y: cy, count: 8, color: "#ffe9a8", size: 3, speed: 120, life: 0.6, drag: 3 });
        events.emit("strawberry:collect", { id: this.id, x: cx, y: cy });
    }

    /**
     * Drops a followed strawberry back to its home when the player dies.
     *
     * @returns {void}
     */
    reset() {
        if (this.collected) return;
        this.following = false;
        this.#groundTime = 0;
        this.position.x = this.home.x;
        this.position.y = this.home.y;
        this.body.active = true;
        this.snap();
    }
}

/**
 * Checkpoint flag that records a respawn point when touched.
 */
export class CheckpointFlag extends Entity {
    /** @type {boolean} */
    reached = false;

    /**
     * @param {string} id - Checkpoint id.
     * @param {number} x - Feet x of the respawn point.
     * @param {number} y - Ground y of the respawn point.
     * @param {(id: string) => void} onReach - Called on first touch.
     */
    constructor(id, x, y, onReach) {
        super({ x: x - 16, y: y - 48 }, { width: 32, height: 48 }, id);
        this.elem.classList.add("checkpoint");
        this.setSpriteSheet("./assets/generated/ui/checkpoint_flag_off.png", { stretch: true });
        this.body = createBody(x - 60, y - 160, 120, 160, "trigger", {
            onEnter: () => {
                if (this.reached) return;
                this.activate(true);
                onReach(id);
            }
        });
    }

    /**
     * Shows the flag as raised.
     *
     * @param {boolean} [effects=false] - Whether to play feedback.
     * @returns {void}
     */
    activate(effects = false) {
        this.reached = true;
        this.setSpriteSheet("./assets/generated/ui/checkpoint_flag.png", { stretch: true });
        if (effects) {
            audio.play(SFX.screenEntry, { volume: 0.4 });
            game.particles?.burst({ x: this.position.x + 16, y: this.position.y + 10, count: 12, color: "#5ee37a", size: 4, speed: 120, life: 0.6, drag: 4 });
        }
    }
}

/**
 * Solid block that shakes and falls when triggered, and resets on respawn.
 */
export class FallingBlock extends Entity {
    /** @type {"idle"|"shaking"|"falling"|"gone"} */
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
    shakeTime;
    /** @type {boolean} */
    triggerOnTouch;
    /** @type {boolean} */
    crushes;

    /**
     * @param {{ x: number, y: number, w: number, h: number, path: string }} tile - Block geometry and image.
     * @param {{ shakeTime?: number, triggerOnTouch?: boolean, crushes?: boolean, surface?: string }} [options] - Behaviour options.
     */
    constructor(tile, options = {}) {
        super({ x: tile.x, y: tile.y }, { width: tile.w, height: tile.h });
        this.home = { x: tile.x, y: tile.y };
        this.elem.classList.add("falling-block");
        this.setSpriteSheet(tile.path, { stretch: true });
        this.shakeTime = options.shakeTime ?? 0.35;
        this.triggerOnTouch = options.triggerOnTouch ?? true;
        this.crushes = options.crushes ?? false;
        this.body = createBody(tile.x, tile.y, tile.w, tile.h, "solid", {
            surface: options.surface || "wood",
            onTouch: (player, side) => {
                if (this.triggerOnTouch && side === "top") this.trigger();
            }
        });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Starts the shake-then-fall sequence.
     *
     * @param {number} [delay=0] - Extra delay before shaking.
     * @returns {void}
     */
    trigger(delay = 0) {
        if (this.status !== "idle") return;
        this.status = "shaking";
        this.#timer = this.shakeTime + delay;
        audio.play(SFX.crack, { volume: 0.35 });
    }

    /**
     * Shakes, then falls with gravity carrying anything standing on it.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        if (this.status === "shaking") {
            this.#timer -= dt;
            this.visual.offsetX = this.#timer < this.shakeTime ? Math.round((Math.random() * 2 - 1) * 2) : 0;
            if (this.#timer <= 0) {
                this.status = "falling";
                this.visual.offsetX = 0;
                this.#vy = 0;
                audio.play(SFX.breakBridge, { volume: 0.45 });
            }
        } else if (this.status === "falling") {
            this.#vy = Math.min(900, this.#vy + 2000 * dt);
            const before = this.body.y;
            const target = Math.round(this.position.y + this.#vy * dt);
            moveSolid(game.level.world, this.body, 0, target - before, game.player ? [game.player.box] : []);
            this.position.y = this.body.y;
            if (this.position.y > (game.level.killY ?? 3000) + 400) {
                this.status = "gone";
                this.body.active = false;
                this.visible = false;
            }
        }
    }

    /**
     * Restores the block to its original place.
     *
     * @returns {void}
     */
    reset() {
        this.status = "idle";
        this.position.x = this.home.x;
        this.position.y = this.home.y;
        this.body.x = this.home.x;
        this.body.y = this.home.y;
        this.body.active = true;
        game.level?.world.update(this.body);
        this.visible = true;
        this.visual.offsetX = 0;
        this.snap();
    }
}

/**
 * Platform that crumbles shortly after being stood on and reforms later.
 */
export class CrumbleBlock extends Entity {
    /** @type {"idle"|"shaking"|"broken"} */
    status = "idle";
    /** @type {number} */
    #timer = 0;
    /** @type {import("../systems/physics.js").Body} */
    body;

    /**
     * @param {{ x: number, y: number, w: number, h: number, path: string }} tile - Geometry and image.
     * @param {string} [surface="metal"] - Footstep surface.
     */
    constructor(tile, surface = "metal") {
        super({ x: tile.x, y: tile.y }, { width: tile.w, height: tile.h });
        this.elem.classList.add("crumble-block");
        this.setSpriteSheet(tile.path, { stretch: true });
        this.body = createBody(tile.x, tile.y, tile.w, tile.h, "solid", {
            surface,
            onTouch: (player, side) => {
                if (side === "top" || side === "side") this.trigger();
            }
        });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Starts crumbling.
     *
     * @returns {void}
     */
    trigger() {
        if (this.status !== "idle") return;
        this.status = "shaking";
        this.#timer = 0.5;
        audio.play(SFX.crack, { volume: 0.4 });
    }

    /**
     * Shakes, breaks and later respawns when the space is clear.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        if (this.status === "shaking") {
            this.#timer -= dt;
            this.visual.offsetX = Math.round((Math.random() * 2 - 1) * 2);
            if (this.#timer <= 0) {
                this.status = "broken";
                this.#timer = 2;
                this.body.active = false;
                this.visual.offsetX = 0;
                this.visual.opacity = 0.15;
                audio.play(SFX.breakBridge, { volume: 0.35 });
                game.particles?.burst({ x: this.position.x + this.dimensions.width / 2, y: this.position.y + this.dimensions.height / 2, count: 10, color: "#8a93a8", size: 5, speed: 90, gravity: 600, life: 0.6, jitter: this.dimensions.width / 2 });
            }
        } else if (this.status === "broken") {
            this.#timer -= dt;
            if (this.#timer <= 0) {
                const p = game.player?.box;
                const b = this.body;
                const blocked = p && p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y;
                if (!blocked) this.reset();
            }
        }
    }

    /**
     * Restores the block immediately.
     *
     * @returns {void}
     */
    reset() {
        this.status = "idle";
        this.body.active = true;
        this.visual.opacity = 1;
        this.visual.offsetX = 0;
    }
}

/**
 * Zip mover style cart: launches along its rail when ridden and slowly returns.
 */
export class ZipMover extends Entity {
    /** @type {"idle"|"launch"|"hold"|"return"} */
    status = "idle";
    /** @type {{ x: number, y: number }} */
    start;
    /** @type {{ x: number, y: number }} */
    end;
    /** @type {number} */
    #progress = 0;
    /** @type {number} */
    #timer = 0;
    /** @type {import("../systems/physics.js").Body} */
    body;

    /**
     * @param {number} x - Start left edge.
     * @param {number} y - Start top edge.
     * @param {number} dx - Horizontal travel.
     * @param {number} dy - Vertical travel.
     */
    constructor(x, y, dx, dy) {
        super({ x, y }, { width: 98, height: 64 }, "zip-mover");
        this.start = { x, y };
        this.end = { x: x + dx, y: y + dy };
        this.elem.classList.add("zip-mover");
        this.setSpriteSheet("./assets/tiles/celeste/cart.png", { stretch: true });
        this.body = createBody(x, y, 98, 64, "solid", {
            surface: "metal",
            climbable: true,
            onTouch: () => this.activate()
        });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Starts the launch when idle.
     *
     * @returns {void}
     */
    activate() {
        if (this.status !== "idle") return;
        this.status = "launch";
        this.#timer = 0.1;
        audio.play(SFX.cart, { volume: 0.5 });
    }

    /**
     * Activates when the player rides or climbs it.
     *
     * @returns {void}
     */
    #checkRider() {
        if (this.status === "idle" && game.player?.box.isRiding(this.body)) this.activate();
    }

    /**
     * Moves along the path with an accelerating launch and a slow return.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        this.#checkRider();
        if (this.status === "idle") return;
        if (this.status === "launch") {
            if (this.#timer > 0) {
                this.#timer -= dt;
                return;
            }
            this.#progress = Math.min(1, this.#progress + dt * (0.6 + this.#progress * 5));
            if (this.#progress >= 1) {
                this.status = "hold";
                this.#timer = 0.5;
                game.camera?.shake(4, 0.15);
                audio.play(SFX.crack, { volume: 0.5, rate: 0.7 });
            }
        } else if (this.status === "hold") {
            this.#timer -= dt;
            if (this.#timer <= 0) this.status = "return";
        } else if (this.status === "return") {
            this.#progress = Math.max(0, this.#progress - dt * 0.5);
            if (this.#progress <= 0) this.status = "idle";
        }
        const x = Math.round(this.start.x + (this.end.x - this.start.x) * this.#progress);
        const y = Math.round(this.start.y + (this.end.y - this.start.y) * this.#progress);
        const dx = x - this.body.x;
        const dy = y - this.body.y;
        if (dx || dy) {
            moveSolid(game.level.world, this.body, dx, dy, game.player ? [game.player.box] : []);
            if (this.status === "launch" && game.player?.box.isRiding(this.body)) {
                game.player.velocity.x = Math.max(-900, Math.min(900, dx / dt * 0.6));
                if (dy < 0) game.player.velocity.y = 0;
            }
        }
        this.position.x = this.body.x;
        this.position.y = this.body.y;
    }

    /**
     * Snaps back to the start of the path.
     *
     * @returns {void}
     */
    reset() {
        this.status = "idle";
        this.#progress = 0;
        this.body.x = this.start.x;
        this.body.y = this.start.y;
        game.level?.world.update(this.body);
        this.position.x = this.start.x;
        this.position.y = this.start.y;
        this.snap();
    }
}

/**
 * Green crystal that restores the dash and stamina, then regrows.
 */
export class DashCrystal extends Entity {
    /** @type {number} */
    #respawn = 0;
    /** @type {number} */
    #time = Math.random() * 6;
    /** @type {import("../systems/physics.js").Body} */
    body;
    /** @type {{ x: number, y: number }} */
    home;

    /**
     * @param {number} x - Center x.
     * @param {number} y - Center y.
     */
    constructor(x, y) {
        super({ x: x - 20, y: y - 20 }, { width: 40, height: 40 }, "crystal");
        this.home = { x: x - 20, y: y - 20 };
        this.elem.classList.add("dash-crystal");
        this.setSpriteSheet("./assets/generated/sprites/dash_crystal.png", { stretch: true });
        this.body = createBody(x - 22, y - 22, 44, 44, "trigger", {
            onStay: (player) => this.#use(player)
        });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Refills the player when it needs a dash.
     *
     * @param {import("./player.js").Player} player - Player touching the crystal.
     * @returns {void}
     */
    #use(player) {
        if (this.#respawn > 0) return;
        if (player.dashes >= player.maxDashes && player.stamina >= 100) return;
        player.refillDash(true);
        player.refillStamina();
        this.#respawn = 2.5;
        this.visual.opacity = 0.15;
        game.hitStop(0.05);
        audio.tone(1320, 0.18, 0.25);
        audio.tone(1760, 0.22, 0.18, "sfx", (audio.context?.currentTime ?? 0) + 0.05);
        game.particles?.burst({ x: this.home.x + 20, y: this.home.y + 20, count: 14, color: "#8dffb0", size: 4, speed: 200, life: 0.45, drag: 5 });
    }

    /**
     * Floats gently and regrows after use.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        this.#time += dt;
        this.position.y = this.home.y + Math.sin(this.#time * 2.4) * 3;
        if (this.#respawn > 0) {
            this.#respawn -= dt;
            if (this.#respawn <= 0) {
                this.visual.opacity = 1;
                audio.tone(990, 0.12, 0.12);
            }
        }
    }

    /**
     * Makes the crystal available again.
     *
     * @returns {void}
     */
    reset() {
        this.#respawn = 0;
        this.visual.opacity = 1;
    }
}

/**
 * Green bubble that captures the player and launches them with a long dash.
 */
export class Booster extends Entity {
    /** @type {number} */
    #cooldown = 0;
    /** @type {import("../systems/physics.js").Body} */
    body;
    /** @type {{ x: number, y: number }} */
    center;

    /**
     * @param {number} x - Center x.
     * @param {number} y - Center y.
     */
    constructor(x, y) {
        super({ x: x - 48, y: y - 48 }, { width: 96, height: 96 }, "booster");
        this.center = { x, y };
        this.elem.classList.add("booster");
        this.setSpriteSheet("./assets/generated/sprites/booster.png", { frameWidth: 32, frameHeight: 32, scale: 3, sheetWidth: 288, sheetHeight: 128 });
        addAnimation(this, "loop", { row: 0, startFrame: 0, frameCount: 5, fps: 8 });
        addAnimation(this, "inside", { row: 1, startFrame: 0, frameCount: 4, fps: 12 });
        addAnimation(this, "pop", { row: 2, startFrame: 0, frameCount: 9, fps: 18, loop: false });
        playAnimation(this, "loop");
        this.body = createBody(x - 30, y - 30, 60, 60, "trigger", {
            onEnter: (player) => {
                if (this.#cooldown > 0) return;
                this.#cooldown = 1;
                playAnimation(this, "pop");
                player.enterBooster(this.center);
                audio.tone(520, 0.2, 0.2);
            }
        });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Reforms after use.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        if (this.#cooldown > 0) {
            this.#cooldown -= dt;
            if (this.#cooldown <= 0) playAnimation(this, "loop");
        }
    }

    /**
     * Makes the booster available again.
     *
     * @returns {void}
     */
    reset() {
        this.#cooldown = 0;
        playAnimation(this, "loop");
    }
}

/**
 * Simple animated character driven by scripts, such as Granny and the bird.
 */
export class Npc extends Entity {
    /** @type {{ x: number, y: number, speed: number, resolve: Function }|null} */
    #moveTarget = null;

    /**
     * @param {string} id - Identifier.
     * @param {{ x: number, y: number }} position - Top-left position.
     * @param {{ width: number, height: number }} size - Element size.
     * @param {string} sheet - Sprite sheet URL.
     * @param {Partial<import("./entity.js").SpriteSheet>} sheetOptions - Frame layout.
     */
    constructor(id, position, size, sheet, sheetOptions) {
        super(position, size, id);
        this.elem.classList.add("npc", `npc-${id}`);
        this.setSpriteSheet(sheet, sheetOptions);
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Glides to a position, used for flying birds and floating characters.
     *
     * @param {number} x - Target left edge.
     * @param {number} y - Target top edge.
     * @param {number} [speed=200] - Speed in pixels per second.
     * @returns {Promise<void>} Resolves on arrival.
     */
    moveTo(x, y, speed = 200) {
        return new Promise((resolve) => {
            this.#moveTarget = { x, y, speed, resolve };
        });
    }

    /**
     * Advances scripted movement.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        const target = this.#moveTarget;
        if (!target) return;
        const dx = target.x - this.position.x;
        const dy = target.y - this.position.y;
        const distance = Math.hypot(dx, dy);
        const travel = target.speed * dt;
        if (distance <= travel) {
            this.position.x = target.x;
            this.position.y = target.y;
            this.#moveTarget = null;
            target.resolve();
            return;
        }
        this.position.x += (dx / distance) * travel;
        this.position.y += (dy / distance) * travel;
        if (Math.abs(dx) > 1) this.facing = Math.sign(dx);
    }

    /**
     * Instantly completes a scripted move, used when skipping cutscenes.
     *
     * @returns {void}
     */
    finishMove() {
        const target = this.#moveTarget;
        if (!target) return;
        this.position.x = target.x;
        this.position.y = target.y;
        this.#moveTarget = null;
        target.resolve();
    }
}
