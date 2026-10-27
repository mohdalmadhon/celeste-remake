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
 * @param {boolean} [keepPhase=false] - Continue from the same point of the cycle instead of frame 0, for clips that blend into each other such as walk and run.
 * @returns {void}
 */
export function playAnimation(entity, sprite, restart = false, keepPhase = false) {
    const animation = entity.components.animation;
    if (!animation) return;
    const state = animation.state;
    if (state.sprite === sprite && !restart) return;
    const previous = animation.sprites[state.sprite];
    const next = animation.sprites[sprite];
    let frame = 0;
    let timer = 0;
    if (keepPhase && previous && next) {
        const previousCount = frameCount(previous);
        const phase = (state.frame + Math.min(1, state.timer * previous.fps)) / previousCount;
        const position = phase * frameCount(next);
        frame = Math.floor(position) % frameCount(next);
        timer = (position - Math.floor(position)) / next.fps;
    }
    state.sprite = sprite;
    state.frame = frame;
    state.timer = timer;
    state.finished = false;
    applyFrame(entity);
}

/**
 * Number of frames in an animation.
 *
 * @param {AnimationData} data - Animation data.
 * @returns {number} Frame count.
 */
export function frameCount(data) {
    return data.frames ? data.frames.length : data.frameCount;
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
