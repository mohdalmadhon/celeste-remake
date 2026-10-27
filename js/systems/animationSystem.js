import { applyFrame } from "../components/animation.js";

/**
 * Advances sprite animations for every entity that has an animation component.
 *
 * @param {import("../entities/entity.js").Entity[]} entities - Entities to animate.
 * @param {number} dt - Step length in seconds.
 * @returns {void}
 */
export function animationSystem(entities, dt) {
    for (const entity of entities) {
        const animation = entity.components?.animation;
        if (!animation || entity.freeze) continue;
        const state = animation.state;
        const current = animation.sprites[state.sprite];
        if (!current || state.finished) continue;
        const count = current.frames ? current.frames.length : current.frameCount;
        if (count <= 1) {
            applyFrame(entity);
            continue;
        }
        state.timer += dt * (animation.speed ?? 1);
        const frameDuration = 1 / current.fps;
        let changed = false;
        while (state.timer >= frameDuration) {
            state.timer -= frameDuration;
            if (state.frame + 1 >= count) {
                if (current.loop === false) {
                    state.finished = true;
                    if (current.next && animation.sprites[current.next]) {
                        state.sprite = current.next;
                        state.frame = 0;
                        state.finished = false;
                    }
                    changed = true;
                    break;
                }
                state.frame = 0;
            } else {
                state.frame++;
            }
            changed = true;
        }
        if (changed) applyFrame(entity);
    }
}
