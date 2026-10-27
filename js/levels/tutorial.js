import { addAnimation, playAnimation } from "../components/animation.js";
import { game } from "../core/game.js";
import { Npc, Strawberry, CheckpointFlag, FallingBlock } from "../entities/props.js";
import { PlayerState } from "../entities/player.js";
import { PromptSign } from "../helpers/sign.js";
import { SFX } from "../helpers/sound.js";
import { Level } from "../level.js";
import { audio } from "../systems/audio.js";
import { input } from "../systems/input.js";
import { buildFromAscii, buildFromJson, groundAt, MATERIALS } from "./builder.js";

/**
 * Creates the bird that teaches climbing and dashing.
 *
 * @param {number} x - Left edge.
 * @param {number} y - Top edge.
 * @returns {Npc} The bird.
 */
export function createBird(x, y) {
    const bird = new Npc("bird", { x, y }, { width: 64, height: 50 }, "./assets/bird.png", {
        frameWidth: 64, frameHeight: 50
    });
    addAnimation(bird, "idle", { row: 0, startFrame: 0, frameCount: 1, fps: 1 });
    addAnimation(bird, "peck", { row: 0, frames: [0, 1, 2, 1, 0], startFrame: 0, frameCount: 5, fps: 10, loop: false, next: "idle" });
    addAnimation(bird, "squawk", { row: 0, startFrame: 7, frameCount: 7, fps: 14, loop: false, next: "idle" });
    addAnimation(bird, "fly", { row: 1, startFrame: 0, frameCount: 4, fps: 12 });
    addAnimation(bird, "flyUp", { row: 2, startFrame: 0, frameCount: 12, fps: 14 });
    addAnimation(bird, "hover", { row: 3, startFrame: 0, frameCount: 6, fps: 10 });
    playAnimation(bird, "idle");
    bird.facing = -1;
    return bird;
}

/**
 * Creates Granny with her idle, laugh and walk clips.
 *
 * @param {number} x - Left edge.
 * @param {number} y - Top edge.
 * @returns {Npc} Granny.
 */
export function createGranny(x, y) {
    const granny = new Npc("granny", { x, y }, { width: 132, height: 132 }, "./assets/generated/sprites/granny.png", {
        frameWidth: 66, frameHeight: 66, scale: 2, sheetWidth: 1848, sheetHeight: 264
    });
    granny.elem.style.transformOrigin = "50% 100%";
    addAnimation(granny, "idle", { row: 0, startFrame: 0, frameCount: 7, fps: 7 });
    addAnimation(granny, "laugh", { row: 1, startFrame: 0, frameCount: 9, fps: 10 });
    addAnimation(granny, "talk", { row: 2, startFrame: 0, frameCount: 28, fps: 12 });
    addAnimation(granny, "walk", { row: 3, startFrame: 0, frameCount: 7, fps: 9 });
    playAnimation(granny, "idle");
    granny.facing = -1;
    return granny;
}

/**
 * Prologue: the road to the mountain, Granny's house, the collapsing bridge
 * and the bird teaching the dash, built from the original level data.
 *
 * @type {import("../core/session.js").ChapterDefinition}
 */
export const prologue = {
    id: "prologue",
    number: 0,
    nameKey: "chapter.prologue.name",
    subtitleKey: "chapter.prologue.subtitle",
    art: "./assets/generated/checkpoints/prologue.png",
    icon: "flag",
    timeLimit: 300,
    lives: 5,
    strawberries: 2,
    music: SFX.theme,
    musicVolume: 0.45,
    ambience: "wind",
    weather: { type: "snow", density: 0.7, wind: -25 },
    parallax: "forest",
    checkpointNames: { climb: "checkpoint.prologue.climb", granny: "checkpoint.prologue.granny", bridge: "checkpoint.prologue.bridge" },

    /**
     * Builds the Prologue.
     *
     * @param {import("../core/session.js").ChapterContext} context - Build context.
     * @returns {Promise<import("../core/session.js").ChapterRuntime>} The live chapter.
     */
    async build(context) {
        const data = await (await fetch("./js/data/levels.json")).json();
        const level = new Level({ width: 7200, height: 700 }, context.world, "prologue");
        const special = buildFromJson(level, data.tutorial.tiles);
        level.cameraBounds = { left: 0, top: -150, right: 7240, bottom: 640 };
        level.killY = 720;
        const world = level.world;

        const patches = [
            { x: 550, y: 320, rows: ["dd"] },
            { x: 950, y: 350, rows: ["d"] },
            { x: 1350, y: 370, rows: ["dd"] },
            { x: 1880, y: 410, rows: ["dd"] },
            { x: 2060, y: 380, rows: ["dd"] },
            { x: 2580, y: 290, rows: ["ss"] }
        ];
        for (const patch of patches) {
            buildFromAscii(level, patch.rows, { d: MATERIALS.dirt, s: MATERIALS.snow }, { x: patch.x, y: patch.y, edgeSolid: false });
        }

        const wallLeft = { x: -50, y: -800, w: 50, h: 1600, kind: "solid", active: true, climbable: false, cells: [] };
        world.add(wallLeft);

        const iceParts = [
            { x: 0, y: 0, w: 50, h: 50, path: "assets/tiles/celeste/blueIceEdgeLeft.png" },
            { x: 49, y: 0, w: 50, h: 50, path: "assets/tiles/celeste/blueIce.png" },
            { x: 98, y: 0, w: 50, h: 50, path: "assets/tiles/celeste/blueIceEdgeRight.png" },
            { x: 0, y: 49, w: 50, h: 50, path: "assets/tiles/celeste/blueIceEdgeLeftBottom.png" },
            { x: 49, y: 49, w: 50, h: 50, path: "assets/tiles/celeste/blueIceDown.png" },
            { x: 98, y: 49, w: 50, h: 50, path: "assets/tiles/celeste/blueIceEdgeRightBototm.png" }
        ];
        const iceTrap = new FallingBlock({ x: 1100, y: -60, w: 148, h: 99, parts: iceParts }, { triggerOnTouch: false, lands: true, shakeTime: 0.25, surface: "ice" });
        level.addEntity(iceTrap);
        world.add(iceTrap.body);

        const bridge = [];
        for (const tile of special) {
            if (tile.type !== "fall") continue;
            const block = new FallingBlock(tile, { triggerOnTouch: false, shakeTime: 0.3, surface: "wood" });
            if (tile.name === "woodStick") {
                block.body.active = false;
                block.layer = "back";
            } else {
                world.add(block.body);
            }
            level.addEntity(block);
            bridge.push(block);
        }
        bridge.sort((a, b) => a.home.x - b.home.x);

        const climbBird = createBird(2360, 103);
        level.addEntity(climbBird);
        const dashBird = createBird(7300, -120);
        level.addEntity(dashBird);
        const granny = createGranny(4270, 182);
        level.addEntity(granny);

        const climbSign = new PromptSign(2380, 60, () => [
            [{ text: "sign.hold" }],
            [{ action: "left" }, { text: "sign.or" }, { action: "right" }, { text: "sign.or" }, { action: "grab" }],
            [{ text: "sign.toClimb" }]
        ]);
        level.addEntity(climbSign);
        const jumpSign = new PromptSign(420, 250, () => [
            [{ text: "sign.press" }, { action: "jump" }, { text: "sign.toJump" }],
            [{ text: "sign.holdHigher" }]
        ]);
        level.addEntity(jumpSign);
        const dashSign = new PromptSign(6820, 230, () => [
            [{ text: "sign.press" }],
            [{ action: "dash" }, { text: "sign.plus" }, { action: "right" }, { text: "sign.plus" }, { action: "up" }],
            [{ text: "sign.toDash" }]
        ]);
        level.addEntity(dashSign);

        const berries = [
            new Strawberry("prologue-berry-1", 1040, 230),
            new Strawberry("prologue-berry-2", 3550, 40)
        ];
        for (const berry of berries) {
            if (context.session.strawberries.has(berry.id)) continue;
            level.addEntity(berry);
            world.add(berry.body);
        }

        const checkpoints = {
            start: { x: 60, y: groundAt(world, 60, -200) },
            climb: { x: 2080, y: groundAt(world, 2080, 100) },
            granny: { x: 3950, y: groundAt(world, 3950, 100) },
            bridge: { x: 4700, y: groundAt(world, 4700, 100) }
        };
        for (const [id, point] of Object.entries(checkpoints)) {
            if (id === "start") continue;
            const flag = new CheckpointFlag(id, point.x, point.y, (reached) => context.session.reachCheckpoint(reached));
            if (Object.keys(checkpoints).indexOf(id) <= Object.keys(checkpoints).indexOf(context.session.checkpoint)) flag.activate();
            level.addEntity(flag);
            world.add(flag.body);
        }

        const state = { birdSquawked: false, grannyTalked: false, bridgeCollapsing: false, dashTaught: false, dashWaiting: false, ending: false, jumpSignShown: false };
        const director = game.ui.cutscenes;

        /**
         * Granny conversation in front of her house.
         *
         * @returns {Promise<void>} Resolves when the scene ends.
         */
        const grannyScene = async () => {
            state.grannyTalked = true;
            await director.run(async (cs) => {
                await cs.walk(4150, 0.5);
                cs.face(1);
                game.camera.focusOn(4260, 220, 1.2);
                await cs.say([
                    { speaker: "madeline", emotion: "normal", key: "prologue.granny.1" },
                    { speaker: "madeline", emotion: "distracted", key: "prologue.granny.2" }
                ]);
                playAnimation(granny, "talk");
                await cs.say([{ speaker: "granny", key: "prologue.granny.3" }]);
                playAnimation(granny, "idle");
                await cs.walk(4180, 0.3);
                cs.face(-1);
                await cs.wait(0.4);
                cs.face(1);
                await cs.say([{ speaker: "madeline", emotion: "upset", key: "prologue.granny.4" }]);
                playAnimation(granny, "laugh");
                audio.play("assets/soundTrack/grany/laugh.wav", { volume: 0.5 });
                await cs.say([
                    { speaker: "granny", emotion: "laugh", key: "prologue.granny.5" },
                    { speaker: "granny", emotion: "laugh", key: "prologue.granny.6" }
                ]);
                playAnimation(granny, "idle");
                await cs.say([{ speaker: "madeline", emotion: "angry", key: "prologue.granny.7" }]);
                playAnimation(granny, "talk");
                await cs.say([{ speaker: "granny", key: "prologue.granny.8" }]);
                playAnimation(granny, "laugh");
                audio.play("assets/soundTrack/grany/laugh.wav", { volume: 0.5 });
                await cs.say([{ speaker: "granny", emotion: "laugh", key: "prologue.granny.9" }]);
                await cs.wait(0.5);
                await cs.say([{ speaker: "madeline", emotion: "deadpan", key: "prologue.granny.10" }]);
                await cs.follow(0.6);
            }, {
                onEnd: () => {
                    playAnimation(granny, "idle");
                }
            });
        };

        /**
         * Ending: Madeline looks up at the mountain.
         *
         * @returns {Promise<void>} Resolves when the chapter completes.
         */
        const endingScene = async () => {
            state.ending = true;
            await director.run(async (cs) => {
                await cs.walk(7060, 0.45);
                cs.face(1);
                cs.pose("lookUp");
                audio.playMusic(SFX.theme, { fade: 3, volume: 0.8 });
                await cs.pan(7100, -380, 4);
                await cs.wait(0.5);
                game.ui.chapterCard?.("chapter.prologue.ending", "chapter.prologue.endingSub");
                await cs.wait(2.8);
            }, { keepCamera: true });
            context.session.ui.completeChapter();
        };

        return {
            level,
            checkpoints,
            preload: [SFX.jump, SFX.dashRight, SFX.dashLeft, SFX.death, SFX.predeath, SFX.revive, SFX.breakBridge, SFX.crack, SFX.squawk, SFX.quack],

            /**
             * Shows the opening camera move on a fresh start.
             *
             * @param {string} checkpoint - Starting checkpoint.
             * @param {boolean} fresh - Whether this is a new run.
             * @returns {void}
             */
            onStart(checkpoint, fresh) {
                game.player.dashEnabled = false;
                if (checkpoint !== "start") {
                    iceTrap.trigger();
                    iceTrap.position.y = 254 - 99;
                }
                if (checkpoint === "bridge") state.grannyTalked = true;
                if (checkpoint !== "start") state.birdSquawked = true;
                if (fresh) {
                    director.run(async (cs) => {
                        game.ui.chapterCard?.("chapter.prologue.name", "chapter.prologue.subtitle");
                        cs.pose("back");
                        await cs.wait(1.6);
                        cs.pose(null);
                        await cs.walk(150, 0.4);
                    }, { letterbox: false });
                }
            },

            /**
             * Level script.
             *
             * @returns {void}
             */
            step() {
                const player = game.player;
                if (!player || player.state === PlayerState.DEAD) return;
                const px = player.box.x + player.box.w / 2;
                const py = player.box.y + player.box.h;

                if (!state.jumpSignShown && px > 330) {
                    state.jumpSignShown = true;
                    jumpSign.show();
                }
                if (jumpSign.shown && px > 760) jumpSign.hide();

                if (px >= 1060 && iceTrap.status === "idle") {
                    iceTrap.trigger();
                    game.camera.shake(2, 0.3);
                }

                if (!state.birdSquawked && px >= 2150) {
                    state.birdSquawked = true;
                    playAnimation(climbBird, "squawk", true);
                    audio.play(SFX.squawk, { volume: 0.6 });
                    climbSign.show();
                }
                if (climbSign.shown && (py < 120 || px > 2600)) climbSign.hide();

                if (!state.grannyTalked && px >= 4080 && player.onGround) {
                    grannyScene();
                }

                for (const block of bridge) {
                    if (block.status === "idle" && px > block.home.x + block.dimensions.width + 70 && px < 6400) {
                        block.trigger(0.15);
                    }
                }
                if (!state.bridgeCollapsing && px >= 6450) {
                    state.bridgeCollapsing = true;
                    for (const block of bridge) {
                        if (block.status === "idle") block.trigger(Math.max(0, (block.home.x - 6400) / 1200));
                    }
                    game.camera.shake(3, 0.4);
                    dashBird.moveTo(7130, 180, 500);
                    playAnimation(dashBird, "fly");
                }
                if (state.bridgeCollapsing && dashBird.position.x <= 7131 && dashBird.components.animation.state.sprite === "fly") {
                    playAnimation(dashBird, "idle");
                }

                if (!state.dashTaught && state.bridgeCollapsing && py > 395 && px > 6560 && !state.dashWaiting) {
                    state.dashWaiting = true;
                    player.refillDash(false);
                    dashSign.show();
                    playAnimation(dashBird, "squawk", true);
                    audio.play(SFX.squawk, { volume: 0.7 });
                }
                if (state.dashWaiting) {
                    player.dashEnabled = true;
                    if (input.pressedWithin("dash", 0.1)) {
                        state.dashWaiting = false;
                        state.dashTaught = true;
                        dashSign.hide();
                    } else {
                        game.freezeTimer = 0.05;
                        player.velocity.y = Math.min(player.velocity.y, 60);
                    }
                }

                if (!state.ending && px >= 7010 && py <= 340 && player.onGround) {
                    endingScene();
                }
            },

            /**
             * Resets props after a death.
             *
             * @param {string} checkpoint - Respawn checkpoint.
             * @returns {void}
             */
            onRespawn(checkpoint) {
                if (checkpoint === "start" && iceTrap.status !== "landed") iceTrap.reset();
                if (checkpoint === "bridge") {
                    for (const block of bridge) block.reset();
                    state.bridgeCollapsing = false;
                    state.dashWaiting = false;
                    dashSign.hide();
                    dashBird.position.x = 7300;
                    dashBird.position.y = -120;
                    dashBird.snap();
                }
            },

            /**
             * Releases sign listeners.
             *
             * @returns {void}
             */
            onExit() {
                game.player.dashEnabled = true;
                climbSign.dispose();
                jumpSign.dispose();
                dashSign.dispose();
            }
        };
    }
};

/**
 * Kept for compatibility with the original module interface.
 *
 * @returns {typeof prologue} The prologue definition.
 */
export function createTutorial() {
    return prologue;
}
