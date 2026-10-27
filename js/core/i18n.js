import { events } from "./events.js";

/**
 * Description of a selectable language.
 *
 * @typedef {object} LanguageInfo
 * @property {string} code - BCP 47 language code.
 * @property {string} name - Native language name.
 * @property {{ x: number, y: number }} flag - Top-left corner of the flag in assets/icons/languages.png.
 * @property {string} [dir] - Text direction, "ltr" by default.
 */

/**
 * Languages with complete translations, using flags from the provided language sheet.
 *
 * @type {LanguageInfo[]}
 */
export const LANGUAGES = [
    { code: "en", name: "English", flag: { x: 1, y: 207 } },
    { code: "es", name: "Español", flag: { x: 1, y: 12 } },
    { code: "fr", name: "Français", flag: { x: 1, y: 77 } },
    { code: "de", name: "Deutsch", flag: { x: 1, y: 337 } },
    { code: "it", name: "Italiano", flag: { x: 1, y: 142 } },
    { code: "pt", name: "Português", flag: { x: 1, y: 467 } },
    { code: "ru", name: "Русский", flag: { x: 1, y: 402 } }
];

/** @type {Record<string, Record<string, string>>} */
const catalogs = {};

/** @type {string} */
let current = "en";

/**
 * Loads the string catalog of a language module on demand.
 *
 * @param {string} code - Language code.
 * @returns {Promise<Record<string, string>>} The loaded catalog.
 */
async function loadCatalog(code) {
    if (!catalogs[code]) {
        const module = await import(`../i18n/${code}.js`);
        catalogs[code] = module.default;
    }
    return catalogs[code];
}

/**
 * Picks the best supported language for the browser when none was chosen.
 *
 * @returns {string} A supported language code.
 */
export function detectLanguage() {
    const preferred = navigator.languages || [navigator.language || "en"];
    for (const tag of preferred) {
        const code = String(tag).toLowerCase().split("-")[0];
        if (LANGUAGES.some((language) => language.code === code)) return code;
    }
    return "en";
}

/**
 * Activates a language, loading its catalog and English as a fallback.
 *
 * @param {string} code - Language code.
 * @returns {Promise<void>} Resolves once the strings are available.
 */
export async function setLanguage(code) {
    const target = LANGUAGES.some((language) => language.code === code) ? code : "en";
    await loadCatalog("en");
    await loadCatalog(target);
    current = target;
    const info = LANGUAGES.find((language) => language.code === target);
    document.documentElement.lang = target;
    document.documentElement.dir = info?.dir || "ltr";
    translateDom(document);
    events.emit("language:change", target);
}

/**
 * Returns the active language code.
 *
 * @returns {string} The language code.
 */
export function getLanguage() {
    return current;
}

/**
 * Translates a key, substituting {name} placeholders with parameters.
 *
 * @param {string} key - String key.
 * @param {Record<string, string|number>} [params] - Placeholder values.
 * @returns {string} The translated string, or the key when it is missing everywhere.
 */
export function t(key, params) {
    const text = catalogs[current]?.[key] ?? catalogs.en?.[key] ?? key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/**
 * Whether a translation exists for a key in English.
 *
 * @param {string} key - String key.
 * @returns {boolean} True when the key is defined.
 */
export function hasKey(key) {
    return Boolean(catalogs.en && key in catalogs.en);
}

/**
 * Updates every element under a root that declares data-i18n attributes.
 *
 * @param {ParentNode} root - Root element or document.
 * @returns {void}
 */
export function translateDom(root) {
    root.querySelectorAll("[data-i18n]").forEach((element) => {
        element.textContent = t(element.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-aria]").forEach((element) => {
        element.setAttribute("aria-label", t(element.dataset.i18nAria));
    });
}
