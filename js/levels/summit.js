import { TILE } from "../core/constants.js";
import { game } from "../core/game.js";
import { BadelineChaser, Echo } from "../entities/echoes.js";
import { PlayerState } from "../entities/player.js";
import { Booster, CheckpointFlag, CrumbleBlock, DashCrystal, FallingBlock, Strawberry } from "../entities/props.js";
import { SFX } from "../helpers/sound.js";
import { Level } from "../level.js";
import { audio } from "../systems/audio.js";
import { spikeData, buildFromAscii, MATERIALS } from "./builder.js";
import { buildSummitMap } from "./maps/summitMap.js";

const ROCK = { strip: "./assets/generated/tiles/auto_dirt.png", surface: "dirt" };
const SPIKES = {
    "^": "./assets/tiles/celeste/spikes.png",
    "V": "./assets/tiles/celeste/spikeDown.png",
    "<": "./assets/tiles/celeste/spikesFlippedLeft.png",
    ">": "./assets/tiles/celeste/spikesFlippedRight.png"
};

/**
 * Chapter 3: The Summit's Forgotten Echoes. A final climb through wind,
 * ice and memory, where Madeline meets echoes of the people she met,
 * outruns the part of herself that doubts her, makes peace with it and
 * finishes the ascent with two dashes.
 *
 * @type {import("../core/session.js").ChapterDefinition}
 */
export const summit = {
    id: "summit-echoes",
    number: 3,
    nameKey: "chapter.summit.name",
    subtitleKey: "chapter.summit.subtitle",
    art: "./assets/generated/checkpoints/summit.png",
    timeLimit: 600,
    lives: 10,
    strawberries: 2,
    music: SFX.musicGolden,
    musicVolume: 0.55,
    ambience: "blizzard",
    weather: { type: "blizzard", density: 1, wind: 120, gusts: 1.2 },
    parallax: "summit",
    checkpointNames: { ridge: "checkpoint.summit.ridge", ice: "checkpoint.summit.ice", cave: "checkpoint.summit.cave", reflection: "checkpoint.summit.reflection", peak: "checkpoint.summit.peak" },

    /**
     * Builds the summit.
     *
     * @param {import("../core/session.js").ChapterContext} context - Build context.
     * @returns {Promise<import("../core/session.js").ChapterRuntime>} The live chapter.
     */
    async build(context) {
        const map = buildSummitMap();
        const width = map.rows[0].length * TILE;
        const height = map.rows.length * TILE;
        const level = new Level({ width, height }, context.world, "summit-echoes");
        const world = level.world;
        const markers = [];
        buildFromAscii(level, map.rows, { s: MATERIALS.snow, i: MATERIALS.ice, k: ROCK }, {
            edgeSolid: true,
            onMarker: (ch, x, y) => markers.push({ ch, x, y })
        });
        level.cameraBounds = { left: 0, top: -200, right: width, bottom: height };
        level.killY = height + 40;

        const resettable = [];
        const add = (entity) => {
            level.addEntity(entity);
            if (entity.body) world.add(entity.body);
            if (entity.reset) resettable.push(entity);
            return entity;
        };
        const checkpoints = {};
        const order = ["start", "ridge", "ice", "cave", "reflection", "peak"];
        const ids = ["peak", "reflection", "cave", "ice", "ridge"];
        const echoes = {};
        let doubtSpot = null;
        let peaceSpot = null;
        let flagSpot = null;
        let berryIndex = 0;
        const checkpointMarkers = markers.filter((m) => m.ch === "C").sort((a, b) => a.y - b.y);

        for (const marker of markers) {
            const { ch, x, y } = marker;
            const cx = x + TILE / 2;
            const cy = y + TILE / 2;
            if (SPIKES[ch]) {
                const spike = spikeData(SPIKES[ch], TILE, TILE);
                level.addTile({ x, y, w: TILE, h: TILE, src: SPIKES[ch], kind: "hazard", backgroundSize: "100% 100%", hitbox: spike.hitbox, body: { direction: spike.direction }, classes: ["spike"] });
                continue;
            }
            switch (ch) {
                case "=":
                    add(new CrumbleBlock({ x, y, w: TILE, h: TILE, path: "./assets/tiles/celeste/blueIcePlain.png" }, "ice"));
                    break;
                case "f":
                    add(new FallingBlock({ x, y, w: TILE, h: TILE, path: "./assets/tiles/celeste/dirtPlate.png" }, { shakeTime: 0.4, surface: "dirt" }));
                    break;
                case "*":
                    add(new DashCrystal(cx, cy));
                    break;
                case "o":
                    add(new Booster(cx, cy));
                    break;
                case "S": {
                    const id = `summit-berry-${++berryIndex}`;
                    if (!context.session.strawberries.has(id)) add(new Strawberry(id, cx, cy));
                    break;
                }
                case "C": {
                    const id = ids[checkpointMarkers.indexOf(marker)];
                    checkpoints[id] = { x: cx, y: y + TILE };
                    const flag = add(new CheckpointFlag(id, cx, y + TILE, (reached) => context.session.reachCheckpoint(reached)));
                    if (order.indexOf(id) <= order.indexOf(context.session.checkpoint)) flag.activate();
                    break;
                }
                case "P":
                    checkpoints.start = { x: cx, y: y + TILE };
                    break;
                case "G":
                    echoes.granny = add(new Echo("granny-echo", cx, y + TILE, { sheet: "./assets/generated/sprites/granny.png", frameWidth: 66, frameHeight: 66, scale: 2, sheetWidth: 1848, sheetHeight: 264, row: 0, frames: 7, fps: 7 }));
                    break;
                case "T":
                    echoes.theo = add(new Echo("theo-echo", cx, y + TILE, { sheet: "./assets/generated/sprites/theo.png", frameWidth: 32, frameHeight: 32, scale: 2, sheetWidth: 512, sheetHeight: 160, row: 1, frames: 11, fps: 8 }));
                    break;
                case "O":
                    echoes.oshiro = add(new Echo("oshiro-echo", cx, y + TILE + 40, { sheet: "./assets/generated/sprites/oshiro.png", frameWidth: 96, frameHeight: 96, scale: 2, sheetWidth: 2976, sheetHeight: 672, row: 0, frames: 11, fps: 10 }));
                    break;
                case "B":
                    doubtSpot = { x: cx, y: y + TILE };
                    break;
                case "R":
                    peaceSpot = { x: cx, y: y + TILE };
                    break;
                case "F":
                    flagSpot = { x: cx, y: y + TILE };
                    break;
                default:
                    break;
            }
        }

        const summitFlag = add(new CheckpointFlag("summit", flagSpot.x, flagSpot.y, () => {}));
        summitFlag.body.active = false;
        summitFlag.visual.scaleX = 1.6;
        summitFlag.visual.scaleY = 1.6;
        const badeline = add(new BadelineChaser(1.25));
        const director = game.ui.cutscenes;
        const state = { chasing: false, reconciled: false, ending: false };
        const sky = document.getElementById("game");

        /**
         * Plays an echo's memory once.
         *
         * @param {Echo} echo - The echo.
         * @param {import("../ui/dialogue.js").DialogueLine[]} lines - Its words.
         * @returns {void}
         */
        const memory = (echo, lines) => {
            echo.spoken = true;
            director.run(async (cs) => {
                cs.face(Math.sign(echo.position.x - game.player.position.x) || 1);
                await cs.say(lines);
            }, { onEnd: () => echo.fade() });
        };

        /**
         * The doubt appears and the chase begins.
         *
         * @returns {Promise<void>} Resolves when control returns.
         */
        const doubtScene = async () => {
            state.chasing = true;
            await director.run(async (cs) => {
                badeline.start(doubtSpot.x - 140, doubtSpot.y - 64);
                badeline.visual.opacity = 1;
                cs.face(-1);
                await cs.wait(0.6);
                await cs.say([
                    { speaker: "badeline", emotion: "deadpan", key: "summit.doubt.1" },
                    { speaker: "madeline", emotion: "surprised", key: "summit.doubt.2" },
                    { speaker: "badeline", emotion: "angry", key: "summit.doubt.3" },
                    { speaker: "madeline", emotion: "determined", key: "summit.doubt.4" }
                ]);
                cs.face(1);
            }, {
                onEnd: () => {
                    badeline.reset();
                    audio.playMusic(SFX.musicAnxiety, { fade: 0.8, volume: 0.75 });
                    document.getElementById("vignette").classList.add("danger");
                }
            });
        };

        /**
         * Madeline stops running and talks to her doubt; they climb together.
         *
         * @returns {Promise<void>} Resolves when control returns.
         */
        const peaceScene = async () => {
            state.reconciled = true;
            badeline.stop();
            audio.playMusic(SFX.musicGolden, { fade: 2.5, volume: 0.55 });
            document.getElementById("vignette").classList.remove("danger");
            await director.run(async (cs) => {
                await cs.walk(peaceSpot.x, 0.4);
                cs.face(-1);
                badeline.visible = true;
                badeline.position.x = peaceSpot.x - 150;
                badeline.position.y = peaceSpot.y - 64;
                badeline.snap();
                badeline.facing = 1;
                badeline.setFrame(4, 10);
                await cs.pan(peaceSpot.x - 70, peaceSpot.y - 60, 1.2);
                cs.zoom(1.15, 2);
                await cs.say([
                    { speaker: "madeline", emotion: "sad", key: "summit.peace.1" },
                    { speaker: "badeline", emotion: "upset", key: "summit.peace.2" },
                    { speaker: "madeline", emotion: "peaceful", key: "summit.peace.3" },
                    { speaker: "badeline", emotion: "surprised", key: "summit.peace.4" },
                    { speaker: "madeline", emotion: "together", key: "summit.peace.5" }
                ]);
                game.flash(0.7, 0.6);
                audio.play(SFX.hairCharged, { volume: 0.7 });
                game.particles?.burst({ x: peaceSpot.x - 60, y: peaceSpot.y - 30, count: 30, color: "#ff6def", size: 5, speed: 220, life: 0.8 });
                await cs.wait(0.8);
            }, {
                onEnd: () => {
                    badeline.visible = false;
                    game.player.maxDashes = 2;
                    game.player.refillDash(true);
                    game.ui.toast("summit.toast.twoDashes");
                }
            });
        };

        /**
         * Ending: the summit at sunrise.
         *
         * @returns {Promise<void>} Resolves when the chapter completes.
         */
        const endingScene = async () => {
            state.ending = true;
            await director.run(async (cs) => {
                await cs.walk(flagSpot.x - 40, 0.4);
                cs.face(1);
                summitFlag.activate(true);
                audio.play(SFX.summitSit, { volume: 0.6 });
                sky.classList.add("sunrise");
                game.weather.set({ type: "snow", density: 0.35, wind: -15, gusts: 0.2 });
                audio.setAmbience("wind");
                audio.playMusic(SFX.theme, { fade: 3, volume: 0.9 });
                await cs.pan(flagSpot.x - 200, flagSpot.y - 150, 3);
                cs.pose("sitDown");
                await cs.wait(1.2);
                await cs.say([
                    { speaker: "madeline", emotion: "peaceful", key: "summit.end.1" },
                    { speaker: "madeline", emotion: "together", key: "summit.end.2" }
                ]);
                game.ui.chapterCard?.("chapter.summit.ending", "chapter.summit.endingSub");
                await cs.wait(3);
            }, { keepCamera: true, onEnd: () => game.player.forcedAnimation = "sit" });
            context.session.ui.completeChapter();
        };

        return {
            level,
            checkpoints,
            preload: [SFX.mirrorLanding, SFX.hairCharged, SFX.summitFly, SFX.summitSit],

            /**
             * Restores progress-dependent state for the starting checkpoint.
             *
             * @param {string} checkpoint - Starting checkpoint.
             * @param {boolean} fresh - Whether this is a new run.
             * @returns {void}
             */
            onStart(checkpoint, fresh) {
                const index = order.indexOf(checkpoint);
                if (index >= order.indexOf("ice")) echoes.granny.spoken = true;
                if (index >= order.indexOf("cave")) echoes.theo.spoken = true;
                if (index >= order.indexOf("reflection")) echoes.oshiro.spoken = true;
                if (checkpoint === "reflection") {
                    state.chasing = true;
                    badeline.start(doubtSpot.x - 140, doubtSpot.y - 64);
                    badeline.reset();
                    audio.playMusic(SFX.musicAnxiety, { fade: 0.8, volume: 0.75 });
                    document.getElementById("vignette").classList.add("danger");
                }
                if (checkpoint === "peak") {
                    state.chasing = true;
                    state.reconciled = true;
                    game.player.maxDashes = 2;
                    game.player.refillDash(false);
                }
                if (fresh) {
                    director.run(async (cs) => {
                        game.ui.chapterCard?.("chapter.summit.name", "chapter.summit.subtitle");
                        cs.pose("lookUp");
                        await cs.wait(2.2);
                    }, { letterbox: false });
                }
            },

            /**
             * Wind, echoes, the doubt chase and the summit.
             *
             * @returns {void}
             */
            step() {
                const player = game.player;
                if (!player || player.state === PlayerState.DEAD || state.ending) return;
                const row = (player.box.y + player.box.h) / TILE;
                const windy = row >= map.windRows[0] && row <= map.windRows[1];
                const gust = game.weather?.windNow ?? 0;
                player.wind = windy ? Math.min(300, 60 + Math.max(0, gust - 120) * 0.7) : 0;
                if (director.running) return;
                if (echoes.granny.inRange()) memory(echoes.granny, [{ speaker: "grannyEcho", key: "summit.granny.1" }, { speaker: "grannyEcho", emotion: "laugh", key: "summit.granny.2" }]);
                else if (echoes.theo.inRange()) memory(echoes.theo, [{ speaker: "theoEcho", emotion: "excited", key: "summit.theo.1" }, { speaker: "theoEcho", emotion: "normal", key: "summit.theo.2" }]);
                else if (echoes.oshiro.inRange()) memory(echoes.oshiro, [{ speaker: "oshiro", emotion: "sideHappy", key: "summit.oshiro.1" }, { speaker: "oshiro", emotion: "normal", key: "summit.oshiro.2" }]);
                const px = player.box.x + player.box.w / 2;
                const py = player.box.y + player.box.h;
                if (!state.chasing && Math.abs(px - doubtSpot.x) < 120 && Math.abs(py - doubtSpot.y) < 10 && player.onGround) doubtScene();
                if (state.chasing && !state.reconciled && Math.abs(px - peaceSpot.x) < 200 && Math.abs(py - peaceSpot.y) < 10 && player.onGround) peaceScene();
                if (state.reconciled && Math.abs(px - flagSpot.x) < 150 && Math.abs(py - flagSpot.y) < 10 && player.onGround) endingScene();
            },

            /**
             * Resets props and gives the player a head start on the doubt.
             *
             * @returns {void}
             */
            onRespawn() {
                for (const entity of resettable) entity.reset();
            },

            /**
             * Clears chapter specific visuals and abilities.
             *
             * @returns {void}
             */
            onExit() {
                sky.classList.remove("sunrise");
                document.getElementById("vignette").classList.remove("danger");
                if (game.player) {
                    game.player.maxDashes = 1;
                    game.player.wind = 0;
                }
            }
        };
    }
};

