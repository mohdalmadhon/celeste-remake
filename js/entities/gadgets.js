import { addAnimation, playAnimation } from "../components/animation.js";
import { PLAYER_PHYSICS as P, TILE } from "../core/constants.js";
import { game } from "../core/game.js";
import { SFX } from "../helpers/sound.js";
import { audio } from "../systems/audio.js";
import { createBody, moveSolid, overlaps } from "../systems/physics.js";
import { Entity } from "./entity.js";
import { PlayerState } from "./player.js";

const SPRITES = "./assets/generated/sprites/";

/**
 * Plays a short rising chime made of synthesised tones.
 *
 * @param {number[]} notes - Frequencies in hertz.
 * @param {number} [gap=0.06] - Seconds between notes.
 * @param {number} [volume=0.18] - Note volume.
 * @returns {void}
 */
function chime(notes, gap = 0.06, volume = 0.18) {
    const now = audio.context?.currentTime ?? 0;
    notes.forEach((note, index) => audio.tone(note, 0.18, volume, "sfx", now + index * gap));
}

/**
 * Whether the player is alive and present.
 *
 * @returns {boolean} True when the player can interact with things.
 */
function playerAlive() {
    return Boolean(game.player) && game.player.state !== PlayerState.DEAD;
}

/**
 * Spring that throws the player up or sideways and refills the dash.
 */
export class Spring extends Entity {
    /** @type {string} */
    dir;
    /** @type {number} */
    #timer = 0;
    /** @type {import("../systems/physics.js").Body} */
    body;

    /**
     * @param {number} x - Left edge of the cell.
     * @param {number} y - Top edge of the cell.
     * @param {"up"|"left"|"right"} dir - Direction it throws the player.
     */
    constructor(x, y, dir = "up") {
        super({ x, y }, { width: TILE, height: TILE }, "spring");
        this.dir = dir;
        this.elem.classList.add("spring");
        this.setSpriteSheet(`${SPRITES}spring.png`, { frameWidth: 48, frameHeight: 48, scale: TILE / 48, sheetWidth: 144, sheetHeight: 48 });
        this.setFrame(0, 0);
        if (dir !== "up") this.visual.rotation = dir === "right" ? 90 : -90;
        const area = dir === "up" ? [x + 6, y + 24, TILE - 12, 26] : dir === "right" ? [x, y + 6, 26, TILE - 12] : [x + TILE - 26, y + 6, 26, TILE - 12];
        this.body = createBody(area[0], area[1], area[2], area[3], "trigger", {
            onStay: (player) => this.#bounce(player)
        });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Throws the player when they land on or run into the spring.
     *
     * @param {import("./player.js").Player} player - The player.
     * @returns {void}
     */
    #bounce(player) {
        if (this.#timer > 0.08 || player.state === PlayerState.DEAD) return;
        if (this.dir === "up") {
            if (player.velocity.y < 0) return;
            player.launch(null, -P.jumpSpeed * 1.85, 0);
        } else {
            const sign = this.dir === "right" ? 1 : -1;
            player.launch(sign * P.maxRun * 2.4, -P.jumpSpeed * 1.15, 0.22, false);
        }
        this.#timer = 0.25;
        this.setFrame(2, 0);
        audio.play(SFX.spring, { volume: 0.5 });
        game.particles?.burst({ x: this.position.x + TILE / 2, y: this.position.y + TILE / 2, count: 6, color: "#ffd1d1", size: 4, speed: 120, life: 0.3, drag: 5 });
    }

    /**
     * Settles the spring back after it fires.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        if (this.#timer <= 0) return;
        this.#timer -= dt;
        this.setFrame(this.#timer > 0.15 ? 2 : this.#timer > 0.05 ? 1 : 0, 0);
    }
}

/**
 * Golden key that follows the player until it is used on a locked door.
 */
export class KeyItem extends Entity {
    /** @type {"idle"|"following"|"used"} */
    status = "idle";
    /** @type {{ x: number, y: number }} */
    home;
    /** @type {number} */
    #time = Math.random() * 5;
    /** @type {number} */
    order = 0;
    /** @type {import("../systems/physics.js").Body} */
    body;
    /** @type {{ x: number, y: number }|null} */
    #target = null;
    /** @type {(() => void)|null} */
    #onArrive = null;

    /**
     * @param {number} x - Center x.
     * @param {number} y - Center y.
     */
    constructor(x, y) {
        super({ x: x - 32, y: y - 32 }, { width: 64, height: 64 }, "key");
        this.home = { x: x - 32, y: y - 32 };
        this.elem.classList.add("key-item");
        this.setSpriteSheet(`${SPRITES}key.png`, { frameWidth: 32, frameHeight: 32, scale: 2, sheetWidth: 448, sheetHeight: 64 });
        addAnimation(this, "idle", { row: 0, startFrame: 0, frameCount: 14, fps: 12 });
        addAnimation(this, "open", { row: 1, startFrame: 0, frameCount: 8, fps: 14, loop: false });
        playAnimation(this, "idle");
        this.body = createBody(x - 22, y - 22, 44, 44, "trigger", {
            onEnter: () => this.#pickUp()
        });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Starts following the player.
     *
     * @returns {void}
     */
    #pickUp() {
        if (this.status !== "idle") return;
        this.status = "following";
        this.body.active = false;
        this.order = KeyItem.held().length;
        chime([660, 880, 1100]);
    }

    /**
     * Keys currently following the player, oldest first.
     *
     * @returns {KeyItem[]} Held keys.
     */
    static held() {
        return (game.level?.entities ?? []).filter((entity) => entity instanceof KeyItem && entity.status === "following").sort((a, b) => a.order - b.order);
    }

    /**
     * Flies into a door's lock and calls back when it arrives.
     *
     * @param {{ x: number, y: number }} target - Center of the lock.
     * @param {() => void} onArrive - Called on arrival.
     * @returns {void}
     */
    useOn(target, onArrive) {
        this.status = "used";
        this.#target = target;
        this.#onArrive = onArrive;
    }

    /**
     * Bobs in place, trails behind the player or flies into a lock.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        this.#time += dt;
        if (this.status === "used") {
            if (!this.#target) return;
            const tx = this.#target.x - 32;
            const ty = this.#target.y - 32;
            this.position.x += (tx - this.position.x) * Math.min(1, dt * 10);
            this.position.y += (ty - this.position.y) * Math.min(1, dt * 10);
            if (Math.hypot(tx - this.position.x, ty - this.position.y) < 6) {
                this.#target = null;
                playAnimation(this, "open");
                this.#onArrive?.();
                setTimeout(() => {
                    this.visible = false;
                }, 500);
            }
            return;
        }
        const player = game.player;
        if (this.status === "following" && player) {
            const slot = KeyItem.held().indexOf(this) + 1;
            const tx = player.box.x + player.box.w / 2 - 32 - player.components.movement.direction * (30 + slot * 26);
            const ty = player.box.y - 30 + Math.sin(this.#time * 4 + slot) * 4;
            this.position.x += (tx - this.position.x) * Math.min(1, dt * 7);
            this.position.y += (ty - this.position.y) * Math.min(1, dt * 7);
            return;
        }
        this.position.y = this.home.y + Math.sin(this.#time * 2.5) * 4;
    }

    /**
     * Drops a carried key back where it was found.
     *
     * @returns {void}
     */
    reset() {
        if (this.status !== "following") return;
        this.status = "idle";
        this.position.x = this.home.x;
        this.position.y = this.home.y;
        this.body.active = true;
        this.snap();
    }
}

/**
 * Wooden door that opens when the player brings it a key.
 */
export class LockedDoor extends Entity {
    /** @type {boolean} */
    open = false;
    /** @type {boolean} */
    #opening = false;
    /** @type {import("../systems/physics.js").Body} */
    body;
    /** @type {HTMLDivElement} */
    #lock;

    /**
     * @param {number} x - Left edge.
     * @param {number} y - Top edge.
     * @param {number} w - Width in pixels.
     * @param {number} h - Height in pixels.
     */
    constructor(x, y, w, h) {
        super({ x, y }, { width: w, height: h }, "door");
        this.elem.classList.add("locked-door");
        this.elem.style.backgroundImage = `url("${SPRITES}door.png")`;
        this.elem.style.backgroundSize = `${TILE}px ${TILE}px`;
        this.#lock = document.createElement("div");
        this.#lock.className = "door-lock";
        this.#lock.style.left = `${w / 2 - TILE / 2}px`;
        this.#lock.style.top = `${h / 2 - TILE / 2}px`;
        this.elem.appendChild(this.#lock);
        this.body = createBody(x, y, w, h, "solid", { surface: "wood" });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Uses the oldest held key on the door once the player is right next to it.
     *
     * @returns {void}
     */
    #tryOpen() {
        if (this.open || this.#opening || !playerAlive()) return;
        const box = game.player.box;
        const b = this.body;
        const touching = box.x <= b.x + b.w + 2 && box.x + box.w >= b.x - 2 && box.y < b.y + b.h && box.y + box.h > b.y;
        const key = touching ? KeyItem.held()[0] : null;
        if (!key) return;
        this.#opening = true;
        const center = { x: this.position.x + this.dimensions.width / 2, y: this.position.y + this.dimensions.height / 2 };
        key.useOn(center, () => this.#unlock());
    }

    /**
     * Opens the door with a burst of splinters.
     *
     * @returns {void}
     */
    #unlock() {
        this.open = true;
        this.body.active = false;
        game.camera?.shake(4, 0.2);
        audio.play(SFX.breakBridge, { volume: 0.4, rate: 1.2 });
        chime([523, 659, 784, 1047], 0.07);
        const { x, y } = this.position;
        const { width, height } = this.dimensions;
        game.particles?.burst({ x: x + width / 2, y: y + height / 2, count: 24, color: "#a86c46", size: 6, speed: 220, gravity: 900, life: 0.8, jitter: height / 2 });
        game.particles?.burst({ x: x + width / 2, y: y + height / 2, count: 10, color: "#ffe88c", size: 4, speed: 160, life: 0.5, drag: 4 });
    }

    /**
     * Fades the door out once it is unlocked.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        this.#tryOpen();
        if (this.open && this.visual.opacity > 0) {
            this.visual.opacity = Math.max(0, this.visual.opacity - dt * 4);
            this.visual.scaleY = Math.max(0.2, this.visual.scaleY - dt * 3);
            if (this.visual.opacity <= 0) this.visible = false;
        }
    }
}

/**
 * Shared state of the touch switches and gates in one level.
 */
export class SwitchHub {
    /** @type {Map<number, TouchSwitch[]>} */
    switches = new Map();
    /** @type {Map<number, SwitchGate[]>} */
    gates = new Map();
    /** @type {Set<number>} */
    opened = new Set();

    /**
     * Opens a group's gates once every switch in it is on.
     *
     * @param {number} group - Group number.
     * @returns {void}
     */
    check(group) {
        if (this.opened.has(group)) return;
        const list = this.switches.get(group) ?? [];
        if (!list.every((item) => item.on)) {
            chime([700 + list.filter((item) => item.on).length * 120]);
            return;
        }
        this.open(group);
    }

    /**
     * Opens a group's gates right away.
     *
     * @param {number} group - Group number.
     * @returns {void}
     */
    open(group) {
        if (this.opened.has(group)) return;
        this.opened.add(group);
        for (const item of this.switches.get(group) ?? []) item.complete();
        chime([523, 784, 1047, 1568], 0.08, 0.22);
        game.flash?.(0.25, 0.3);
        for (const gate of this.gates.get(group) ?? []) gate.open();
    }
}

/**
 * Floating ring that lights up when touched; when every ring of its group
 * is lit the group's gates slide open.
 */
export class TouchSwitch extends Entity {
    /** @type {boolean} */
    on = false;
    /** @type {number} */
    group;
    /** @type {SwitchHub} */
    #hub;
    /** @type {number} */
    #time = Math.random() * 4;
    /** @type {{ x: number, y: number }} */
    home;
    /** @type {import("../systems/physics.js").Body} */
    body;

    /**
     * @param {number} x - Center x.
     * @param {number} y - Center y.
     * @param {number} group - Group number.
     * @param {SwitchHub} hub - Level switch state.
     */
    constructor(x, y, group, hub) {
        super({ x: x - 24, y: y - 24 }, { width: 48, height: 48 }, "touch-switch");
        this.home = { x: x - 24, y: y - 24 };
        this.group = group;
        this.#hub = hub;
        this.elem.classList.add("touch-switch");
        this.setSpriteSheet(`${SPRITES}touch_switch.png`, { frameWidth: 48, frameHeight: 48, scale: 1, sheetWidth: 144, sheetHeight: 48 });
        this.setFrame(0, 0);
        this.body = createBody(x - 26, y - 26, 52, 52, "trigger", {
            onEnter: () => this.#touch()
        });
        if (!hub.switches.has(group)) hub.switches.set(group, []);
        hub.switches.get(group).push(this);
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Lights the switch.
     *
     * @returns {void}
     */
    #touch() {
        if (this.on) return;
        this.on = true;
        this.setFrame(1, 0);
        this.elem.classList.add("lit");
        game.particles?.burst({ x: this.home.x + 24, y: this.home.y + 24, count: 12, color: "#9fe8ff", size: 4, speed: 170, life: 0.4, drag: 5 });
        this.#hub.check(this.group);
    }

    /**
     * Marks the switch as part of a finished group.
     *
     * @returns {void}
     */
    complete() {
        this.on = true;
        this.setFrame(2, 0);
        this.elem.classList.add("lit");
    }

    /**
     * Floats gently.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        this.#time += dt;
        this.position.y = this.home.y + Math.sin(this.#time * 2) * 3;
        this.visual.rotation = this.on ? (this.#time * 90) % 360 : 0;
    }
}

/**
 * Steel block that slides out of the way when its switch group is finished.
 */
export class SwitchGate extends Entity {
    /** @type {"closed"|"moving"|"open"} */
    status = "closed";
    /** @type {{ x: number, y: number }} */
    start;
    /** @type {{ x: number, y: number }} */
    end;
    /** @type {number} */
    #progress = 0;
    /** @type {import("../systems/physics.js").Body} */
    body;

    /**
     * @param {number} x - Left edge.
     * @param {number} y - Top edge.
     * @param {number} w - Width in pixels.
     * @param {number} h - Height in pixels.
     * @param {number} dx - Horizontal travel in pixels when opening.
     * @param {number} dy - Vertical travel in pixels when opening.
     * @param {number} group - Switch group.
     * @param {SwitchHub} hub - Level switch state.
     */
    constructor(x, y, w, h, dx, dy, group, hub) {
        super({ x, y }, { width: w, height: h }, "switch-gate");
        this.start = { x, y };
        this.end = { x: x + dx, y: y + dy };
        this.elem.classList.add("switch-gate");
        this.elem.style.backgroundImage = `url("${SPRITES}switch_gate.png")`;
        this.elem.style.backgroundSize = `${TILE * 2}px ${TILE}px`;
        this.body = createBody(x, y, w, h, "solid", { surface: "metal" });
        if (!hub.gates.has(group)) hub.gates.set(group, []);
        hub.gates.get(group).push(this);
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Starts sliding open.
     *
     * @returns {void}
     */
    open() {
        if (this.status !== "closed") return;
        this.status = "moving";
        this.elem.classList.add("opening");
        audio.play(SFX.cart, { volume: 0.4, rate: 0.8 });
    }

    /**
     * Slides with an ease-in-out and stops with a thud.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        if (this.status !== "moving") return;
        this.#progress = Math.min(1, this.#progress + dt * 1.4);
        const t = this.#progress < 0.5 ? 2 * this.#progress * this.#progress : 1 - (-2 * this.#progress + 2) ** 2 / 2;
        const x = Math.round(this.start.x + (this.end.x - this.start.x) * t);
        const y = Math.round(this.start.y + (this.end.y - this.start.y) * t);
        moveSolid(game.level.world, this.body, x - this.body.x, y - this.body.y, game.player ? [game.player.box] : []);
        this.position.x = this.body.x;
        this.position.y = this.body.y;
        if (this.#progress >= 1) {
            this.status = "open";
            game.camera?.shake(3, 0.15);
            audio.play(SFX.crack, { volume: 0.4, rate: 0.7 });
        }
    }
}

/**
 * Cracked rubble that shatters when the player dashes into it.
 */
export class DashBlock extends Entity {
    /** @type {boolean} */
    broken = false;
    /** @type {import("../systems/physics.js").Body} */
    body;

    /**
     * @param {number} x - Left edge.
     * @param {number} y - Top edge.
     * @param {number} w - Width in pixels.
     * @param {number} h - Height in pixels.
     */
    constructor(x, y, w, h) {
        super({ x, y }, { width: w, height: h }, "dash-block");
        this.elem.classList.add("dash-block");
        this.elem.style.backgroundImage = `url("${SPRITES}dash_block.png")`;
        this.elem.style.backgroundSize = `${TILE}px ${TILE}px`;
        this.body = createBody(x, y, w, h, "solid", {
            surface: "dirt",
            onTouch: (player) => this.#hit(player)
        });
    }

    /**
     * Breaks under a dash and lets the dash carry on.
     *
     * @param {import("./player.js").Player} player - The player.
     * @returns {boolean} True when the block broke.
     */
    #hit(player) {
        if (this.broken || !player.dashing) return false;
        this.broken = true;
        this.body.active = false;
        this.visible = false;
        game.camera?.shake(6, 0.25);
        game.hitStop?.(0.04);
        audio.play(SFX.breakBridge, { volume: 0.55 });
        audio.play(SFX.crack, { volume: 0.45, rate: 0.8 });
        const { x, y } = this.position;
        const { width, height } = this.dimensions;
        for (let px = x + 25; px < x + width; px += TILE) {
            for (let py = y + 25; py < y + height; py += TILE) {
                game.particles?.burst({ x: px, y: py, count: 6, color: "#8a8898", size: 7, speed: 200, gravity: 1100, life: 0.7, jitter: 20 });
            }
        }
        return true;
    }
}

/**
 * Static scenery cut from the decoration sheet.
 *
 * Each entry is the left edge in the sheet and the size in map cells.
 *
 * @type {Readonly<Record<string, [number, number, number]>>}
 */
export const DECOR = Object.freeze({
    lamp: [0, 1, 3],
    window: [48, 2, 2],
    windowDark: [144, 2, 2],
    crate: [240, 1, 1],
    barrel: [288, 1, 1],
    sign: [336, 1, 1],
    bench: [384, 2, 1],
    pipe: [480, 1, 3],
    chain: [528, 1, 2],
    banner: [576, 1, 2],
    flags: [624, 4, 1],
    bush: [816, 1, 1],
    pine: [864, 2, 3],
    rock: [960, 1, 1],
    icicles: [1008, 1, 1],
    memorial: [1056, 1, 2],
    billboard: [1104, 3, 2],
    lantern: [1248, 1, 1],
    snowman: [1296, 1, 2],
    cairn: [1344, 1, 1],
    antenna: [1392, 1, 3],
    rail: [1440, 2, 1]
});

/**
 * Decorations that give off a warm glow.
 *
 * @type {ReadonlySet<string>}
 */
const GLOWING = new Set(["lamp", "window", "lantern"]);

/**
 * Adds a decoration behind the player.
 *
 * @param {import("../level.js").Level} level - Target level.
 * @param {string} variant - Decoration name from {@link DECOR}.
 * @param {number} x - Left edge.
 * @param {number} y - Top edge.
 * @returns {void}
 */
export function addDecor(level, variant, x, y) {
    const spec = DECOR[variant];
    if (!spec) return;
    const [sx, cw, ch] = spec;
    const scale = TILE / 48;
    level.addTile({
        x, y, w: cw * TILE, h: ch * TILE,
        src: `${SPRITES}decor.png`, solid: false, layer: "deco",
        backgroundSize: `${1536 * scale}px ${144 * scale}px`,
        backgroundPosition: `${-sx * scale}px 0px`,
        classes: GLOWING.has(variant) ? ["decor", `decor-${variant}`, "decor-glow"] : ["decor", `decor-${variant}`]
    });
}

/**
 * Purple eye creature that drifts in place until it sees the player, then
 * gives chase. It bonks off walls, getting stunned for a moment.
 */
export class Seeker extends Entity {
    /** @type {"idle"|"spotted"|"chase"|"stunned"|"return"} */
    status = "idle";
    /** @type {{ x: number, y: number }} */
    home;
    /** @type {{ x: number, y: number }} */
    velocity = { x: 0, y: 0 };
    /** @type {number} */
    #timer = 0;
    /** @type {number} */
    #lost = 0;
    /** @type {number} */
    #time = Math.random() * 5;
    /** @type {import("../systems/physics.js").Body} */
    body;
    /** @type {number} */
    speed;

    /**
     * @param {number} x - Center x.
     * @param {number} y - Center y.
     * @param {number} [speed=1] - Chase speed multiplier.
     */
    constructor(x, y, speed = 1) {
        super({ x: x - 64, y: y - 64 }, { width: 128, height: 128 }, "seeker");
        this.home = { x, y };
        this.speed = speed;
        this.elem.classList.add("seeker");
        this.setSpriteSheet(`${SPRITES}seeker.png`, { frameWidth: 64, frameHeight: 64, scale: 2, sheetWidth: 1280, sheetHeight: 256 });
        addAnimation(this, "idle", { row: 0, startFrame: 0, frameCount: 20, fps: 12 });
        addAnimation(this, "spotted", { row: 1, startFrame: 0, frameCount: 5, fps: 12, loop: false });
        addAnimation(this, "chase", { row: 2, startFrame: 0, frameCount: 5, fps: 14 });
        addAnimation(this, "stunned", { row: 3, startFrame: 0, frameCount: 2, fps: 6 });
        playAnimation(this, "idle");
        this.body = createBody(x - 22, y - 22, 44, 44, "hazard", { direction: "any" });
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Center of the seeker.
     *
     * @returns {{ x: number, y: number }} Center in world pixels.
     */
    get center() {
        return { x: this.position.x + 64, y: this.position.y + 64 };
    }

    /**
     * Whether nothing solid sits between the seeker and a point.
     *
     * @param {number} tx - Target x.
     * @param {number} ty - Target y.
     * @returns {boolean} True when the line is clear.
     */
    #canSee(tx, ty) {
        const { x, y } = this.center;
        const distance = Math.hypot(tx - x, ty - y);
        const steps = Math.ceil(distance / 20);
        for (let i = 1; i < steps; i++) {
            const px = x + (tx - x) * i / steps;
            const py = y + (ty - y) * i / steps;
            if (game.level.world.solidAt(px - 2, py - 2, 4, 4)) return false;
        }
        return true;
    }

    /**
     * Moves the seeker, stopping at walls; returns whether it hit one hard.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {boolean} True when it crashed into a wall at speed.
     */
    #move(dt) {
        const world = game.level.world;
        let crashed = false;
        for (const axis of ["x", "y"]) {
            const amount = this.velocity[axis] * dt;
            const probe = { x: this.body.x, y: this.body.y, w: this.body.w, h: this.body.h };
            probe[axis] += amount;
            if (world.solidAt(probe.x, probe.y, probe.w, probe.h)) {
                if (Math.abs(this.velocity[axis]) > 260) crashed = true;
                this.velocity[axis] *= -0.4;
            } else {
                this.body[axis] = probe[axis];
            }
        }
        world.update(this.body);
        this.position.x = this.body.x + 22 - 64;
        this.position.y = this.body.y + 22 - 64;
        return crashed;
    }

    /**
     * Drifts, notices, chases, crashes and gives up.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        this.#time += dt;
        const player = game.player;
        if (!player) return;
        const px = player.box.x + player.box.w / 2;
        const py = player.box.y + player.box.h / 2;
        const { x, y } = this.center;
        const distance = Math.hypot(px - x, py - y);
        const sees = playerAlive() && distance < 420 && this.#canSee(px, py);
        if (Math.abs(px - x) > 4) this.facing = px > x ? 1 : -1;
        switch (this.status) {
            case "idle":
            case "return": {
                const tx = this.home.x + Math.sin(this.#time * 0.8) * 20;
                const ty = this.home.y + Math.sin(this.#time * 1.3) * 12;
                this.velocity.x += ((tx - x) * 3 - this.velocity.x) * Math.min(1, dt * 3);
                this.velocity.y += ((ty - y) * 3 - this.velocity.y) * Math.min(1, dt * 3);
                this.#move(dt);
                if (sees && distance < 360) {
                    this.status = "spotted";
                    this.#timer = 0.45;
                    playAnimation(this, "spotted");
                    chime([300, 240], 0.08, 0.2);
                }
                break;
            }
            case "spotted":
                this.#timer -= dt;
                this.velocity.x *= 0.9;
                this.velocity.y *= 0.9;
                this.#move(dt);
                if (this.#timer <= 0) {
                    this.status = "chase";
                    this.#lost = 0;
                    playAnimation(this, "chase");
                }
                break;
            case "chase": {
                const top = 300 * this.speed;
                const angle = Math.atan2(py - y, px - x);
                this.velocity.x += (Math.cos(angle) * top - this.velocity.x) * Math.min(1, dt * 2.6);
                this.velocity.y += (Math.sin(angle) * top - this.velocity.y) * Math.min(1, dt * 2.6);
                if (this.#move(dt)) {
                    this.status = "stunned";
                    this.#timer = 1.1;
                    playAnimation(this, "stunned");
                    game.camera?.shake(4, 0.15);
                    audio.play(SFX.quack, { volume: 0.35, rate: 0.7 });
                }
                this.#lost = sees ? 0 : this.#lost + dt;
                if (this.#lost > 2.2 || !playerAlive()) {
                    this.status = "return";
                    playAnimation(this, "idle");
                }
                break;
            }
            case "stunned":
                this.#timer -= dt;
                this.velocity.x *= 0.92;
                this.velocity.y *= 0.92;
                this.#move(dt);
                if (this.#timer <= 0) {
                    this.status = "chase";
                    playAnimation(this, "chase");
                }
                break;
            default:
                break;
        }
        this.body.active = this.status !== "stunned";
    }

    /**
     * Sends the seeker home.
     *
     * @returns {void}
     */
    reset() {
        this.status = "idle";
        this.velocity.x = 0;
        this.velocity.y = 0;
        this.body.x = this.home.x - 22;
        this.body.y = this.home.y - 22;
        this.body.active = true;
        game.level?.world.update(this.body);
        this.position.x = this.home.x - 64;
        this.position.y = this.home.y - 64;
        playAnimation(this, "idle");
        this.snap();
    }
}

/**
 * Snowball thrown across the screen by the wind. Landing on top of it
 * bounces the player; touching it anywhere else is fatal.
 */
class Snowball extends Entity {
    /** @type {import("../systems/physics.js").Body} */
    body;
    /** @type {number} */
    #time = 0;
    /** @type {number} */
    #baseY;
    /** @type {number} */
    #speed;
    /** @type {boolean} */
    done = false;

    /**
     * @param {number} x - Center x.
     * @param {number} y - Center y.
     * @param {number} speed - Signed horizontal speed.
     */
    constructor(x, y, speed) {
        super({ x: x - 36, y: y - 36 }, { width: 72, height: 72 }, "snowball");
        this.#baseY = y;
        this.#speed = speed;
        this.elem.classList.add("snowball");
        this.setSpriteSheet(`${SPRITES}snowball.png`, { frameWidth: 48, frameHeight: 48, scale: 1.5, sheetWidth: 816, sheetHeight: 48 });
        addAnimation(this, "roll", { row: 0, startFrame: 0, frameCount: 12, fps: 16 });
        addAnimation(this, "burst", { row: 0, startFrame: 12, frameCount: 5, fps: 18, loop: false });
        playAnimation(this, "roll");
        this.facing = speed < 0 ? 1 : -1;
        this.body = createBody(x - 20, y - 20, 40, 40, "trigger", {});
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Flies, wobbles and checks the player.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        if (this.done) return;
        this.#time += dt;
        this.position.x += this.#speed * dt;
        this.position.y = this.#baseY - 36 + Math.sin(this.#time * 5) * 10;
        this.body.x = this.position.x + 16;
        this.body.y = this.position.y + 16;
        const player = game.player;
        if (playerAlive() && overlaps(player.box, this.body)) {
            const feet = player.box.y + player.box.h;
            if (player.velocity.y > 0 && feet < this.body.y + 16) {
                player.launch(null, -P.jumpSpeed * 1.2, 0);
                this.#burst();
            } else {
                player.die(Math.sign(this.#speed), 0);
            }
        }
        const camera = game.camera;
        if (camera && (this.position.x < camera.position.x - 300 || this.position.x > camera.position.x + camera.viewWidth + 300)) this.#remove();
    }

    /**
     * Breaks apart.
     *
     * @returns {void}
     */
    #burst() {
        this.done = true;
        playAnimation(this, "burst");
        audio.play(SFX.crack, { volume: 0.35, rate: 1.4 });
        game.particles?.burst({ x: this.position.x + 36, y: this.position.y + 36, count: 14, color: "#e8f4ff", size: 5, speed: 180, gravity: 700, life: 0.5 });
        setTimeout(() => this.#remove(), 300);
    }

    /**
     * Takes the snowball out of the level.
     *
     * @returns {void}
     */
    #remove() {
        this.done = true;
        game.level?.removeEntity?.(this);
    }
}

/**
 * Throws snowballs across the view at the player's height while active.
 */
export class SnowballThrower extends Entity {
    /** @type {boolean} */
    active = false;
    /** @type {number} */
    interval = 1.6;
    /** @type {number} */
    #timer = 0;
    /** @type {number} */
    direction = -1;

    constructor() {
        super({ x: 0, y: 0 }, { width: 0, height: 0 }, "snowball-thrower");
        this.setUpdate((self, dt) => self.step(dt));
    }

    /**
     * Starts or stops the snowballs.
     *
     * @param {boolean} on - Whether snowballs fly.
     * @param {number} [interval=1.6] - Seconds between snowballs.
     * @param {number} [direction=-1] - Travel direction, -1 for leftwards.
     * @returns {void}
     */
    set(on, interval = 1.6, direction = -1) {
        this.active = on;
        this.interval = interval;
        this.direction = direction;
        this.#timer = Math.min(this.#timer, 0.8);
    }

    /**
     * Spawns a snowball every interval.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        if (!this.active || !playerAlive() || game.ui?.cutscenes?.running) return;
        this.#timer -= dt;
        if (this.#timer > 0) return;
        this.#timer = this.interval;
        const camera = game.camera;
        const player = game.player;
        const x = this.direction < 0 ? camera.position.x + camera.viewWidth + 60 : camera.position.x - 60;
        const y = player.box.y + player.box.h / 2 + (Math.random() * 2 - 1) * 30;
        game.level.addEntity(new Snowball(x, y, this.direction * 560));
        audio.tone(180, 0.25, 0.08, "sfx", undefined, "sawtooth");
    }

    /**
     * Clears every snowball in flight.
     *
     * @returns {void}
     */
    reset() {
        for (const entity of [...(game.level?.entities ?? [])]) {
            if (entity instanceof Snowball) game.level.removeEntity?.(entity);
        }
        this.#timer = 1.2;
    }
}

/**
 * Characters that can stand around in a level.
 *
 * @type {Readonly<Record<string, { sheet: string, frame: number, scale: number, sheetWidth: number, sheetHeight: number, row: number, frames: number, fps: number, size: number, bottom: number }>>}
 */
export const NPC_LOOKS = Object.freeze({
    granny: { sheet: `${SPRITES}granny.png`, frame: 96, scale: 1, sheetWidth: 2784, sheetHeight: 384, row: 0, frames: 12, fps: 8, size: 96, bottom: 0 },
    theo: { sheet: `${SPRITES}theo.png`, frame: 32, scale: 3, sheetWidth: 512, sheetHeight: 160, row: 1, frames: 11, fps: 8, size: 96, bottom: 0 }
});

/**
 * Character standing in the level as scenery; events give it a voice.
 */
export class LevelNpc extends Entity {
    /**
     * @param {string} look - Key of {@link NPC_LOOKS}.
     * @param {number} x - Feet x.
     * @param {number} y - Ground y.
     * @param {number} facing - 1 to face right, -1 to face left.
     */
    constructor(look, x, y, facing) {
        const spec = NPC_LOOKS[look] ?? NPC_LOOKS.granny;
        super({ x: x - spec.size / 2, y: y - spec.size + spec.bottom }, { width: spec.size, height: spec.size }, `npc-${look}`);
        this.elem.classList.add("level-npc");
        this.elem.style.transformOrigin = "50% 100%";
        this.setSpriteSheet(spec.sheet, { frameWidth: spec.frame, frameHeight: spec.frame, scale: spec.scale, sheetWidth: spec.sheetWidth, sheetHeight: spec.sheetHeight });
        addAnimation(this, "idle", { row: spec.row, startFrame: 0, frameCount: spec.frames, fps: spec.fps });
        playAnimation(this, "idle");
        this.facing = facing;
    }
}
