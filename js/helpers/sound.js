import { audio } from "../systems/audio.js";

/**
 * Common sound effect paths used across the game.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const SFX = Object.freeze({
    jump: "assets/soundTrack/all_sounds/Madeline/jump.wav",
    wallJumpLeft: "assets/soundTrack/all_sounds/Madeline/jump_wall_left.wav",
    wallJumpRight: "assets/soundTrack/all_sounds/Madeline/jump_wall_right.wav",
    superJump: "assets/soundTrack/all_sounds/Madeline/jump_super.wav",
    dashLeft: "assets/soundTrack/all_sounds/Madeline/dash_red_left.wav",
    dashRight: "assets/soundTrack/all_sounds/Madeline/dash_red_right.wav",
    dashPinkLeft: "assets/soundTrack/all_sounds/Madeline/dash_pink_left.wav",
    dashPinkRight: "assets/soundTrack/all_sounds/Madeline/dash_pink_right.wav",
    death: "assets/soundTrack/all_sounds/Madeline/death.wav",
    predeath: "assets/soundTrack/all_sounds/Madeline/predeath.wav",
    revive: "assets/soundTrack/all_sounds/Madeline/revive.wav",
    wallslide: "assets/soundTrack/all_sounds/Madeline/wallslide_general.wav",
    climbLedge: "assets/soundTrack/all_sounds/Madeline/climb_ledge_01.wav",
    grabLetGo: "assets/soundTrack/all_sounds/Madeline/grab_letgo_01.wav",
    strawberry: "assets/soundTrack/strawBerry.wav",
    strawberryGold: "assets/tiles/celeste/strawberry_gold_detach.wav",
    breakBridge: "assets/soundTrack/breakBridge.wav",
    crack: "assets/soundTrack/crack.wav",
    cart: "assets/soundTrack/cart.wav",
    quack: "assets/soundTrack/quack.wav",
    squawk: "assets/soundTrack/bird/squawk.wav",
    sit: "assets/soundTrack/all_sounds/Madeline/campfire_sit.wav",
    stand: "assets/soundTrack/all_sounds/Madeline/campfire_stand.wav",
    summitStart: "assets/soundTrack/all_sounds/Madeline/summit_areastart.wav",
    summitFly: "assets/soundTrack/all_sounds/Madeline/summit_flytonext.wav",
    summitSit: "assets/soundTrack/all_sounds/Madeline/summit_sit.wav",
    golden: "assets/soundTrack/all_sounds/Madeline/death_goldenberry.wav",
    screenEntry: "assets/soundTrack/all_sounds/Madeline/screenentry_gran.wav",
    hairCharged: "assets/soundTrack/all_sounds/Madeline/core_haircharged.wav",
    mirrorLanding: "assets/soundTrack/all_sounds/Madeline/mirrortemple_landing.wav",
    theme: "assets/soundTrack/main theme.mp3",
    musicGolden: "assets/soundTrack/music/golden.mp3",
    musicAnxiety: "assets/soundTrack/music/anxiety.mp3"
});

/**
 * Plays a sound effect through the shared mixer.
 *
 * @param {string} [path=""] - Audio URL.
 * @param {import("../systems/audio.js").SfxOptions} [options] - Playback options.
 * @returns {Promise<{ stop: Function }|null>} Handle to stop the sound.
 */
export function playSound(path = "", options = {}) {
    return audio.play(path, options);
}
