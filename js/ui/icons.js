const SHEET = "./assets/icons/icons.png";
const SHEET_WIDTH = 459;
const SHEET_HEIGHT = 231;

/**
 * Source rectangles of the icons in assets/icons/icons.png.
 *
 * @type {Readonly<Record<string, [number, number, number, number]>>}
 */
export const ICONS = Object.freeze({
    clock: [9, 92, 44, 49],
    strawberry: [63, 88, 39, 54],
    skull: [119, 89, 55, 60],
    goldSkull: [189, 84, 62, 65],
    goldHeart: [262, 89, 56, 55],
    heart: [329, 89, 56, 55],
    blueHeart: [393, 89, 56, 55],
    whiteHeart: [9, 167, 49, 48],
    arrow: [77, 166, 43, 50],
    blueSkull: [136, 168, 50, 55],
    flag: [323, 14, 55, 55],
    flagGold: [392, 12, 56, 55],
    bird: [101, 9, 55, 56],
    tape: [172, 17, 64, 46],
    dash: [5, 20, 48, 37],
    climb: [54, 1, 39, 77]
});

/**
 * Creates an element showing one icon from the icon sheet.
 *
 * @param {keyof typeof ICONS} name - Icon name.
 * @param {number} [size=24] - Height of the icon in pixels.
 * @returns {HTMLSpanElement} The icon element.
 */
export function createIcon(name, size = 24) {
    const span = document.createElement("span");
    span.className = "icon";
    applyIcon(span, name, size);
    return span;
}

/**
 * Styles an element to show an icon from the sheet.
 *
 * @param {HTMLElement} element - Target element.
 * @param {keyof typeof ICONS} name - Icon name.
 * @param {number} [size=24] - Height in pixels.
 * @returns {void}
 */
export function applyIcon(element, name, size = 24) {
    const [x, y, w, h] = ICONS[name];
    const scale = size / h;
    element.style.width = `${Math.round(w * scale)}px`;
    element.style.height = `${size}px`;
    element.style.backgroundImage = `url("${SHEET}")`;
    element.style.backgroundSize = `${SHEET_WIDTH * scale}px ${SHEET_HEIGHT * scale}px`;
    element.style.backgroundPosition = `${-x * scale}px ${-y * scale}px`;
}
