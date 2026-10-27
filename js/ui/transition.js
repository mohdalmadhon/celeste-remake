/**
 * Full screen transitions: a diamond wipe for deaths and room changes and a
 * fade for menus and chapter starts.
 */
export class Transition {
    /** @type {HTMLElement} */
    root;
    /** @type {boolean} */
    covered = false;

    /**
     * @param {HTMLElement} root - Overlay element.
     */
    constructor(root) {
        this.root = root;
    }

    /**
     * Runs a CSS animation class and resolves when it finishes.
     *
     * @param {string} name - Animation class.
     * @param {number} duration - Duration in seconds.
     * @returns {Promise<void>} Resolves at the end.
     */
    #play(name, duration) {
        const root = this.root;
        root.style.setProperty("--duration", `${duration}s`);
        root.className = `transition ${name}`;
        return new Promise((resolve) => {
            setTimeout(resolve, duration * 1000);
        });
    }

    /**
     * Covers the screen.
     *
     * @param {"wipe"|"fade"} [style="wipe"] - Transition style.
     * @param {number} [duration=0.3] - Duration in seconds.
     * @returns {Promise<void>} Resolves when fully covered.
     */
    async cover(style = "wipe", duration = 0.3) {
        await this.#play(`${style}-in`, duration);
        this.covered = true;
        this.root.className = "transition covered";
    }

    /**
     * Reveals the screen.
     *
     * @param {"wipe"|"fade"} [style="wipe"] - Transition style.
     * @param {number} [duration=0.35] - Duration in seconds.
     * @returns {Promise<void>} Resolves when fully revealed.
     */
    async reveal(style = "wipe", duration = 0.35) {
        await this.#play(`${style}-out`, duration);
        this.covered = false;
        this.root.className = "transition";
    }

    /**
     * Instantly covers the screen without animating.
     *
     * @returns {void}
     */
    set() {
        this.covered = true;
        this.root.className = "transition covered";
    }
}
