import { events } from "./events.js";
import { readJson, writeJson } from "./storage.js";

const STORAGE_KEY = "celeste-remake.settings.v1";

/**
 * Default keyboard bindings, keyed by action, using KeyboardEvent.code values.
 *
 * @type {Readonly<Record<string, string[]>>}
 */
export const DEFAULT_BINDINGS = Object.freeze({
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    jump: ["Space", "KeyC"],
    dash: ["KeyX", "KeyW"],
    grab: ["KeyZ", "ShiftLeft"],
    pause: ["Escape", "KeyE"],
    confirm: ["Enter", "Space", "KeyC"],
    back: ["Escape", "Backspace"]
});

/**
 * Player-facing options persisted between sessions.
 *
 * @typedef {object} Settings
 * @property {number} masterVolume - Master volume from 0 to 1.
 * @property {number} musicVolume - Music volume from 0 to 1.
 * @property {number} sfxVolume - Sound effects volume from 0 to 1.
 * @property {number} screenShake - Screen shake strength from 0 to 1.
 * @property {boolean} flashes - Whether full screen flashes are allowed.
 * @property {number} vfxIntensity - Particle and weather density from 0 to 1.
 * @property {string} displayScale - One of "fit", "integer" or "native".
 * @property {boolean} fullscreen - Whether fullscreen was requested.
 * @property {number} frameCap - Frame rate cap, 0 meaning the display refresh rate.
 * @property {boolean} showFps - Whether the performance overlay is visible.
 * @property {string} language - Active language code.
 * @property {boolean} autoClimb - Whether holding towards a wall climbs without the grab button.
 * @property {boolean} assistMode - Infinite lives and time.
 * @property {number} cameraLookAhead - Camera look-ahead strength from 0 to 1.
 * @property {Record<string, string[]>} bindings - Keyboard bindings per action.
 */

/**
 * Default settings values.
 *
 * @type {Readonly<Settings>}
 */
export const DEFAULT_SETTINGS = Object.freeze({
    masterVolume: 0.8,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    screenShake: 1,
    flashes: true,
    vfxIntensity: 1,
    displayScale: "fit",
    fullscreen: false,
    frameCap: 0,
    showFps: false,
    language: "",
    autoClimb: true,
    assistMode: false,
    cameraLookAhead: 1,
    bindings: DEFAULT_BINDINGS
});

/**
 * Live settings object. Read freely, write through {@link setSetting}.
 *
 * @type {Settings}
 */
export const settings = structuredClone(DEFAULT_SETTINGS);

/**
 * Loads settings from storage, merging them over the defaults.
 *
 * @returns {Settings} The loaded settings.
 */
export function loadSettings() {
    const stored = readJson(STORAGE_KEY, {});
    Object.assign(settings, structuredClone(DEFAULT_SETTINGS));
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (key in stored && typeof stored[key] === typeof DEFAULT_SETTINGS[key]) {
            settings[key] = stored[key];
        }
    }
    settings.bindings = { ...structuredClone(DEFAULT_BINDINGS), ...(stored.bindings || {}) };
    return settings;
}

/**
 * Writes the current settings to storage.
 *
 * @returns {void}
 */
export function saveSettings() {
    writeJson(STORAGE_KEY, settings);
}

/**
 * Changes a setting, persists it and notifies listeners.
 *
 * @param {keyof Settings} key - The setting to change.
 * @param {*} value - The new value.
 * @returns {void}
 */
export function setSetting(key, value) {
    settings[key] = value;
    saveSettings();
    events.emit("settings:change", { key, value });
}

/**
 * Restores every setting except language to its default value.
 *
 * @returns {void}
 */
export function resetSettings() {
    const language = settings.language;
    Object.assign(settings, structuredClone(DEFAULT_SETTINGS), { language });
    saveSettings();
    events.emit("settings:change", { key: "*", value: null });
}
