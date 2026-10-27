/**
 * Reads and parses a JSON value from localStorage.
 *
 * @param {string} key - Storage key.
 * @param {*} fallback - Value returned when nothing valid is stored.
 * @returns {*} The parsed value or the fallback.
 */
export function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

/**
 * Serialises and writes a value to localStorage.
 *
 * @param {string} key - Storage key.
 * @param {*} value - Value to store.
 * @returns {boolean} True when the value was written.
 */
export function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

/**
 * Removes a stored value.
 *
 * @param {string} key - Storage key.
 * @returns {void}
 */
export function removeKey(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        return;
    }
}
