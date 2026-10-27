/**
 * Minimal publish/subscribe event bus shared by every system.
 */
export class EventBus {
    /** @type {Map<string, Set<Function>>} */
    #listeners = new Map();

    /**
     * Registers a listener for an event.
     *
     * @param {string} name - Event name.
     * @param {Function} listener - Callback receiving the event payload.
     * @returns {Function} A function that removes the listener.
     */
    on(name, listener) {
        if (!this.#listeners.has(name)) {
            this.#listeners.set(name, new Set());
        }
        this.#listeners.get(name).add(listener);
        return () => this.off(name, listener);
    }

    /**
     * Registers a listener that is removed after its first call.
     *
     * @param {string} name - Event name.
     * @param {Function} listener - Callback receiving the event payload.
     * @returns {Function} A function that removes the listener.
     */
    once(name, listener) {
        const remove = this.on(name, (payload) => {
            remove();
            listener(payload);
        });
        return remove;
    }

    /**
     * Removes a previously registered listener.
     *
     * @param {string} name - Event name.
     * @param {Function} listener - The listener to remove.
     * @returns {void}
     */
    off(name, listener) {
        this.#listeners.get(name)?.delete(listener);
    }

    /**
     * Calls every listener registered for an event.
     *
     * @param {string} name - Event name.
     * @param {*} [payload] - Data passed to listeners.
     * @returns {void}
     */
    emit(name, payload) {
        const listeners = this.#listeners.get(name);
        if (!listeners) return;
        for (const listener of [...listeners]) {
            listener(payload);
        }
    }
}

/**
 * Global event bus instance.
 *
 * @type {EventBus}
 */
export const events = new EventBus();
