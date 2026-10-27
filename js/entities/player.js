import { addAnimation, playAnimation } from "../components/animation.js";
import { PLAYER_PHYSICS as P } from "../core/constants.js";
import { events } from "../core/events.js";
import { game } from "../core/game.js";
import { settings } from "../core/settings.js";
import { SFX } from "../helpers/sound.js";
import { audio } from "../systems/audio.js";
import { input } from "../systems/input.js";
import { collideAt, moveX, moveY } from "../systems/physics.js";
import { Entity } from "./entity.js";

const SHEET_RED = "./assets/player3.png";
const SHEET_BLUE = "./assets/generated/sprites/player_blue.png";
const SHEET_WHITE = "./assets/generated/sprites/player_white.png";
const TRAIL_RED = "./assets/generated/sprites/player_trail_red.png";
const TRAIL_BLUE = "./assets/generated/sprites/player_trail_blue.png";
const MADELINE = "assets/soundTrack/all_sounds/Madeline/";

const HITBOX = { offsetX: 21, offsetY: 19, w: 24, h: 42 };

/**
 * Player controller states.
 *
 * @readonly
 * @enum {string}
 */
export const PlayerState = Object.freeze({
    NORMAL: "normal",
    CLIMB: "climb",
    DASH: "dash",
    BOOST: "boost",
    DEAD: "dead"
});

/**
 * Sound families for each surface material.
 *
 * @type {Record<string, { foot: string, land: string, grab: string }>}
 */
const SURFACE_SOUNDS = {
    snow: { foot: "foot_04_snow", land: "land_04_snow", grab: "grab_04_snow" },
    dirt: { foot: "foot_00_dirt", land: "land_00_dirt", grab: "grab_00_dirt" },
    ice: { foot: "foot_09_ice", land: "land_09_ice", grab: "grab_09_ice" },
    wood: { foot: "foot_03_wood", land: "land_03_wood", grab: "grab_03_wood" },
    linens: { foot: "foot_03_linens", land: "land_03_linens", grab: "grab_03_linens" },
    metal: { foot: "foot_01_metalgirder", land: "land_01_metalgirder", grab: "grab_01_metalgirder" }
};

/**
 * Moves a value towards a target by at most a given amount.
 *
 * @param {number} value - Current value.
 * @param {number} target - Target value.
 * @param {number} amount - Maximum change.
 * @returns {number} The new value.
 */
function approach(value, target, amount) {
    return value < target ? Math.min(value + amount, target) : Math.max(value - amount, target);
}

/**
 * Madeline: a Celeste-style platforming controller with coyote time, jump
 * buffering, variable jumps, wall jumps, stamina-limited climbing, an eight
 * direction dash with super jumps, squash and stretch and death and respawn.
 */
export class Player extends Entity {
    /** @type {{ x: number, y: number, w: number, h: number, remX: number, remY: number, isRiding: Function, squish: Function }} */
    box;
    /** @type {{ x: number, y: number }} */
    velocity = { x: 0, y: 0 };
    /** @type {string} */
    state = PlayerState.NORMAL;
    /** @type {boolean} */
    onGround = false;
    /** @type {number} */
    dashes = 1;
    /** @type {number} */
    maxDashes = 1;
    /** @type {number} */
    stamina = P.maxStamina;
    /** @type {boolean} */
    controlLocked = false;
    /** @type {{ x: number, jump: boolean, jumpHeld: boolean }} */
    script = { x: 0, jump: false, jumpHeld: false };
    /** @type {{ x: number, speed: number, resolve: Function }|null} */
    #walk = null;
    /** @type {string|null} */
    forcedAnimation = null;
    /** @type {Set<*>} */
    #triggers = new Set();
    /** @type {number} */
    lives = 3;
    /** @type {boolean} */
    noControl = false;
    /** @type {boolean} */
    dashEnabled = true;

    #jumpGrace = 0;
    #varJumpTimer = 0;
    #varJumpSpeed = 0;
    #forceMoveX = 0;
    #forceMoveTimer = 0;
    #dashCooldown = 0;
    #dashRefillCooldown = 0;
    #dashTimer = 0;
    #dashDir = { x: 0, y: 0 };
    #dashTrailTimer = 0;
    #dashStartedOnGround = false;
    #flashTimer = 0;
    #sheet = "";
    #wasOnGround = false;
    #lastFootFrame = -1;
    #idleTime = 0;
    #deathTimer = 0;
    #boostTimer = 0;
    #boostTarget = null;
    #climbSoundTimer = 0;
    #tiredBlink = 0;
    #wallSlideSound = null;
    #surface = "snow";
    #respawnTimer = 0;

    /**
     * @param {{ x: number, y: number }} [spawn] - Feet position to spawn at.
     */
    constructor(spawn = { x: 100, y: 300 }) {
        super({ x: 0, y: 0 }, { width: 64, height: 64 }, "player");
        this.elem.classList.add("player");
        this.elem.style.transformOrigin = "33px 61px";
        this.layer = "entities";
        this.setSpriteSheet(SHEET_RED, { frameWidth: 64, frameHeight: 64 });
        this.#sheet = SHEET_RED;
        this.components.movement = { direction: 1, speed: P.maxRun };
        const player = this;
        this.box = {
            x: 0, y: 0, w: HITBOX.w, h: HITBOX.h, remX: 0, remY: 0,
            isRiding(solid) {
                const horizontal = this.x < solid.x + solid.w && this.x + this.w > solid.x;
                const vertical = this.y < solid.y + solid.h && this.y + this.h > solid.y;
                if (horizontal && this.y + this.h === solid.y) return true;
                if (player.state === PlayerState.CLIMB && vertical) {
                    const facing = player.components.movement.direction;
                    return facing > 0 ? this.x + this.w === solid.x : this.x === solid.x + solid.w;
                }
                return false;
            },
            squish() {
                player.die(0, 0);
            }
        };
        this.#registerAnimations();
        this.place(spawn.x, spawn.y);
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Registers every animation clip of the Madeline sheet.
     *
     * @returns {void}
     */
    #registerAnimations() {
        const clips = {
            idle: { row: 11, startFrame: 4, frameCount: 6, fps: 6 },
            idleFidget: { row: 14, startFrame: 0, frameCount: 8, fps: 8, loop: false, next: "idle" },
            run: { row: 0, startFrame: 0, frameCount: 9, fps: 14 },
            walk: { row: 3, startFrame: 0, frameCount: 8, fps: 10 },
            push: { row: 7, startFrame: 10, frameCount: 5, fps: 8 },
            lookUp: { row: 1, frames: [3, 4], startFrame: 3, frameCount: 2, fps: 6, loop: false },
            duck: { row: 1, startFrame: 0, frameCount: 1, fps: 1 },
            jumpFast: { row: 9, startFrame: 0, frameCount: 1, fps: 1 },
            jumpSlow: { row: 9, startFrame: 1, frameCount: 1, fps: 1 },
            fallSlow: { row: 9, startFrame: 2, frameCount: 2, fps: 10, loop: false },
            fall: { row: 9, startFrame: 4, frameCount: 8, fps: 12 },
            climb: { row: 3, startFrame: 8, frameCount: 4, fps: 10 },
            wallSlide: { row: 3, startFrame: 8, frameCount: 1, fps: 1 },
            dash: { row: 0, startFrame: 10, frameCount: 2, fps: 16 },
            dashUp: { row: 4, startFrame: 7, frameCount: 1, fps: 1 },
            dashDiagUp: { row: 6, startFrame: 9, frameCount: 1, fps: 1 },
            dashDown: { row: 9, startFrame: 3, frameCount: 1, fps: 1 },
            tumble: { row: 2, startFrame: 0, frameCount: 4, fps: 16 },
            talk: { row: 8, startFrame: 0, frameCount: 2, fps: 8 },
            sit: { row: 8, startFrame: 8, frameCount: 1, fps: 8 },
            sitDown: { row: 8, startFrame: 7, frameCount: 3, fps: 8, loop: false, next: "sit" },
            front: { row: 5, startFrame: 6, frameCount: 6, fps: 6 },
            back: { row: 5, startFrame: 0, frameCount: 6, fps: 6 },
            dead: { row: 2, startFrame: 0, frameCount: 4, fps: 18 }
        };
        for (const [name, data] of Object.entries(clips)) {
            addAnimation(this, name, data);
        }
        playAnimation(this, "idle");
    }

    /**
     * Places the player with its feet at a world position and resets motion.
     *
     * @param {number} x - Horizontal center of the feet.
     * @param {number} y - Ground level under the feet.
     * @returns {void}
     */
    place(x, y) {
        this.box.x = Math.round(x - HITBOX.w / 2);
        this.box.y = Math.round(y - HITBOX.h);
        this.box.remX = 0;
        this.box.remY = 0;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.#syncSprite();
        this.snap();
    }

    /**
     * Copies the hitbox position into the sprite position.
     *
     * @returns {void}
     */
    #syncSprite() {
        this.position.x = this.box.x - HITBOX.offsetX;
        this.position.y = this.box.y - HITBOX.offsetY;
    }

    /**
     * Point the camera centers on.
     *
     * @returns {{ x: number, y: number }} World position.
     */
    cameraFocus() {
        return { x: this.box.x + this.box.w / 2, y: this.box.y + this.box.h / 2 - 20 };
    }

    /**
     * Horizontal input, replaced by scripted input during cutscenes.
     *
     * @returns {number} -1, 0 or 1.
     */
    #inputX() {
        if (this.controlLocked) return this.script.x;
        return input.axisX();
    }

    /**
     * Vertical input.
     *
     * @returns {number} -1, 0 or 1.
     */
    #inputY() {
        if (this.controlLocked) return 0;
        return input.axisY();
    }

    /**
     * Whether the jump button is held.
     *
     * @returns {boolean} True while held.
     */
    #jumpHeld() {
        if (this.controlLocked) return this.script.jumpHeld;
        return input.isDown("jump");
    }

    /**
     * Whether a buffered jump press is available.
     *
     * @returns {boolean} True when a jump should happen.
     */
    #jumpPressed() {
        if (this.controlLocked) return this.script.jump;
        return input.pressedWithin("jump", P.jumpBuffer);
    }

    /**
     * Consumes the buffered jump press.
     *
     * @returns {void}
     */
    #consumeJump() {
        this.script.jump = false;
        input.consume("jump");
    }

    /**
     * Whether the climb input is active towards a given side.
     *
     * @param {number} side - Wall side, -1 or 1.
     * @returns {boolean} True when the player wants to hold the wall.
     */
    #wantsGrab(side) {
        if (this.controlLocked) return false;
        if (input.isDown("grab")) return true;
        return settings.autoClimb && this.#inputX() === side;
    }

    /**
     * Returns the solid touching the player on one side, if climbable.
     *
     * @param {number} side - -1 for left, 1 for right.
     * @param {number} [distance=1] - How far to probe.
     * @returns {import("../systems/physics.js").Body|null} The wall, if any.
     */
    #wallAt(side, distance = 1) {
        const world = game.level.world;
        for (let d = 1; d <= distance; d++) {
            const hit = collideAt(world, this.box, side * d, 0);
            if (hit) return hit.climbable === false ? null : hit;
        }
        return null;
    }

    /**
     * Runs one fixed simulation step.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        if (!game.level) return;
        if (this.state === PlayerState.DEAD) {
            this.#updateDead(dt);
            return;
        }
        if (this.#walk) this.#updateWalk();
        this.#dashCooldown = Math.max(0, this.#dashCooldown - dt);
        this.#dashRefillCooldown = Math.max(0, this.#dashRefillCooldown - dt);
        this.#forceMoveTimer = Math.max(0, this.#forceMoveTimer - dt);
        this.#varJumpTimer = Math.max(0, this.#varJumpTimer - dt);
        this.#flashTimer = Math.max(0, this.#flashTimer - dt);
        this.#respawnTimer = Math.max(0, this.#respawnTimer - dt);

        const world = game.level.world;
        const ground = collideAt(world, this.box, 0, 1);
        this.onGround = Boolean(ground) && this.velocity.y >= 0;
        if (ground) this.#surface = ground.surface || this.#surface;
        if (this.onGround) {
            this.#jumpGrace = P.coyoteTime;
            if (this.state !== PlayerState.CLIMB) this.stamina = P.maxStamina;
            if (this.#dashRefillCooldown <= 0 && this.state !== PlayerState.DASH) this.refillDash(false);
        } else {
            this.#jumpGrace = Math.max(0, this.#jumpGrace - dt);
        }

        switch (this.state) {
            case PlayerState.DASH:
                this.#updateDash(dt);
                break;
            case PlayerState.CLIMB:
                this.#updateClimb(dt);
                break;
            case PlayerState.BOOST:
                this.#updateBoost(dt);
                break;
            default:
                this.#updateNormal(dt);
        }
        if (this.state === PlayerState.DEAD || !game.level) return;
        this.#move(dt);
        this.#checkHazards();
        this.#checkTriggers();
        this.#checkBounds();
        this.#updateVisuals(dt);
        this.#syncSprite();
        this.#wasOnGround = this.onGround;
    }

    /**
     * Normal state: running, jumping, falling, wall sliding and wall jumps.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    #updateNormal(dt) {
        const moveX = this.#forceMoveTimer > 0 ? this.#forceMoveX : this.#inputX();
        const moveY = this.#inputY();
        const facing = this.components.movement.direction;

        if (this.#tryDash()) return;

        if (!this.controlLocked && this.stamina > 0 && this.velocity.y >= -P.jumpSpeed * 0.5) {
            for (const side of [facing, -facing]) {
                if (this.#wantsGrab(side) && (input.isDown("grab") ? side === facing : true) && this.#wallAt(side)) {
                    if (this.onGround && !input.isDown("grab") && moveY >= 0 && this.#inputX() === side && this.velocity.y >= 0) {
                        if (!this.#canClimbFromGround(side)) continue;
                    }
                    this.#startClimb(side);
                    return;
                }
            }
        }

        const mult = this.onGround ? 1 : P.airMult;
        if (Math.abs(this.velocity.x) > P.maxRun && Math.sign(this.velocity.x) === moveX) {
            this.velocity.x = approach(this.velocity.x, P.maxRun * moveX, P.runReduce * mult * dt);
        } else {
            this.velocity.x = approach(this.velocity.x, P.maxRun * moveX, P.runAccel * mult * dt);
        }
        if (moveX !== 0) this.components.movement.direction = moveX;

        let maxFall = P.maxFall;
        if (moveY > 0 && this.velocity.y >= P.maxFall) {
            maxFall = P.fastMaxFall;
        }
        const wallSide = moveX !== 0 ? this.#wallAt(moveX) : null;
        const sliding = !this.onGround && wallSide && this.velocity.y > 0 && moveY <= 0;
        if (sliding) {
            maxFall = P.wallSlideMax + (this.stamina <= 0 ? P.climbSlipSpeed : 0);
            this.components.movement.direction = moveX;
            if (Math.random() < dt * 30) {
                game.particles?.burst({ x: moveX > 0 ? this.box.x + this.box.w : this.box.x, y: this.box.y + 10, count: 1, color: "rgba(230,240,255,0.8)", size: 3, speed: 30, angle: Math.PI / 2, spread: 0.6, life: 0.3 });
            }
        }
        this.#updateWallSlideSound(Boolean(sliding));

        if (!this.onGround) {
            const half = Math.abs(this.velocity.y) < P.halfGravThreshold && this.#jumpHeld() ? 0.5 : 1;
            if (maxFall > P.maxFall && this.velocity.y >= P.maxFall) {
                this.velocity.y = approach(this.velocity.y, maxFall, P.fastFallAccel * dt);
            } else {
                this.velocity.y = approach(this.velocity.y, maxFall, P.gravity * half * dt);
            }
        }

        if (this.#varJumpTimer > 0) {
            if (this.#jumpHeld()) {
                this.velocity.y = Math.min(this.velocity.y, this.#varJumpSpeed);
            } else {
                this.#varJumpTimer = 0;
            }
        }

        if (this.#jumpPressed()) {
            if (this.#jumpGrace > 0) {
                this.#jump(moveX);
            } else if (this.#wallAt(1, P.wallJumpCheck)) {
                if (input.isDown("grab") && facing === 1 && this.stamina > 0) this.#climbJump();
                else this.#wallJump(-1);
            } else if (this.#wallAt(-1, P.wallJumpCheck)) {
                if (input.isDown("grab") && facing === -1 && this.stamina > 0) this.#climbJump();
                else this.#wallJump(1);
            }
        }
    }

    /**
     * When auto climb is used on the ground, only start climbing walls taller than a step.
     *
     * @param {number} side - Wall side.
     * @returns {boolean} True when the wall continues above the player's head.
     */
    #canClimbFromGround(side) {
        return Boolean(collideAt(game.level.world, this.box, side, -this.box.h + 4));
    }

    /**
     * Starts or stops the looping wall slide sound.
     *
     * @param {boolean} sliding - Whether the player is sliding.
     * @returns {void}
     */
    #updateWallSlideSound(sliding) {
        if (sliding && !this.#wallSlideSound) {
            this.#wallSlideSound = audio.play(SFX.wallslide, { loop: true, volume: 0.35 });
        } else if (!sliding && this.#wallSlideSound) {
            const pending = this.#wallSlideSound;
            this.#wallSlideSound = null;
            pending.then((handle) => handle?.stop(0.08));
        }
    }

    /**
     * Ground jump, including super and hyper jumps out of a dash.
     *
     * @param {number} moveX - Horizontal input.
     * @returns {void}
     */
    #jump(moveX) {
        this.#consumeJump();
        this.#jumpGrace = 0;
        this.#varJumpTimer = P.varJumpTime;
        this.velocity.x += P.jumpHBoost * moveX;
        this.velocity.y = -P.jumpSpeed;
        this.#varJumpSpeed = this.velocity.y;
        this.visual.scaleX = 0.7;
        this.visual.scaleY = 1.3;
        game.particles?.dust(this.box.x + this.box.w / 2, this.box.y + this.box.h, 1, this.#dustColor());
        audio.play(SFX.jump, { volume: 0.55 });
        const surface = SURFACE_SOUNDS[this.#surface];
        if (surface) audio.playVariant(MADELINE + surface.foot, 7, { volume: 0.4 });
        events.emit("player:jump");
    }

    /**
     * Super jump: a ground jump during a horizontal dash keeps a large horizontal speed.
     *
     * @returns {void}
     */
    #superJump() {
        this.#consumeJump();
        this.#jumpGrace = 0;
        this.#varJumpTimer = P.varJumpTime;
        const facing = this.components.movement.direction;
        const hyper = this.#dashDir.y > 0;
        this.velocity.x = P.superJumpH * facing * (hyper ? P.duckSuperJumpX : 1);
        this.velocity.y = -P.jumpSpeed * (hyper ? P.duckSuperJumpY : 1);
        this.#varJumpSpeed = this.velocity.y;
        this.state = PlayerState.NORMAL;
        this.visual.scaleX = 0.6;
        this.visual.scaleY = 1.4;
        game.particles?.dust(this.box.x + this.box.w / 2, this.box.y + this.box.h, 1.5, this.#dustColor());
        audio.play(SFX.superJump, { volume: 0.6 });
    }

    /**
     * Jump away from a wall with a short period of forced horizontal movement.
     *
     * @param {number} dir - Direction to jump towards, -1 or 1.
     * @returns {void}
     */
    #wallJump(dir) {
        this.#consumeJump();
        this.#varJumpTimer = P.varJumpTime;
        if (this.#inputX() !== 0) {
            this.#forceMoveX = dir;
            this.#forceMoveTimer = P.wallJumpForceTime;
        }
        this.velocity.x = P.wallJumpHSpeed * dir;
        this.velocity.y = -P.jumpSpeed;
        this.#varJumpSpeed = this.velocity.y;
        this.components.movement.direction = dir;
        this.state = PlayerState.NORMAL;
        this.visual.scaleX = 0.7;
        this.visual.scaleY = 1.3;
        const wallX = dir > 0 ? this.box.x : this.box.x + this.box.w;
        game.particles?.burst({ x: wallX, y: this.box.y + this.box.h - 6, count: 5, color: this.#dustColor(), size: 5, speed: 90, angle: dir > 0 ? 0 : Math.PI, spread: 1.2, life: 0.35, drag: 5 });
        audio.play(dir > 0 ? SFX.wallJumpRight : SFX.wallJumpLeft, { volume: 0.55 });
    }

    /**
     * Straight up jump while holding a wall, costing stamina.
     *
     * @returns {void}
     */
    #climbJump() {
        this.stamina -= P.climbJumpCost;
        this.#consumeJump();
        this.#varJumpTimer = P.varJumpTime;
        this.velocity.y = -P.jumpSpeed;
        this.#varJumpSpeed = this.velocity.y;
        this.velocity.x = 0;
        this.state = PlayerState.NORMAL;
        this.visual.scaleX = 0.7;
        this.visual.scaleY = 1.3;
        audio.play(SFX.jump, { volume: 0.5 });
    }

    /**
     * Enters the climbing state on a wall.
     *
     * @param {number} side - Wall side.
     * @returns {void}
     */
    #startClimb(side) {
        this.state = PlayerState.CLIMB;
        this.components.movement.direction = side;
        this.velocity.x = 0;
        this.velocity.y *= 0.2;
        this.#updateWallSlideSound(false);
        const surface = SURFACE_SOUNDS[this.#wallAt(side)?.surface || this.#surface];
        if (surface) audio.playVariant(MADELINE + surface.grab, 5, { volume: 0.45 });
    }

    /**
     * Climbing state: move along the wall, spend stamina and hop over ledges.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    #updateClimb(dt) {
        const side = this.components.movement.direction;
        if (this.#tryDash()) return;
        if (this.#jumpPressed()) {
            if (this.#inputX() === -side) this.#wallJump(-side);
            else if (this.stamina > 0) this.#climbJump();
            else this.#wallJump(-side);
            return;
        }
        const wall = this.#wallAt(side);
        if (!this.#wantsGrab(side) || !wall) {
            if (!wall && this.velocity.y < 0) this.#climbHop(side);
            this.state = PlayerState.NORMAL;
            return;
        }
        const usingGrab = input.isDown("grab");
        const moveY = this.#inputY();
        let target = 0;
        if (moveY < 0 || (!usingGrab && moveY === 0)) target = -P.climbUpSpeed;
        else if (moveY > 0) target = P.climbDownSpeed;
        if (this.stamina <= 0) {
            target = P.climbSlipSpeed;
        } else if (target < 0) {
            const handAbove = collideAt(game.level.world, this.box, side, -6);
            if (!handAbove) {
                this.#climbHop(side);
                this.state = PlayerState.NORMAL;
                return;
            }
            this.stamina -= P.climbUpCost * dt;
        } else if (target === 0) {
            this.stamina -= P.climbStillCost * dt;
        }
        this.velocity.x = 0;
        this.velocity.y = approach(this.velocity.y, target, P.climbAccel * dt);
        if (this.onGround && target > 0) {
            this.state = PlayerState.NORMAL;
        }
        this.#climbSoundTimer -= dt;
        if (target < 0 && this.#climbSoundTimer <= 0) {
            this.#climbSoundTimer = 0.3;
            const surface = SURFACE_SOUNDS[wall.surface || this.#surface];
            if (surface) audio.playVariant(`${MADELINE}handhold_${surface.grab.slice(5)}`, 5, { volume: 0.3 });
        }
    }

    /**
     * Small hop over the top of a wall when climbing past its edge.
     *
     * @param {number} side - Wall side.
     * @returns {void}
     */
    #climbHop(side) {
        this.velocity.y = Math.min(this.velocity.y, -120 * 4 * 0.75);
        this.velocity.x = side * 100 * 2;
        this.#forceMoveX = side;
        this.#forceMoveTimer = 0.18;
        audio.playVariant(`${MADELINE}climb_ledge`, 5, { volume: 0.45 });
    }

    /**
     * Starts a dash when the button was pressed and a dash is available.
     *
     * @returns {boolean} True when a dash started.
     */
    #tryDash() {
        if (this.controlLocked || !this.dashEnabled) return false;
        if (!input.pressedWithin("dash", 0.08) || this.dashes <= 0 || this.#dashCooldown > 0) return false;
        input.consume("dash");
        this.#startDash();
        return true;
    }

    /**
     * Begins a dash in the held direction, or the facing direction without input.
     *
     * @returns {void}
     */
    #startDash() {
        this.dashes--;
        this.#dashCooldown = P.dashCooldown;
        this.#dashRefillCooldown = P.dashRefillCooldown;
        this.#dashTimer = P.dashTime;
        this.#dashTrailTimer = 0;
        this.#dashStartedOnGround = this.onGround;
        let dx = this.#inputX();
        let dy = this.#inputY();
        if (dx === 0 && dy === 0) dx = this.components.movement.direction;
        const length = Math.hypot(dx, dy);
        this.#dashDir = { x: dx / length, y: dy / length };
        const speedX = this.#dashDir.x * P.dashSpeed;
        const keepX = Math.sign(this.velocity.x) === Math.sign(speedX) && Math.abs(this.velocity.x) > Math.abs(speedX);
        this.velocity.x = keepX ? this.velocity.x : speedX;
        this.velocity.y = this.#dashDir.y * P.dashSpeed;
        if (dx !== 0) this.components.movement.direction = Math.sign(dx);
        this.state = PlayerState.DASH;
        this.#varJumpTimer = 0;
        this.#updateWallSlideSound(false);
        if (Math.abs(this.#dashDir.x) > 0.1 && Math.abs(this.#dashDir.y) < 0.1) {
            this.visual.scaleX = 1.4;
            this.visual.scaleY = 0.7;
        } else if (Math.abs(this.#dashDir.x) < 0.1) {
            this.visual.scaleX = 0.7;
            this.visual.scaleY = 1.4;
        } else {
            this.visual.scaleX = 1.15;
            this.visual.scaleY = 0.85;
        }
        game.hitStop(P.dashFreeze);
        game.camera?.shake(3, 0.12);
        const cx = this.box.x + this.box.w / 2;
        const cy = this.box.y + this.box.h / 2;
        game.particles?.burst({ x: cx, y: cy, count: 10, color: "#ff8fa0", size: 4, speed: 160, angle: Math.atan2(-this.#dashDir.y, -this.#dashDir.x), spread: 1.6, life: 0.35, drag: 6 });
        audio.play(this.#dashDir.x < 0 ? SFX.dashLeft : SFX.dashRight, { volume: 0.6 });
        this.#updateHairSheet();
        events.emit("player:dash", { dir: this.#dashDir });
    }

    /**
     * Dash state: constant velocity, trails and the transition back to normal.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    #updateDash(dt) {
        this.#dashTimer -= dt;
        this.#dashTrailTimer -= dt;
        if (this.#dashTrailTimer <= 0) {
            this.#dashTrailTimer = 0.025;
            game.afterimages?.spawn(this, this.dashes > 0 ? TRAIL_RED : TRAIL_BLUE, 0.28);
        }
        if (Math.random() < 0.6) {
            game.particles?.burst({ x: this.box.x + this.box.w / 2, y: this.box.y + this.box.h / 2, count: 1, color: this.dashes > 0 ? "#ff6f7f" : "#7fd0ff", size: 3, speed: 30, life: 0.3, jitter: 10 });
        }
        if (this.#jumpPressed() && Math.abs(this.#dashDir.x) > 0.1 && this.#dashDir.y >= 0 && (this.onGround || this.#jumpGrace > 0)) {
            this.#superJump();
            return;
        }
        if (this.#jumpPressed() && !this.onGround) {
            if (this.#wallAt(1, P.wallJumpCheck) && this.#dashDir.y < 0 && Math.abs(this.#dashDir.x) < 0.1) {
                this.#wallJump(-1);
                return;
            }
            if (this.#wallAt(-1, P.wallJumpCheck) && this.#dashDir.y < 0 && Math.abs(this.#dashDir.x) < 0.1) {
                this.#wallJump(1);
                return;
            }
        }
        if (this.#dashTimer <= 0) {
            this.state = PlayerState.NORMAL;
            if (this.#dashDir.y <= 0) {
                this.velocity.x = this.#dashDir.x * P.endDashSpeed;
                this.velocity.y = this.#dashDir.y * P.endDashSpeed;
                if (this.velocity.y < 0) this.velocity.y *= P.endDashUpMult;
            }
        }
    }

    /**
     * Applies velocity with collision, corner correction and landing handling.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    #move(dt) {
        const world = game.level.world;
        moveX(world, this.box, this.velocity.x * dt, (solid) => this.#onCollideX(solid));
        moveY(world, this.box, this.velocity.y * dt, (solid) => this.#onCollideY(solid));
    }

    /**
     * Horizontal collision response with dash corner correction.
     *
     * @param {import("../systems/physics.js").Body} solid - The blocking solid.
     * @returns {void}
     */
    #onCollideX(solid) {
        const world = game.level.world;
        if (this.state === PlayerState.DASH && this.#dashDir.y >= 0) {
            const dir = Math.sign(this.velocity.x);
            for (let i = 1; i <= P.cornerCorrection; i++) {
                for (const sign of [-1, 1]) {
                    if (!collideAt(world, this.box, dir, i * sign)) {
                        this.box.y += i * sign;
                        this.box.x += dir;
                        return;
                    }
                }
            }
        }
        solid.onTouch?.(this, "side");
        this.velocity.x = 0;
        if (this.state === PlayerState.DASH) this.#dashDir.x = 0;
    }

    /**
     * Vertical collision response: landing feedback and upward corner correction.
     *
     * @param {import("../systems/physics.js").Body} solid - The blocking solid.
     * @returns {void}
     */
    #onCollideY(solid) {
        const world = game.level.world;
        if (this.velocity.y < 0) {
            const limit = this.state === PlayerState.DASH ? P.cornerCorrection * 1.5 : P.cornerCorrection;
            for (let i = 1; i <= limit; i++) {
                for (const sign of this.velocity.x <= 0 ? [-1, 1] : [1, -1]) {
                    if (!collideAt(world, this.box, i * sign, -1)) {
                        this.box.x += i * sign;
                        this.box.y -= 1;
                        return;
                    }
                }
            }
            solid.onTouch?.(this, "bottom");
            this.velocity.y = 0;
            this.#varJumpTimer = 0;
            if (this.state === PlayerState.DASH) this.#dashDir.y = 0;
            return;
        }
        if (this.velocity.y > 0) {
            this.#land(this.velocity.y, solid);
        }
        solid.onTouch?.(this, "top");
        this.velocity.y = 0;
        if (this.state === PlayerState.DASH && this.#dashDir.y > 0 && Math.abs(this.#dashDir.x) < 0.1) {
            this.#dashTimer = 0;
        }
    }

    /**
     * Landing feedback scaled by impact speed.
     *
     * @param {number} speed - Downward speed at impact.
     * @param {import("../systems/physics.js").Body} solid - Ground body.
     * @returns {void}
     */
    #land(speed, solid) {
        if (this.#wasOnGround) return;
        const impact = Math.min(1, speed / P.fastMaxFall);
        if (impact < 0.15) return;
        this.visual.scaleX = 1 + 0.45 * impact;
        this.visual.scaleY = 1 - 0.4 * impact;
        this.#surface = solid.surface || this.#surface;
        game.particles?.dust(this.box.x + this.box.w / 2, this.box.y + this.box.h, 0.6 + impact, this.#dustColor());
        const surface = SURFACE_SOUNDS[this.#surface];
        if (surface) audio.playVariant(MADELINE + surface.land, 5, { volume: 0.35 + impact * 0.4 });
        if (impact > 0.85) game.camera?.shake(2, 0.1);
    }

    /**
     * Dust colour matching the surface underfoot.
     *
     * @returns {string} CSS colour.
     */
    #dustColor() {
        return { dirt: "rgba(176,128,84,0.85)", wood: "rgba(180,140,110,0.8)", linens: "rgba(200,170,190,0.7)", metal: "rgba(200,210,230,0.7)" }[this.#surface] || "rgba(235,242,255,0.9)";
    }

    /**
     * Kills the player when touching spikes or other hazards.
     *
     * @returns {void}
     */
    #checkHazards() {
        const box = this.box;
        const v = this.velocity;
        game.level.world.each(box.x + 2, box.y + 2, box.w - 4, box.h - 4, "hazard", (hazard) => {
            const dir = hazard.direction || "any";
            const deadly = dir === "any" ||
                (dir === "up" && v.y >= 0) ||
                (dir === "down" && v.y <= 0) ||
                (dir === "left" && v.x >= 0) ||
                (dir === "right" && v.x <= 0);
            if (deadly) {
                this.die(-Math.sign(v.x) || 0, dir === "up" ? -1 : dir === "down" ? 1 : 0);
                return true;
            }
            return false;
        });
    }

    /**
     * Fires enter and exit callbacks on trigger bodies.
     *
     * @returns {void}
     */
    #checkTriggers() {
        const inside = new Set();
        game.level.world.each(this.box.x, this.box.y, this.box.w, this.box.h, "trigger", (trigger) => {
            inside.add(trigger);
            if (!this.#triggers.has(trigger)) trigger.onEnter?.(this, trigger);
            trigger.onStay?.(this, trigger);
            return false;
        });
        for (const trigger of this.#triggers) {
            if (!inside.has(trigger)) trigger.onExit?.(this, trigger);
        }
        this.#triggers = inside;
    }

    /**
     * Kills the player after falling out of the level.
     *
     * @returns {void}
     */
    #checkBounds() {
        const killY = game.level.killY ?? Infinity;
        if (this.box.y > killY) this.die(0, -1);
    }

    /**
     * Restores the dash.
     *
     * @param {boolean} [flash=true] - Whether to flash white as feedback.
     * @returns {boolean} True when a dash was restored.
     */
    refillDash(flash = true) {
        const before = this.dashes;
        this.dashes = this.maxDashes;
        if (before < this.maxDashes) {
            this.#flashTimer = flash ? 0.12 : 0.05;
            this.#updateHairSheet();
            return true;
        }
        return false;
    }

    /**
     * Refills stamina, used by dash crystals.
     *
     * @returns {void}
     */
    refillStamina() {
        this.stamina = P.maxStamina;
    }

    /**
     * Enters a booster bubble that launches the player in the held direction.
     *
     * @param {{ x: number, y: number }} center - Bubble center.
     * @returns {void}
     */
    enterBooster(center) {
        if (this.state === PlayerState.BOOST || this.state === PlayerState.DEAD) return;
        this.state = PlayerState.BOOST;
        this.#boostTimer = 0.25;
        this.#boostTarget = center;
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.refillDash(true);
        this.refillStamina();
    }

    /**
     * Booster state: hold still inside the bubble, then dash out.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    #updateBoost(dt) {
        this.#boostTimer -= dt;
        const target = this.#boostTarget;
        this.box.x += Math.round((target.x - this.box.w / 2 - this.box.x) * 0.4);
        this.box.y += Math.round((target.y - this.box.h / 2 - this.box.y) * 0.4);
        this.velocity.x = 0;
        this.velocity.y = 0;
        if (this.#boostTimer <= 0 || input.pressedWithin("dash", 0.08)) {
            input.consume("dash");
            this.dashes = Math.max(1, this.dashes);
            this.#startDash();
            this.dashes = this.maxDashes;
            this.#dashTimer = P.dashTime * 1.6;
            this.#updateHairSheet();
        }
    }

    /**
     * Kills the player.
     *
     * @param {number} [dirX=0] - Horizontal knock-back direction.
     * @param {number} [dirY=0] - Vertical knock-back direction.
     * @returns {void}
     */
    die(dirX = 0, dirY = 0) {
        if (this.state === PlayerState.DEAD || this.#respawnTimer > 0 || game.invincible) return;
        this.state = PlayerState.DEAD;
        this.alive = false;
        this.#deathTimer = 0;
        this.velocity.x = (dirX || -this.components.movement.direction) * 160;
        this.velocity.y = (dirY || -1) * 160;
        this.#walk = null;
        this.#updateWallSlideSound(false);
        playAnimation(this, "dead");
        game.hitStop(0.08);
        game.camera?.shake(6, 0.25);
        audio.play(SFX.predeath, { volume: 0.6 });
        events.emit("player:death");
    }

    /**
     * Dead state: knock-back, then a burst of hair-coloured orbs.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    #updateDead(dt) {
        this.#deathTimer += dt;
        if (this.#deathTimer < 0.22) {
            this.velocity.x = approach(this.velocity.x, 0, 900 * dt);
            this.velocity.y = approach(this.velocity.y, 0, 900 * dt);
            this.box.x += this.velocity.x * dt;
            this.box.y += this.velocity.y * dt;
            this.visual.scaleX = approach(this.visual.scaleX, 1, 2 * dt);
            this.visual.scaleY = approach(this.visual.scaleY, 1, 2 * dt);
            this.#syncSprite();
            return;
        }
        if (this.visible) {
            this.visible = false;
            const cx = this.box.x + this.box.w / 2;
            const cy = this.box.y + this.box.h / 2;
            const color = this.dashes > 0 ? "#d83b4a" : "#44b7ff";
            for (let i = 0; i < 8; i++) {
                const angle = (Math.PI * 2 * i) / 8;
                game.particles?.burst({ x: cx, y: cy, count: 1, color, size: 10, speed: 260, angle, spread: 0, life: 0.5, drag: 4, jitter: 0, shrink: true });
            }
            game.particles?.burst({ x: cx, y: cy, count: 12, color: "#fff", size: 4, speed: 200, life: 0.4, drag: 5 });
            audio.play(SFX.death, { volume: 0.7 });
            game.flash(0.35, 0.2);
            events.emit("player:burst");
        }
    }

    /**
     * Brings the player back at a spawn point with a short invulnerability window.
     *
     * @param {number} x - Feet x.
     * @param {number} y - Feet y.
     * @returns {void}
     */
    respawn(x, y) {
        this.place(x, y);
        this.state = PlayerState.NORMAL;
        this.alive = true;
        this.visible = true;
        this.dashes = this.maxDashes;
        this.stamina = P.maxStamina;
        this.visual.scaleX = 0.4;
        this.visual.scaleY = 1.6;
        this.visual.opacity = 1;
        this.#respawnTimer = 0.25;
        this.#forceMoveTimer = 0;
        this.#varJumpTimer = 0;
        this.#triggers.clear();
        input.consume("jump");
        input.consume("dash");
        this.#updateHairSheet();
        playAnimation(this, "idle");
        const cx = this.box.x + this.box.w / 2;
        const cy = this.box.y + this.box.h / 2;
        game.particles?.burst({ x: cx, y: cy, count: 10, color: "#ffffff", size: 5, speed: 140, life: 0.35, drag: 6 });
        audio.play(SFX.revive, { volume: 0.55 });
    }

    /**
     * Walks to an x position under script control.
     *
     * @param {number} x - Target feet x.
     * @param {number} [speedFactor=0.6] - Fraction of running speed.
     * @returns {Promise<void>} Resolves on arrival.
     */
    walkTo(x, speedFactor = 0.6) {
        return new Promise((resolve) => {
            this.#walk = { x, speed: speedFactor, resolve };
        });
    }

    /**
     * Steers scripted walking.
     *
     * @returns {void}
     */
    #updateWalk() {
        const walk = this.#walk;
        const center = this.box.x + this.box.w / 2;
        const distance = walk.x - center;
        if (Math.abs(distance) <= 3) {
            this.script.x = 0;
            this.velocity.x = 0;
            this.#walk = null;
            walk.resolve();
            return;
        }
        this.script.x = Math.sign(distance);
        if (Math.abs(this.velocity.x) > P.maxRun * walk.speed) {
            this.velocity.x = Math.sign(this.velocity.x) * P.maxRun * walk.speed;
        }
    }

    /**
     * Chooses the sheet matching the remaining dashes and refill flash.
     *
     * @returns {void}
     */
    #updateHairSheet() {
        const sheet = this.#flashTimer > 0 ? SHEET_WHITE : this.dashes > 0 ? SHEET_RED : SHEET_BLUE;
        if (sheet !== this.#sheet) {
            this.#sheet = sheet;
            this.elem.style.backgroundImage = `url("${sheet}")`;
        }
    }

    /**
     * Updates squash and stretch, animation selection, footsteps and tint.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    #updateVisuals(dt) {
        this.visual.scaleX = approach(this.visual.scaleX, 1, 1.75 * dt);
        this.visual.scaleY = approach(this.visual.scaleY, 1, 1.75 * dt);
        this.#updateHairSheet();
        this.#selectAnimation(dt);
        this.#footsteps();
        const tired = this.state === PlayerState.CLIMB && this.stamina < 20;
        this.#tiredBlink = tired ? this.#tiredBlink + dt : 0;
        const blink = tired && Math.floor(this.#tiredBlink * 10) % 2 === 0;
        this.elem.classList.toggle("tired", blink);
    }

    /**
     * Picks the animation clip for the current state.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    #selectAnimation(dt) {
        if (this.forcedAnimation) {
            playAnimation(this, this.forcedAnimation);
            return;
        }
        const v = this.velocity;
        let clip = "idle";
        if (this.state === PlayerState.DASH || this.state === PlayerState.BOOST) {
            const d = this.#dashDir;
            if (Math.abs(d.x) < 0.1) clip = d.y < 0 ? "dashUp" : "dashDown";
            else if (d.y < -0.1) clip = "dashDiagUp";
            else clip = "dash";
        } else if (this.state === PlayerState.CLIMB) {
            clip = Math.abs(v.y) > 10 && v.y < 0 ? "climb" : "wallSlide";
        } else if (!this.onGround) {
            const moveX = this.#inputX();
            if (moveX !== 0 && v.y > 0 && this.#wallAt(moveX)) clip = "wallSlide";
            else if (v.y < -P.jumpSpeed * 0.6) clip = "jumpFast";
            else if (v.y < 0) clip = "jumpSlow";
            else if (v.y < P.maxFall * 0.5) clip = "fallSlow";
            else clip = "fall";
        } else {
            const moveX = this.#inputX();
            if (moveX !== 0 && this.#wallAt(moveX)) clip = "push";
            else if (Math.abs(v.x) > P.maxRun * 0.75) clip = "run";
            else if (Math.abs(v.x) > 10) clip = "walk";
            else if (this.#inputY() > 0 && !this.controlLocked) clip = "duck";
            else if (this.#inputY() < 0 && !this.controlLocked) clip = "lookUp";
            else clip = "idle";
        }
        if (clip === "idle") {
            this.#idleTime += dt;
            const current = this.components.animation.state.sprite;
            if (this.#idleTime > 5 && current === "idle") {
                this.#idleTime = 0;
                playAnimation(this, "idleFidget");
                return;
            }
            if (current === "idleFidget") return;
        } else {
            this.#idleTime = 0;
        }
        playAnimation(this, clip);
    }

    /**
     * Plays footstep sounds on contact frames of the run cycle.
     *
     * @returns {void}
     */
    #footsteps() {
        const state = this.components.animation.state;
        if (!this.onGround || (state.sprite !== "run" && state.sprite !== "walk")) {
            this.#lastFootFrame = -1;
            return;
        }
        if (state.frame !== this.#lastFootFrame && (state.frame === 2 || state.frame === 6)) {
            const surface = SURFACE_SOUNDS[this.#surface];
            if (surface) audio.playVariant(MADELINE + surface.foot, 7, { volume: 0.22 });
            if (state.sprite === "run" && Math.random() < 0.5) {
                game.particles?.burst({ x: this.box.x + this.box.w / 2, y: this.box.y + this.box.h - 2, count: 1, color: this.#dustColor(), size: 4, speed: 40, angle: -Math.PI / 2, spread: 1.2, life: 0.25, gravity: 100 });
            }
        }
        this.#lastFootFrame = state.frame;
    }

    /**
     * Current motion used by the camera for look-ahead.
     *
     * @returns {{ x: number, y: number }} Velocity in pixels per second.
     */
    get cameraVelocity() {
        return this.velocity;
    }
}

/**
 * Creates the player. Kept for compatibility with the original factory.
 *
 * @param {{ x: number, y: number }} [spawnPosition] - Feet position.
 * @returns {Player} The new player.
 */
export function createPlayer(spawnPosition = { x: 100, y: 300 }) {
    return new Player(spawnPosition);
}
