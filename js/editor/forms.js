import { SPEAKER_OPTIONS } from "../levels/levelFormat.js";

/**
 * Portrait emotions offered for each speaker in dialogue lines.
 *
 * @type {Readonly<Record<string, string[]>>}
 */
export const SPEAKER_EMOTIONS = Object.freeze({
    madeline: ["normal", "angry", "deadpan", "determined", "distracted", "panic", "peaceful", "sad", "sadder", "surprised", "together", "upset"],
    badeline: ["normal", "angry", "deadpan", "determined", "distracted", "panic", "sad", "surprised", "upset"],
    granny: ["normal", "laugh"],
    theo: ["normal", "excited", "nailedIt", "serious", "thinking", "worried", "wtf", "yolo"],
    oshiro: ["normal", "nervous", "serious", "dramatic", "losing", "sideHappy", "sideSuspicious", "sideWorried"],
    narrator: ["normal"]
});

/**
 * Creates an element with a class and optional text.
 *
 * @param {string} tag - Tag name.
 * @param {string} [className] - CSS class.
 * @param {string} [text] - Text content.
 * @returns {HTMLElement} The element.
 */
export function el(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
}

/**
 * Creates a button.
 *
 * @param {string} label - Button text.
 * @param {() => void} onClick - Click handler.
 * @param {string} [className="ed-btn"] - CSS class.
 * @param {string} [title] - Tooltip.
 * @returns {HTMLButtonElement} The button.
 */
export function button(label, onClick, className = "ed-btn", title = "") {
    const node = el("button", className, label);
    node.type = "button";
    if (title) node.title = title;
    node.addEventListener("click", (event) => {
        event.preventDefault();
        onClick();
    });
    return node;
}

/**
 * Creates a select element.
 *
 * @param {Array<[string, string]>} options - Value and label pairs.
 * @param {string} value - Selected value.
 * @param {(value: string) => void} onChange - Change handler.
 * @returns {HTMLSelectElement} The select.
 */
export function select(options, value, onChange) {
    const node = el("select", "ed-input");
    for (const [optionValue, label] of options) {
        const option = el("option", "", label);
        option.value = optionValue;
        node.appendChild(option);
    }
    node.value = value;
    node.addEventListener("change", () => onChange(node.value));
    return node;
}

/**
 * Wraps an input with a label.
 *
 * @param {string} label - Label text.
 * @param {HTMLElement} input - The input.
 * @returns {HTMLLabelElement} The labelled row.
 */
export function row(label, input) {
    const node = el("label", "ed-field");
    node.append(el("span", "ed-field-label", label), input);
    return node;
}

/**
 * Builds inputs for a list of field specs, writing changes into a target
 * object and reporting them.
 *
 * @param {import("../levels/levelFormat.js").FieldSpec[]} fields - Field specs.
 * @param {Record<string, *>} target - Object being edited.
 * @param {() => void} onChange - Called after every change.
 * @param {{ targets?: Array<[string, string]> }} [context] - Choices for target fields.
 * @returns {HTMLElement} Container with every input.
 */
export function fieldInputs(fields, target, onChange, context = {}) {
    const box = el("div", "ed-fields");
    for (const field of fields) {
        if (field.type === "lines") {
            box.appendChild(linesEditor(target, field.key, onChange));
            continue;
        }
        let input;
        if (field.type === "select") {
            input = select(field.options, target[field.key], (value) => {
                target[field.key] = value;
                onChange();
            });
        } else if (field.type === "target") {
            const choices = context.targets?.length ? context.targets : [["", "No falling blocks set to wait for an event"]];
            input = select([["", "Choose a block"], ...choices], target[field.key] || "", (value) => {
                target[field.key] = value;
                onChange();
            });
        } else if (field.type === "checkbox") {
            input = el("input", "ed-check");
            input.type = "checkbox";
            input.checked = Boolean(target[field.key]);
            input.addEventListener("change", () => {
                target[field.key] = input.checked;
                onChange();
            });
        } else if (field.type === "textarea") {
            input = el("textarea", "ed-input");
            input.value = target[field.key] ?? "";
            input.addEventListener("input", () => {
                target[field.key] = input.value;
                onChange();
            });
        } else {
            input = el("input", "ed-input");
            input.type = field.type === "number" ? "number" : "text";
            if (field.type === "number") {
                input.step = String(field.step ?? 1);
                if (field.min !== undefined) input.min = String(field.min);
                if (field.max !== undefined) input.max = String(field.max);
            }
            input.value = target[field.key] ?? "";
            input.addEventListener("input", () => {
                if (field.type === "number") {
                    const number = Number(input.value);
                    if (input.value === "" || !Number.isFinite(number)) return;
                    target[field.key] = Math.min(field.max ?? Infinity, Math.max(field.min ?? -Infinity, number));
                } else {
                    target[field.key] = input.value;
                }
                onChange();
            });
        }
        box.appendChild(row(field.label, input));
    }
    return box;
}

/**
 * Editor for a list of dialogue lines with speaker, portrait and text.
 *
 * @param {Record<string, *>} target - Action holding the lines.
 * @param {string} key - Property with the line array.
 * @param {() => void} onChange - Called after every change.
 * @returns {HTMLElement} The editor.
 */
function linesEditor(target, key, onChange) {
    const box = el("div", "ed-lines");
    const render = () => {
        box.textContent = "";
        const lines = target[key];
        lines.forEach((line, index) => {
            const item = el("div", "ed-line");
            const head = el("div", "ed-line-head");
            const emotions = () => (SPEAKER_EMOTIONS[line.speaker] || ["normal"]).map((emotion) => [emotion, emotion]);
            let emotion = select(emotions(), line.emotion || "normal", (value) => {
                line.emotion = value;
                onChange();
            });
            const speaker = select(SPEAKER_OPTIONS.map(([id, name]) => [id, name]), line.speaker, (value) => {
                line.speaker = value;
                line.emotion = "normal";
                const replacement = select(emotions(), "normal", (next) => {
                    line.emotion = next;
                    onChange();
                });
                emotion.replaceWith(replacement);
                emotion = replacement;
                onChange();
            });
            head.append(speaker, emotion,
                button("↑", () => {
                    if (index === 0) return;
                    [lines[index - 1], lines[index]] = [lines[index], lines[index - 1]];
                    onChange();
                    render();
                }, "ed-btn ed-mini", "Move up"),
                button("✕", () => {
                    lines.splice(index, 1);
                    onChange();
                    render();
                }, "ed-btn ed-mini ed-danger", "Remove line"));
            const text = el("textarea", "ed-input ed-line-text");
            text.rows = 2;
            text.placeholder = "What they say";
            text.value = line.text;
            text.addEventListener("input", () => {
                line.text = text.value;
                onChange();
            });
            item.append(head, text);
            box.appendChild(item);
        });
        box.appendChild(button("+ Add line", () => {
            const last = lines[lines.length - 1];
            lines.push({ speaker: last?.speaker ?? "madeline", emotion: "normal", text: "" });
            onChange();
            render();
        }, "ed-btn ed-add"));
    };
    render();
    return box;
}
