import { events } from "../core/events.js";
import { settings } from "../core/settings.js";

/**
 * Every logical action the game understands.
 *
 * @type {string[]}
 */
export const ACTIONS = ["left", "right", "up", "down", "jump", "dash", "grab", "pause", "confirm", "back"];

/**
 * Gamepad buttons (standard mapping) bound to each action.
 *
 * @type {Record<string, number[]>}
 */
const GAMEPAD_BUTTONS = {
    left: [14],
    right: [15],
    up: [12],
    down: [13],
    jump: [0, 3],
    dash: [2, 1],
    grab: [4, 5, 6, 7],
    pause: [9],
    confirm: [0],
    back: [1, 8]
};

const AXIS_DEADZONE = 0.45;
const MENU_REPEAT_DELAY = 0.35;
const MENU_REPEAT_RATE = 0.09;

/**
 * Tracks keyboard and gamepad state and exposes it as logical actions.
 *
 * Gameplay reads held state with {@link Input#isDown} and buffered presses with
 * {@link Input#pressedWithin}. Menus subscribe to the "input:ui" event which
 * fires once per press with key repeat for directions.
 */
export class Input {
    /** @type {Set<string>} */
    #keys = new Set();
    /** @type {Record<string, boolean>} */
    #pad = {};
    /** @type {Record<string, boolean>} */
    #padPrevious = {};
    /** @type {Record<string, number>} */
    #pressAge = {};
    /** @type {Record<string, number>} */
    #repeatTimer = {};
    /** @type {((code: string) => void)|null} */
    #captureCallback = null;
    /** @type {boolean} */
    usingGamepad = false;
    /** @type {number} */
    #pressId = 0;
    /** @type {boolean} */
    enabled = true;

    /**
     * Starts listening to keyboard events on the window.
     */
    constructor() {
        for (const action of ACTIONS) {
            this.#pressAge[action] = Infinity;
        }
        window.addEventListener("keydown", (event) => this.#onKeyDown(event));
        window.addEventListener("keyup", (event) => this.#onKeyUp(event));
        window.addEventListener("blur", () => this.clear());
    }

    /**
     * Returns the actions bound to a keyboard code.
     *
     * @param {string} code - KeyboardEvent.code value.
     * @returns {string[]} Matching actions.
     */
    actionsForCode(code) {
        const matches = [];
        for (const action of ACTIONS) {
            if (settings.bindings[action]?.includes(code)) matches.push(action);
        }
        return matches;
    }

    /**
     * Handles a key press, recording presses and emitting UI events.
     *
     * @param {KeyboardEvent} event - Browser keyboard event.
     * @returns {void}
     */
    #onKeyDown(event) {
        if (this.#captureCallback) {
            event.preventDefault();
            const callback = this.#captureCallback;
            this.#captureCallback = null;
            callback(event.code);
            return;
        }
        const actions = this.actionsForCode(event.code);
        if (actions.length || event.code.startsWith("Arrow") || event.code === "Space") {
            event.preventDefault();
        }
        this.usingGamepad = false;
        if (event.repeat) {
            return;
        }
        this.#keys.add(event.code);
        const press = ++this.#pressId;
        for (const action of actions) {
            this.#pressAge[action] = 0;
            events.emit("input:ui", { action, source: "keyboard", press });
        }
        events.emit("input:key", { code: event.code });
    }

    /**
     * Handles a key release.
     *
     * @param {KeyboardEvent} event - Browser keyboard event.
     * @returns {void}
     */
    #onKeyUp(event) {
        this.#keys.delete(event.code);
    }

    /**
     * Whether an action is currently held on any device.
     *
     * @param {string} action - Action name.
     * @returns {boolean} True while held.
     */
    isDown(action) {
        if (!this.enabled) return false;
        if (this.#pad[action]) return true;
        const codes = settings.bindings[action];
        if (!codes) return false;
        for (const code of codes) {
            if (this.#keys.has(code)) return true;
        }
        return false;
    }

    /**
     * Whether an action was pressed within a time window and not consumed yet.
     *
     * @param {string} action - Action name.
     * @param {number} [window=0] - Buffer window in seconds.
     * @returns {boolean} True when a recent press is available.
     */
    pressedWithin(action, window = 0) {
        if (!this.enabled) return false;
        return this.#pressAge[action] <= window;
    }

    /**
     * Marks a buffered press as used so it cannot trigger twice.
     *
     * @param {string} action - Action name.
     * @returns {void}
     */
    consume(action) {
        this.#pressAge[action] = Infinity;
    }

    /**
     * Returns the horizontal axis as -1, 0 or 1.
     *
     * @returns {number} Horizontal direction.
     */
    axisX() {
        return (this.isDown("right") ? 1 : 0) - (this.isDown("left") ? 1 : 0);
    }

    /**
     * Returns the vertical axis as -1 (up), 0 or 1 (down).
     *
     * @returns {number} Vertical direction.
     */
    axisY() {
        return (this.isDown("down") ? 1 : 0) - (this.isDown("up") ? 1 : 0);
    }

    /**
     * Advances press buffers by a simulation step.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        for (const action of ACTIONS) {
            if (this.#pressAge[action] !== Infinity) {
                this.#pressAge[action] += dt;
                if (this.#pressAge[action] > 1) this.#pressAge[action] = Infinity;
            }
        }
    }

    /**
     * Polls connected gamepads once per rendered frame and emits UI repeats.
     *
     * @param {number} dt - Frame time in seconds.
     * @returns {void}
     */
    poll(dt) {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const state = {};
        const press = ++this.#pressId;
        for (const pad of pads) {
            if (!pad || !pad.connected) continue;
            for (const action of ACTIONS) {
                for (const index of GAMEPAD_BUTTONS[action]) {
                    if (pad.buttons[index]?.pressed) state[action] = true;
                }
            }
            const [ax = 0, ay = 0] = pad.axes;
            if (ax < -AXIS_DEADZONE) state.left = true;
            if (ax > AXIS_DEADZONE) state.right = true;
            if (ay < -AXIS_DEADZONE) state.up = true;
            if (ay > AXIS_DEADZONE) state.down = true;
        }
        for (const action of ACTIONS) {
            const down = Boolean(state[action]);
            if (down && !this.#padPrevious[action]) {
                this.usingGamepad = true;
                this.#pressAge[action] = 0;
                this.#repeatTimer[action] = MENU_REPEAT_DELAY;
                events.emit("input:ui", { action, source: "gamepad", press });
            } else if (down && ["left", "right", "up", "down"].includes(action)) {
                this.#repeatTimer[action] -= dt;
                if (this.#repeatTimer[action] <= 0) {
                    this.#repeatTimer[action] = MENU_REPEAT_RATE;
                    events.emit("input:ui", { action, source: "gamepad", repeat: true, press: ++this.#pressId });
                }
            }
            this.#pad[action] = down;
            this.#padPrevious[action] = down;
        }
        this.#pollKeyboardRepeat(dt);
    }

    /**
     * Emits repeated UI events while direction keys stay held.
     *
     * @param {number} dt - Frame time in seconds.
     * @returns {void}
     */
    #pollKeyboardRepeat(dt) {
        for (const action of ["left", "right", "up", "down"]) {
            const held = settings.bindings[action]?.some((code) => this.#keys.has(code));
            const key = `k:${action}`;
            if (!held) {
                this.#repeatTimer[key] = MENU_REPEAT_DELAY;
                continue;
            }
            this.#repeatTimer[key] = (this.#repeatTimer[key] ?? MENU_REPEAT_DELAY) - dt;
            if (this.#repeatTimer[key] <= 0) {
                this.#repeatTimer[key] = MENU_REPEAT_RATE;
                events.emit("input:ui", { action, source: "keyboard", repeat: true, press: ++this.#pressId });
            }
        }
    }

    /**
     * Releases every held key and clears buffered presses.
     *
     * @returns {void}
     */
    clear() {
        this.#keys.clear();
        for (const action of ACTIONS) {
            this.#pressAge[action] = Infinity;
        }
    }

    /**
     * Captures the next key press, used by the control remapping screen.
     *
     * @param {(code: string) => void} callback - Receives the pressed key code.
     * @returns {void}
     */
    captureNextKey(callback) {
        this.#captureCallback = callback;
    }

    /**
     * Cancels a pending key capture.
     *
     * @returns {void}
     */
    cancelCapture() {
        this.#captureCallback = null;
    }
}

/**
 * Shared input instance.
 *
 * @type {Input}
 */
export const input = new Input();

/**
 * Converts a KeyboardEvent.code into a short readable label.
 *
 * @param {string} code - Key code.
 * @returns {string} Display label.
 */
export function keyLabel(code) {
    const named = {
        ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓",
        Space: "Space", Enter: "Enter", Escape: "Esc", Backspace: "⌫",
        ShiftLeft: "Shift", ShiftRight: "R-Shift", ControlLeft: "Ctrl", ControlRight: "R-Ctrl",
        AltLeft: "Alt", AltRight: "R-Alt", Tab: "Tab"
    };
    if (named[code]) return named[code];
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Numpad")) return `Num ${code.slice(6)}`;
    return code;
}

/**
 * Returns the label of the first key bound to an action.
 *
 * @param {string} action - Action name.
 * @returns {string} Display label, or "?" when unbound.
 */
export function bindingLabel(action) {
    const code = settings.bindings[action]?.[0];
    return code ? keyLabel(code) : "?";
}
