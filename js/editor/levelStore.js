import { readJson, writeJson } from "../core/storage.js";
import { newId, normalizeLevel } from "../levels/levelFormat.js";

const KEY = "celeste-remake.levels";

/**
 * Summary of a saved level shown in the level list.
 *
 * @typedef {object} SavedLevelInfo
 * @property {string} id - Level id.
 * @property {string} name - Level name.
 * @property {number} width - Width in cells.
 * @property {number} height - Height in cells.
 * @property {number} updated - Last save time in milliseconds.
 */

/**
 * Reads every saved level, dropping entries that no longer parse.
 *
 * @returns {Array<{ updated: number, level: import("../levels/levelFormat.js").LevelData }>} Saved levels, newest first.
 */
function readAll() {
    const stored = readJson(KEY, []);
    const out = [];
    for (const entry of Array.isArray(stored) ? stored : []) {
        try {
            out.push({ updated: Number(entry.updated) || 0, level: normalizeLevel(entry.level) });
        } catch {
            continue;
        }
    }
    return out.sort((a, b) => b.updated - a.updated);
}

/**
 * Lists saved levels.
 *
 * @returns {SavedLevelInfo[]} Summaries, newest first.
 */
export function listLevels() {
    return readAll().map(({ updated, level }) => ({ id: level.id, name: level.name, width: level.width, height: level.height, updated }));
}

/**
 * Loads one saved level.
 *
 * @param {string} id - Level id.
 * @returns {import("../levels/levelFormat.js").LevelData|null} The level, or null when it is not saved.
 */
export function loadLevel(id) {
    return readAll().find((entry) => entry.level.id === id)?.level ?? null;
}

/**
 * Saves a level, replacing an older copy with the same id.
 *
 * @param {import("../levels/levelFormat.js").LevelData} level - Level to save.
 * @returns {boolean} True when it was written; false when storage is full or unavailable.
 */
export function saveLevel(level) {
    const all = readAll().filter((entry) => entry.level.id !== level.id);
    all.unshift({ updated: Date.now(), level: normalizeLevel(level) });
    return writeJson(KEY, all);
}

/**
 * Deletes a saved level.
 *
 * @param {string} id - Level id.
 * @returns {void}
 */
export function deleteLevel(id) {
    writeJson(KEY, readAll().filter((entry) => entry.level.id !== id));
}

/**
 * Copies a level under a new id and name.
 *
 * @param {import("../levels/levelFormat.js").LevelData} level - Source level.
 * @param {string} [suffix=" (copy)"] - Text added to the name.
 * @returns {import("../levels/levelFormat.js").LevelData} The copy.
 */
export function duplicateLevel(level, suffix = " (copy)") {
    const copy = structuredClone(level);
    copy.id = newId("level");
    copy.name = `${level.name}${suffix}`.slice(0, 60);
    return copy;
}

/**
 * Downloads a level as a JSON file.
 *
 * @param {import("../levels/levelFormat.js").LevelData} level - Level to export.
 * @returns {void}
 */
export function exportLevel(level) {
    const slug = level.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "level";
    const blob = new Blob([`${JSON.stringify(normalizeLevel(level), null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Asks the user for a JSON file and reads a level from it.
 *
 * @returns {Promise<import("../levels/levelFormat.js").LevelData|null>} The level, or null when the dialog was cancelled.
 * @throws {Error} When the file is not valid JSON or not a level.
 */
export function importLevel() {
    return new Promise((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.addEventListener("change", async () => {
            const file = input.files?.[0];
            if (!file) {
                resolve(null);
                return;
            }
            try {
                const text = await file.text();
                let raw;
                try {
                    raw = JSON.parse(text);
                } catch {
                    throw new Error("That file is not valid JSON.");
                }
                resolve(normalizeLevel(raw));
            } catch (error) {
                reject(error);
            }
        });
        input.click();
    });
}
