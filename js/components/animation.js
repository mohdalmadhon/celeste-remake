/**
 * Frame range of one animation inside a sprite sheet.
 *
 * @typedef {object} AnimationData
 * @property {number} row - Sheet row.
 * @property {number} startFrame - First column.
 * @property {number} frameCount - Number of frames.
 * @property {number} fps - Playback speed.
 * @property {boolean} [loop=true] - Whether playback wraps around.
 * @property {number[]} [frames] - Explicit column order, overriding startFrame and frameCount.
 * @property {string} [next] - Animation to switch to when a non looping animation ends.
 */

/**
 * Registers an animation on an entity.
 *
 * @param {import("../entities/entity.js").Entity} entity - Target entity.
 * @param {string} spriteName - Animation name.
 * @param {AnimationData} [data] - Frame range.
 * @returns {void}
 */
export function addAnimation(entity, spriteName, data = { row: 0, startFrame: 0, frameCount: 1, fps: 10 }) {
    entity.components ??= {};
    entity.components.animation ??= {
        state: { frame: 0, sprite: "", timer: 0, finished: false },
        sprites: {}
    };
    if (entity.components.animation.sprites[spriteName]) {
        return;
    }
    entity.components.animation.sprites[spriteName] = { loop: true, ...data };
}

/**
 * Switches an entity to an animation, restarting it only when it changes.
 *
 * @param {import("../entities/entity.js").Entity} entity - Target entity.
 * @param {string} sprite - Animation name.
 * @param {boolean} [restart=false] - Restart even when already playing.
 * @returns {void}
 */
export function playAnimation(entity, sprite, restart = false) {
    const animation = entity.components.animation;
    if (!animation) return;
    if (animation.state.sprite === sprite && !restart) return;
    animation.state.sprite = sprite;
    animation.state.frame = 0;
    animation.state.timer = 0;
    animation.state.finished = false;
    applyFrame(entity);
}

/**
 * Returns the sheet column of the current frame.
 *
 * @param {AnimationData} data - Animation data.
 * @param {number} frame - Frame index inside the animation.
 * @returns {number} Sheet column.
 */
export function frameColumn(data, frame) {
    return data.frames ? data.frames[frame] : data.startFrame + frame;
}

/**
 * Updates the element background to show the current frame.
 *
 * @param {import("../entities/entity.js").Entity} entity - Target entity.
 * @returns {void}
 */
export function applyFrame(entity) {
    const animation = entity.components.animation;
    const data = animation?.sprites[animation.state.sprite];
    if (!data) return;
    entity.setFrame(frameColumn(data, animation.state.frame), data.row);
}
