import { events } from "../core/events.js";
import { t } from "../core/i18n.js";
import { settings } from "../core/settings.js";
import { keyLabel } from "../systems/input.js";

/**
 * Renders the control reference under the game using the current bindings.
 *
 * @param {HTMLElement} root - Guide container.
 * @returns {void}
 */
export function mountControlsGuide(root) {
    const render = () => {
        root.textContent = "";
        const entries = [
            ["guide.move", ["left", "right"]],
            ["guide.aim", ["up", "down"]],
            ["guide.jump", ["jump"]],
            ["guide.dash", ["dash"]],
            ["guide.climb", ["grab"]],
            ["guide.pause", ["pause"]]
        ];
        for (const [label, actions] of entries) {
            const item = document.createElement("div");
            item.className = "control-item";
            for (const action of actions) {
                const key = document.createElement("span");
                key.className = "keycap";
                key.textContent = keyLabel(settings.bindings[action]?.[0] || "?");
                item.appendChild(key);
            }
            const text = document.createElement("span");
            text.textContent = t(label);
            item.appendChild(text);
            root.appendChild(item);
        }
    };
    render();
    events.on("language:change", render);
    events.on("settings:change", render);
}
