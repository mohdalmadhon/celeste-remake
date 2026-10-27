import { events } from "./events.js";
import { readJson, removeKey, writeJson } from "./storage.js";

const STORAGE_KEY = "celeste-remake.save.v1";
const SAVE_VERSION = 1;

/**
 * Progress record for one chapter.
 *
 * @typedef {object} ChapterRecord
 * @property {boolean} completed - Whether the chapter has been finished.
 * @property {string[]} strawberries - Ids of strawberries collected in any run.
 * @property {number|null} bestTime - Fastest completion time in seconds.
 * @property {number} deaths - Total deaths across every attempt.
 * @property {number} bestScore - Highest score reached.
 */

/**
 * In-progress chapter state used by Continue.
 *
 * @typedef {object} SessionRecord
 * @property {string} chapter - Chapter id.
 * @property {string} checkpoint - Id of the last reached checkpoint.
 * @property {string[]} strawberries - Strawberries collected this run.
 * @property {number} timeRemaining - Remaining countdown time in seconds.
 * @property {number} elapsed - Time spent in the chapter in seconds.
 * @property {number} lives - Remaining lives.
 * @property {number} deaths - Deaths this run.
 */

/**
 * Persistent save file.
 *
 * @typedef {object} SaveData
 * @property {number} version - Save format version.
 * @property {boolean} started - Whether a game has been started.
 * @property {number} unlocked - Number of unlocked chapters.
 * @property {Record<string, ChapterRecord>} chapters - Per chapter progress.
 * @property {SessionRecord|null} session - Chapter currently in progress.
 */

/**
 * Creates an empty save file.
 *
 * @returns {SaveData} A fresh save.
 */
function createEmptySave() {
    return { version: SAVE_VERSION, started: false, unlocked: 1, chapters: {}, session: null };
}

/**
 * Live save data.
 *
 * @type {SaveData}
 */
export const save = createEmptySave();

/**
 * Loads the save file from storage, falling back to a fresh save when missing or invalid.
 *
 * @returns {SaveData} The loaded save.
 */
export function loadSave() {
    const stored = readJson(STORAGE_KEY, null);
    Object.assign(save, createEmptySave());
    if (stored && stored.version === SAVE_VERSION) {
        save.started = Boolean(stored.started);
        save.unlocked = Math.max(1, Number(stored.unlocked) || 1);
        save.chapters = stored.chapters && typeof stored.chapters === "object" ? stored.chapters : {};
        save.session = stored.session || null;
    }
    return save;
}

/**
 * Persists the save file.
 *
 * @returns {void}
 */
export function persistSave() {
    writeJson(STORAGE_KEY, save);
    events.emit("save:written", save);
}

/**
 * Wipes all progress and starts a fresh save.
 *
 * @returns {void}
 */
export function resetSave() {
    removeKey(STORAGE_KEY);
    Object.assign(save, createEmptySave());
    save.started = true;
    persistSave();
}

/**
 * Returns the progress record for a chapter, creating it on first access.
 *
 * @param {string} chapterId - Chapter id.
 * @returns {ChapterRecord} The chapter record.
 */
export function chapterRecord(chapterId) {
    if (!save.chapters[chapterId]) {
        save.chapters[chapterId] = { completed: false, strawberries: [], bestTime: null, deaths: 0, bestScore: 0 };
    }
    return save.chapters[chapterId];
}

/**
 * Whether there is progress the Continue option can resume.
 *
 * @returns {boolean} True when a game was started before.
 */
export function hasSave() {
    return save.started;
}
