/**
 * Shared description of the level file format used by the editor, the
 * custom level loader and the built-in levels written in it.
 *
 * A level is a grid of 50 pixel cells. Tiles are stored as one string per
 * row, objects and events as lists. Everything here is plain data so a
 * level can be saved, exported and imported as JSON.
 *
 * @module levels/levelFormat
 */

/**
 * Identifier written into every exported level file.
 *
 * @type {string}
 */
export const LEVEL_FORMAT = "celeste-remake-level";

/**
 * Current version of the level format.
 *
 * @type {number}
 */
export const LEVEL_VERSION = 1;

/**
 * Smallest and largest level size in cells.
 *
 * @type {Readonly<{ minWidth: number, maxWidth: number, minHeight: number, maxHeight: number }>}
 */
export const LEVEL_LIMITS = Object.freeze({ minWidth: 26, maxWidth: 400, minHeight: 12, maxHeight: 200 });

/**
 * Description of one editable field of an object, trigger or action.
 *
 * @typedef {object} FieldSpec
 * @property {string} key - Property name.
 * @property {string} label - Label shown in the editor.
 * @property {"number"|"text"|"textarea"|"select"|"checkbox"|"lines"|"target"} type - Input kind.
 * @property {*} [value] - Default value.
 * @property {number} [min] - Smallest number.
 * @property {number} [max] - Largest number.
 * @property {number} [step] - Number step.
 * @property {Array<[string, string]>} [options] - Value and label pairs for selects.
 */

/**
 * Terrain materials by map character.
 *
 * @type {Readonly<Record<string, { name: string, strip: string, surface: string }>>}
 */
export const TILE_TYPES = Object.freeze({
    s: { name: "Snowy dirt", strip: "./assets/generated/tiles/auto_snow.png", surface: "snow" },
    d: { name: "Dirt", strip: "./assets/generated/tiles/auto_dirt.png", surface: "dirt" },
    i: { name: "Ice", strip: "./assets/generated/tiles/auto_ice.png", surface: "ice" },
    g: { name: "Girder", strip: "./assets/generated/tiles/auto_girder.png", surface: "metal" },
    b: { name: "Stone beam", strip: "./assets/generated/tiles/auto_brick.png", surface: "wood" },
    w: { name: "Hotel wood", strip: "./assets/generated/tiles/auto_resort.png", surface: "wood" }
});

/**
 * Objects that can be placed in a level, with their editor fields.
 *
 * @type {Readonly<Record<string, { name: string, icon: string, unique?: boolean, fields: FieldSpec[] }>>}
 */
export const ENTITY_TYPES = Object.freeze({
    spawn: { name: "Player start", icon: "spawn", unique: true, fields: [] },
    checkpoint: { name: "Checkpoint", icon: "checkpoint", fields: [] },
    goal: { name: "Goal flag", icon: "goal", unique: true, fields: [] },
    spike: {
        name: "Spikes", icon: "spike", fields: [
            { key: "dir", label: "Points", type: "select", value: "up", options: [["up", "Up"], ["down", "Down"], ["left", "Left"], ["right", "Right"]] }
        ]
    },
    crumble: { name: "Crumbling block", icon: "crumble", fields: [] },
    falling: {
        name: "Falling block", icon: "falling", fields: [
            { key: "trigger", label: "Falls when", type: "select", value: "touch", options: [["touch", "Stood on"], ["event", "An event drops it"]] },
            { key: "lands", label: "Lands on ground", type: "checkbox", value: true }
        ]
    },
    crystal: { name: "Dash crystal", icon: "crystal", fields: [] },
    booster: { name: "Booster bubble", icon: "booster", fields: [] },
    strawberry: { name: "Strawberry", icon: "strawberry", fields: [] },
    dustBunny: {
        name: "Dust bunny", icon: "dust", fields: [
            { key: "dx", label: "Moves right (cells)", type: "number", value: 0, min: -20, max: 20, step: 1 },
            { key: "dy", label: "Moves down (cells)", type: "number", value: 0, min: -20, max: 20, step: 1 },
            { key: "speed", label: "Speed", type: "number", value: 1, min: 0.1, max: 4, step: 0.1 }
        ]
    },
    zipMover: {
        name: "Zip mover", icon: "zip", fields: [
            { key: "dx", label: "Travels right (cells)", type: "number", value: 4, min: -30, max: 30, step: 1 },
            { key: "dy", label: "Travels down (cells)", type: "number", value: 0, min: -30, max: 30, step: 1 }
        ]
    }
});

/**
 * Speakers that can be used in dialogue actions.
 *
 * @type {ReadonlyArray<[string, string]>}
 */
export const SPEAKER_OPTIONS = Object.freeze([
    ["madeline", "Madeline"], ["badeline", "Badeline"], ["granny", "Granny"], ["theo", "Theo"], ["oshiro", "Oshiro"], ["narrator", "No portrait"]
]);

/**
 * What starts an event, with editor fields.
 *
 * @type {Readonly<Record<string, { name: string, fields: FieldSpec[] }>>}
 */
export const TRIGGER_TYPES = Object.freeze({
    enter: { name: "Player enters an area", fields: [] },
    start: { name: "Level starts", fields: [] },
    checkpoint: { name: "Checkpoint reached", fields: [{ key: "index", label: "Checkpoint number (0 = any)", type: "number", value: 0, min: 0, max: 50, step: 1 }] },
    strawberries: { name: "Strawberries collected", fields: [{ key: "count", label: "At least", type: "number", value: 1, min: 1, max: 99, step: 1 }] },
    deaths: { name: "Player died", fields: [{ key: "count", label: "Times", type: "number", value: 1, min: 1, max: 999, step: 1 }] }
});

/**
 * What an event does, run in order, with editor fields.
 *
 * @type {Readonly<Record<string, { name: string, fields: FieldSpec[] }>>}
 */
export const ACTION_TYPES = Object.freeze({
    dialogue: { name: "Dialogue", fields: [{ key: "lines", label: "Lines", type: "lines", value: [] }] },
    toast: { name: "Message", fields: [{ key: "text", label: "Text", type: "text", value: "" }] },
    title: {
        name: "Title card", fields: [
            { key: "text", label: "Title", type: "text", value: "" },
            { key: "sub", label: "Subtitle", type: "text", value: "" }
        ]
    },
    shake: {
        name: "Screen shake", fields: [
            { key: "strength", label: "Strength", type: "number", value: 6, min: 1, max: 20, step: 1 },
            { key: "duration", label: "Seconds", type: "number", value: 0.4, min: 0.1, max: 3, step: 0.1 }
        ]
    },
    flash: { name: "Screen flash", fields: [{ key: "strength", label: "Strength", type: "number", value: 0.6, min: 0.1, max: 1, step: 0.1 }] },
    drop: { name: "Drop falling block", fields: [{ key: "target", label: "Block", type: "target", value: "" }] },
    wind: { name: "Set wind", fields: [{ key: "strength", label: "Push (negative = left)", type: "number", value: 120, min: -400, max: 400, step: 10 }] },
    weather: {
        name: "Change weather", fields: [
            { key: "preset", label: "Weather", type: "select", value: "snow", options: [["none", "Clear"], ["snow", "Snow"], ["heavy", "Heavy snow"], ["blizzard", "Blizzard"]] }
        ]
    },
    dashes: { name: "Set dashes", fields: [{ key: "count", label: "Dashes", type: "number", value: 2, min: 0, max: 2, step: 1 }] },
    refill: { name: "Refill dash", fields: [] },
    camera: {
        name: "Look at", fields: [
            { key: "x", label: "Column", type: "number", value: 0, min: 0, max: 400, step: 1 },
            { key: "y", label: "Row", type: "number", value: 0, min: 0, max: 200, step: 1 },
            { key: "duration", label: "Seconds", type: "number", value: 1.5, min: 0.2, max: 10, step: 0.1 }
        ]
    },
    wait: { name: "Wait", fields: [{ key: "seconds", label: "Seconds", type: "number", value: 1, min: 0.1, max: 30, step: 0.1 }] },
    kill: { name: "Kill player", fields: [] },
    finish: { name: "Finish level", fields: [] }
});

/**
 * Background themes a level can use.
 *
 * @type {ReadonlyArray<[string, string]>}
 */
export const THEME_OPTIONS = Object.freeze([["forest", "Forest night"], ["city", "Forsaken City"], ["resort", "Celestial Resort"], ["summit", "Summit"]]);

/**
 * Music a level can play, by id: label and file.
 *
 * @type {Readonly<Record<string, { name: string, path: string|null }>>}
 */
export const MUSIC_OPTIONS = Object.freeze({
    theme: { name: "Main theme", path: "assets/soundTrack/main theme.mp3" },
    golden: { name: "Golden", path: "assets/soundTrack/music/golden.mp3" },
    anxiety: { name: "Anxiety", path: "assets/soundTrack/music/anxiety.mp3" },
    none: { name: "No music", path: null }
});

/**
 * Weather presets.
 *
 * @type {Readonly<Record<string, { type: string, density?: number, wind?: number, gusts?: number }>>}
 */
export const WEATHER_PRESETS = Object.freeze({
    none: { type: "none" },
    snow: { type: "snow", density: 0.8, wind: -30 },
    heavy: { type: "snow", density: 1.4, wind: -70, gusts: 1.2 },
    blizzard: { type: "blizzard", density: 1, wind: 140, gusts: 1.3 }
});

/**
 * Default values for every field in a spec list.
 *
 * @param {FieldSpec[]} fields - Field specs.
 * @returns {Record<string, *>} Defaults by key.
 */
export function fieldDefaults(fields) {
    const out = {};
    for (const field of fields) out[field.key] = structuredClone(field.value);
    return out;
}

/**
 * Creates an empty level.
 *
 * @param {number} [width=60] - Width in cells.
 * @param {number} [height=24] - Height in cells.
 * @returns {LevelData} The new level.
 */
export function createLevel(width = 60, height = 24) {
    const rows = [];
    for (let y = 0; y < height; y++) rows.push(y >= height - 3 ? "s".repeat(width) : ".".repeat(width));
    return {
        format: LEVEL_FORMAT,
        version: LEVEL_VERSION,
        id: newId("level"),
        name: "Untitled level",
        author: "",
        width,
        height,
        settings: { theme: "forest", weather: "snow", music: "theme", timeLimit: 300, lives: 5, dashes: 1 },
        tiles: rows,
        entities: [
            { id: newId("e"), type: "spawn", x: 3, y: height - 4 },
            { id: newId("e"), type: "goal", x: width - 4, y: height - 4 }
        ],
        events: []
    };
}

/**
 * A level as stored and exported.
 *
 * @typedef {object} LevelData
 * @property {string} format - Always {@link LEVEL_FORMAT}.
 * @property {number} version - Format version.
 * @property {string} id - Unique id.
 * @property {string} name - Display name.
 * @property {string} author - Author name.
 * @property {number} width - Width in cells.
 * @property {number} height - Height in cells.
 * @property {{ theme: string, weather: string, music: string, timeLimit: number, lives: number, dashes: number }} settings - Play settings.
 * @property {string[]} tiles - One string per row; see {@link TILE_TYPES}, "." for air.
 * @property {Array<{ id: string, type: string, x: number, y: number } & Record<string, *>>} entities - Placed objects.
 * @property {Array<{ id: string, name: string, once: boolean, trigger: { type: string } & Record<string, *>, actions: Array<{ type: string } & Record<string, *>> }>} events - Scripted events.
 */

/**
 * Creates a short random id.
 *
 * @param {string} prefix - Id prefix.
 * @returns {string} The id.
 */
export function newId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

/**
 * Clamps a number into a range, falling back when it is not a number.
 *
 * @param {*} value - Input.
 * @param {number} min - Lower bound.
 * @param {number} max - Upper bound.
 * @param {number} fallback - Value used for non numbers.
 * @returns {number} The clamped number.
 */
function clampNumber(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

/**
 * Copies the known fields of a spec list from raw data, applying defaults
 * and limits.
 *
 * @param {FieldSpec[]} fields - Field specs.
 * @param {Record<string, *>} raw - Raw values.
 * @returns {Record<string, *>} Clean values.
 */
function cleanFields(fields, raw) {
    const out = {};
    for (const field of fields) {
        const value = raw?.[field.key];
        if (field.type === "number") {
            out[field.key] = clampNumber(value, field.min ?? -Infinity, field.max ?? Infinity, field.value);
        } else if (field.type === "checkbox") {
            out[field.key] = value === undefined ? field.value : Boolean(value);
        } else if (field.type === "select") {
            out[field.key] = field.options.some(([option]) => option === value) ? value : field.value;
        } else if (field.type === "lines") {
            out[field.key] = Array.isArray(value) ? value.slice(0, 50).map((line) => ({
                speaker: SPEAKER_OPTIONS.some(([id]) => id === line?.speaker) ? line.speaker : "madeline",
                emotion: typeof line?.emotion === "string" ? line.emotion.slice(0, 20) : "normal",
                text: String(line?.text ?? "").slice(0, 400)
            })) : [];
        } else {
            out[field.key] = String(value ?? field.value ?? "").slice(0, 400);
        }
    }
    return out;
}

/**
 * Checks and normalises a level loaded from storage or a file.
 *
 * Unknown objects, triggers and actions are dropped, sizes and numbers are
 * clamped and the tile rows are padded to the level size, so anything that
 * passes can be built safely.
 *
 * @param {*} raw - Parsed JSON.
 * @returns {LevelData} A clean level.
 * @throws {Error} When the data is not a level file at all.
 */
export function normalizeLevel(raw) {
    if (!raw || typeof raw !== "object") throw new Error("The file does not contain a level.");
    if (raw.format !== LEVEL_FORMAT) throw new Error("This JSON file is not a Celeste Remake level.");
    if (!Array.isArray(raw.tiles)) throw new Error("The level has no tile rows.");
    const width = Math.round(clampNumber(raw.width, LEVEL_LIMITS.minWidth, LEVEL_LIMITS.maxWidth, 60));
    const height = Math.round(clampNumber(raw.height, LEVEL_LIMITS.minHeight, LEVEL_LIMITS.maxHeight, 24));
    const tiles = [];
    for (let y = 0; y < height; y++) {
        const source = typeof raw.tiles[y] === "string" ? raw.tiles[y] : "";
        let row = "";
        for (let x = 0; x < width; x++) {
            const ch = source[x];
            row += ch && TILE_TYPES[ch] ? ch : ".";
        }
        tiles.push(row);
    }
    const settings = raw.settings || {};
    const entities = [];
    const seen = new Set();
    for (const entity of Array.isArray(raw.entities) ? raw.entities : []) {
        const spec = ENTITY_TYPES[entity?.type];
        if (!spec) continue;
        const x = Math.round(clampNumber(entity.x, 0, width - 1, 0));
        const y = Math.round(clampNumber(entity.y, 0, height - 1, 0));
        if (spec.unique && seen.has(entity.type)) continue;
        seen.add(entity.type);
        const id = typeof entity.id === "string" && entity.id ? entity.id.slice(0, 40) : newId("e");
        entities.push({ id, type: entity.type, x, y, ...cleanFields(spec.fields, entity) });
    }
    const events = [];
    for (const event of Array.isArray(raw.events) ? raw.events : []) {
        const triggerSpec = TRIGGER_TYPES[event?.trigger?.type];
        if (!triggerSpec) continue;
        const trigger = { type: event.trigger.type, ...cleanFields(triggerSpec.fields, event.trigger) };
        if (trigger.type === "enter") {
            trigger.x = Math.round(clampNumber(event.trigger.x, 0, width - 1, 0));
            trigger.y = Math.round(clampNumber(event.trigger.y, 0, height - 1, 0));
            trigger.w = Math.round(clampNumber(event.trigger.w, 1, width - trigger.x, 2));
            trigger.h = Math.round(clampNumber(event.trigger.h, 1, height - trigger.y, 2));
        }
        const actions = [];
        for (const action of Array.isArray(event.actions) ? event.actions : []) {
            const actionSpec = ACTION_TYPES[action?.type];
            if (actionSpec) actions.push({ type: action.type, ...cleanFields(actionSpec.fields, action) });
        }
        events.push({
            id: typeof event.id === "string" && event.id ? event.id.slice(0, 40) : newId("ev"),
            name: String(event.name ?? "Event").slice(0, 60),
            once: event.once !== false,
            trigger,
            actions
        });
    }
    return {
        format: LEVEL_FORMAT,
        version: LEVEL_VERSION,
        id: typeof raw.id === "string" && raw.id ? raw.id.slice(0, 60) : newId("level"),
        name: String(raw.name ?? "Untitled level").slice(0, 60) || "Untitled level",
        author: String(raw.author ?? "").slice(0, 60),
        width,
        height,
        settings: {
            theme: THEME_OPTIONS.some(([id]) => id === settings.theme) ? settings.theme : "forest",
            weather: WEATHER_PRESETS[settings.weather] ? settings.weather : "snow",
            music: MUSIC_OPTIONS[settings.music] ? settings.music : "theme",
            timeLimit: Math.round(clampNumber(settings.timeLimit, 30, 3600, 300)),
            lives: Math.round(clampNumber(settings.lives, 1, 99, 5)),
            dashes: Math.round(clampNumber(settings.dashes, 0, 2, 1))
        },
        tiles,
        entities,
        events
    };
}

/**
 * Problems that stop a level from being played.
 *
 * @param {LevelData} level - Level to check.
 * @returns {string[]} Human readable problems, empty when the level is playable.
 */
export function levelProblems(level) {
    const problems = [];
    const spawn = level.entities.find((entity) => entity.type === "spawn");
    if (!spawn) problems.push("Place a player start.");
    if (!level.entities.some((entity) => entity.type === "goal")) problems.push("Place a goal flag so the level can be finished.");
    if (spawn && level.tiles[spawn.y]?.[spawn.x] !== ".") problems.push("The player start is inside a block.");
    return problems;
}
