/**
 * Width of the visible game viewport in pixels.
 *
 * @type {number}
 */
export const VIEW_WIDTH = 1200;

/**
 * Height of the visible game viewport in pixels.
 *
 * @type {number}
 */
export const VIEW_HEIGHT = 500;

/**
 * Size of one level tile in pixels.
 *
 * @type {number}
 */
export const TILE = 50;

/**
 * Duration of one fixed simulation step in seconds.
 *
 * @type {number}
 */
export const FIXED_STEP = 1 / 120;

/**
 * Longest frame delta the loop will simulate before clamping, in seconds.
 *
 * @type {number}
 */
export const MAX_FRAME_TIME = 0.1;

/**
 * Size of a spatial hash cell used by the collision world in pixels.
 *
 * @type {number}
 */
export const COLLISION_CELL = 100;

/**
 * Size of a render chunk used to cull static tiles in pixels.
 *
 * @type {{ width: number, height: number }}
 */
export const RENDER_CHUNK = { width: 600, height: 500 };

/**
 * Multiplier converting the original Celeste pixel units to this game's pixels.
 *
 * @type {number}
 */
export const SCALE = 4;

/**
 * Movement tuning for the player, derived from the original game's values.
 *
 * @typedef {object} PlayerPhysics
 * @property {number} maxRun - Top horizontal running speed.
 * @property {number} runAccel - Ground acceleration towards the target speed.
 * @property {number} runReduce - Deceleration applied when above the target speed.
 * @property {number} airMult - Fraction of ground acceleration available in the air.
 * @property {number} gravity - Downward acceleration.
 * @property {number} maxFall - Normal terminal falling speed.
 * @property {number} fastMaxFall - Terminal speed while holding down.
 * @property {number} fastFallAccel - Acceleration towards the fast fall speed.
 * @property {number} halfGravThreshold - Vertical speed band where gravity is halved at the apex.
 * @property {number} jumpSpeed - Initial upward jump speed.
 * @property {number} jumpHBoost - Horizontal boost added when jumping while moving.
 * @property {number} varJumpTime - Time the jump can be extended by holding the button.
 * @property {number} coyoteTime - Grace period to jump after leaving a ledge.
 * @property {number} jumpBuffer - Time a jump press is remembered before landing.
 * @property {number} wallJumpHSpeed - Horizontal speed of a wall jump.
 * @property {number} wallJumpForceTime - Time horizontal input is overridden after a wall jump.
 * @property {number} wallJumpCheck - Distance from a wall that still allows a wall jump.
 * @property {number} wallSlideMax - Maximum fall speed while sliding on a wall.
 * @property {number} climbUpSpeed - Upward climbing speed.
 * @property {number} climbDownSpeed - Downward climbing speed.
 * @property {number} climbSlipSpeed - Slide speed when stamina runs out.
 * @property {number} climbAccel - Acceleration applied while climbing.
 * @property {number} maxStamina - Climbing stamina capacity.
 * @property {number} climbUpCost - Stamina per second spent climbing up.
 * @property {number} climbStillCost - Stamina per second spent holding still.
 * @property {number} climbJumpCost - Stamina spent by a climb jump.
 * @property {number} dashSpeed - Speed during the dash.
 * @property {number} endDashSpeed - Speed the dash settles at when it ends.
 * @property {number} endDashUpMult - Upward end speed multiplier.
 * @property {number} dashTime - Duration of the dash.
 * @property {number} dashCooldown - Minimum time between dashes.
 * @property {number} dashRefillCooldown - Time after a dash before landing refills it.
 * @property {number} dashFreeze - Hit-stop applied when a dash begins.
 * @property {number} cornerCorrection - Maximum nudge around corners.
 * @property {number} superJumpH - Horizontal speed of a super jump.
 * @property {number} duckSuperJumpX - Horizontal multiplier of a hyper jump.
 * @property {number} duckSuperJumpY - Vertical multiplier of a hyper jump.
 */

/**
 * Player movement constants.
 *
 * @type {PlayerPhysics}
 */
export const PLAYER_PHYSICS = Object.freeze({
    maxRun: 90 * SCALE,
    runAccel: 1000 * SCALE,
    runReduce: 400 * SCALE,
    airMult: 0.65,
    gravity: 900 * SCALE,
    maxFall: 160 * SCALE,
    fastMaxFall: 240 * SCALE,
    fastFallAccel: 300 * SCALE,
    halfGravThreshold: 40 * SCALE,
    jumpSpeed: 105 * SCALE,
    jumpHBoost: 40 * SCALE,
    varJumpTime: 0.2,
    coyoteTime: 0.1,
    jumpBuffer: 0.1,
    wallJumpHSpeed: 130 * SCALE,
    wallJumpForceTime: 0.16,
    wallJumpCheck: 3 * SCALE,
    wallSlideMax: 20 * SCALE,
    climbUpSpeed: 45 * SCALE,
    climbDownSpeed: 80 * SCALE,
    climbSlipSpeed: 30 * SCALE,
    climbAccel: 900 * SCALE,
    maxStamina: 110,
    climbUpCost: 100 / 2.2,
    climbStillCost: 100 / 10,
    climbJumpCost: 110 / 4,
    dashSpeed: 240 * SCALE,
    endDashSpeed: 160 * SCALE,
    endDashUpMult: 0.75,
    dashTime: 0.15,
    dashCooldown: 0.2,
    dashRefillCooldown: 0.1,
    dashFreeze: 0.05,
    cornerCorrection: 4 * SCALE,
    superJumpH: 260 * SCALE,
    duckSuperJumpX: 1.25,
    duckSuperJumpY: 0.5
});
