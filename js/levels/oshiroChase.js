import { playAnimation } from "../components/animation.js";
import { TILE } from "../core/constants.js";
import { game } from "../core/game.js";
import { DebrisDropper, DustBunny, Lamp, SlamDoor } from "../entities/hazards.js";
import { OshiroBoss, OshiroHost } from "../entities/oshiro.js";
import { PlayerState } from "../entities/player.js";
import { Booster, CheckpointFlag, CrumbleBlock, DashCrystal, FallingBlock, Strawberry } from "../entities/props.js";
import { SFX } from "../helpers/sound.js";
import { Level } from "../level.js";
import { audio } from "../systems/audio.js";
import { createBody } from "../systems/physics.js";
import { buildFromAscii, MATERIALS } from "./builder.js";
import { buildOshiroMap } from "./maps/oshiroMap.js";

const CRUMBLE = "./assets/generated/tiles/resort_crumble.png";

/**
 * Chase intensity for each checkpoint stretch, from a gentle start to a
 * relentless rooftop finale.
 *
 * @type {Record<string, import("../entities/oshiro.js").ChasePhase>}
 */
const PHASES = {
    hall: { cooldown: 3.0, windup: 0.95, speed: 900, lag: 2.2 },
    shaft: { cooldown: 2.6, windup: 0.9, speed: 950, lag: 2.6 },
    ballroom: { cooldown: 2.2, windup: 0.8, speed: 1050, lag: 3 },
    rooftop: { cooldown: 1.8, windup: 0.7, speed: 1200, lag: 3.4 }
};

/**
 * Chapter 2: Celestial Resort, the Oshiro chase. Oshiro begs Madeline to
 * stay, loses control and pursues her through the hallways, a service shaft,
 * a collapsing ballroom and over the rooftops.
 *
 * @type {import("../core/session.js").ChapterDefinition}
 */
export const oshiroChase = {
    id: "celestial-resort",
    number: 2,
    nameKey: "chapter.resort.name",
    subtitleKey: "chapter.resort.subtitle",
    art: "./assets/generated/checkpoints/resort.png",
    timeLimit: 420,
    lives: 8,
    strawberries: 2,
    music: null,
    ambience: "hotel",
    weather: { type: "dust", density: 1, wind: 6, gusts: 0.2 },
    parallax: "resort",
    checkpointNames: { hall: "checkpoint.resort.hall", shaft: "checkpoint.resort.shaft", ballroom: "checkpoint.resort.ballroom", rooftop: "checkpoint.resort.rooftop" },

    /**
     * Builds the chase.
     *
     * @param {import("../core/session.js").ChapterContext} context - Build context.
     * @returns {Promise<import("../core/session.js").ChapterRuntime>} The live chapter.
     */
    async build(context) {
        const map = buildOshiroMap();
        const level = new Level({ width: map.rows[0].length * TILE, height: map.rows.length * TILE }, context.world, "celestial-resort");
        const world = level.world;
        for (const [x, y, w, h] of map.interiors) {
            level.addTile({
                x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE, src: "./assets/generated/tiles/resort_wall.png",
                solid: false, layer: "back", backgroundSize: "100px 100px", classes: ["wallpaper"]
            });
        }

        const markers = [];
        buildFromAscii(level, map.rows, { "#": MATERIALS.resort }, {
            edgeSolid: false,
            onMarker: (ch, x, y) => markers.push({ ch, x, y })
        });
        level.cameraZones = map.zones;
        level.cameraBounds = { left: 0, top: -100, right: map.rows[0].length * TILE, bottom: map.rows.length * TILE };
        level.killY = map.rows.length * TILE + 40;
        world.add(createBody(-60, -400, 60, 2400, "solid", { climbable: false }));

        const resettable = [];
        const checkpoints = {};
        const checkpointOrder = ["start", "hall", "shaft", "ballroom", "rooftop"];
        const checkpointIds = ["hall", "shaft", "ballroom", "rooftop"];
        let checkpointIndex = 0;
        let host = null;
        let end = null;
        let doorCount = 0;
        const add = (entity) => {
            level.addEntity(entity);
            if (entity.body) world.add(entity.body);
            if (entity.reset) resettable.push(entity);
            return entity;
        };

        markers.sort((a, b) => a.x - b.x || a.y - b.y);
        for (const marker of markers) {
            const { ch, x, y } = marker;
            const cx = x + TILE / 2;
            const cy = y + TILE / 2;
            switch (ch) {
                case "=":
                    add(new CrumbleBlock({ x, y, w: TILE, h: TILE, path: CRUMBLE }, "wood"));
                    break;
                case "~": {
                    const block = new FallingBlock({ x, y, w: TILE, h: TILE, path: CRUMBLE }, { shakeTime: 0.28, surface: "wood" });
                    add(block);
                    break;
                }
                case "d":
                    add(new DustBunny(cx, cy));
                    break;
                case "h":
                    add(new DustBunny(cx - 100, cy, { dx: 200, speed: 1.4 }));
                    break;
                case "v":
                    add(new DustBunny(cx, cy - 75, { dy: 150, speed: 1.8 }));
                    break;
                case "x":
                    add(new DebrisDropper(x, y + TILE, x - 3 * TILE));
                    break;
                case "D":
                    add(new SlamDoor(x, y + TILE, 4 * TILE, x - (6 + doorCount++) * TILE, 0.55));
                    break;
                case "o":
                    add(new Booster(cx, cy));
                    break;
                case "*":
                    add(new DashCrystal(cx, cy));
                    break;
                case "S": {
                    const id = `resort-berry-${markers.filter((m) => m.ch === "S").indexOf(marker) + 1}`;
                    if (!context.session.strawberries.has(id)) add(new Strawberry(id, cx, cy));
                    break;
                }
                case "C": {
                    const id = checkpointIds[checkpointIndex++];
                    checkpoints[id] = { x: cx, y: y + TILE };
                    const flag = add(new CheckpointFlag(id, cx, y + TILE, (reached) => {
                        context.session.reachCheckpoint(reached);
                        boss.phase = PHASES[reached] || boss.phase;
                    }));
                    if (checkpointOrder.indexOf(id) <= checkpointOrder.indexOf(context.session.checkpoint)) flag.activate();
                    break;
                }
                case "P":
                    checkpoints.start = { x: cx, y: y + TILE };
                    break;
                case "L":
                    add(new Lamp(cx, y));
                    break;
                case "O":
                    host = add(new OshiroHost(x - 70, y - 120));
                    break;
                case "E":
                    end = { x, y };
                    break;
                default:
                    break;
            }
        }

        const boss = add(new OshiroBoss());
        const vignette = document.getElementById("vignette");
        const director = game.ui.cutscenes;
        const state = { chasing: false, ending: false };

        /**
         * Starts the pursuit with the phase matching the current checkpoint.
         *
         * @param {string} checkpoint - Checkpoint id.
         * @returns {void}
         */
        const beginChase = (checkpoint) => {
            state.chasing = true;
            boss.phase = PHASES[checkpoint] || PHASES.hall;
            boss.start();
            audio.startPercussion(156);
            audio.intensity = 0.3;
            vignette.classList.add("danger");
        };

        /**
         * Lobby scene: Oshiro welcomes Madeline, then refuses to let her leave.
         *
         * @returns {Promise<void>} Resolves when the chase begins.
         */
        const introScene = async () => {
            await director.run(async (cs) => {
                game.ui.chapterCard?.("chapter.resort.name", "chapter.resort.subtitle");
                await cs.wait(1.2);
                await cs.walk(host.position.x - 40, 0.45);
                cs.face(1);
                playAnimation(host, "side");
                host.facing = -1;
                await cs.pan(host.position.x + 60, host.position.y + 120, 1);
                await cs.say([
                    { speaker: "oshiro", emotion: "sideHappy", key: "resort.intro.1" },
                    { speaker: "madeline", emotion: "distracted", key: "resort.intro.2" },
                    { speaker: "oshiro", emotion: "nervous", key: "resort.intro.3" },
                    { speaker: "madeline", emotion: "determined", key: "resort.intro.4" },
                    { speaker: "oshiro", emotion: "serious", key: "resort.intro.5" }
                ]);
                cs.zoom(1.12, 3);
                game.camera.shake(3, 0.6);
                await cs.say([{ speaker: "oshiro", emotion: "losing", key: "resort.intro.6" }]);
                cs.zoom(1, 4);
                host.visible = false;
                boss.visible = true;
                boss.setCenter(host.position.x + 96, host.position.y + 110);
                boss.snap();
                playAnimation(boss, "transform", true);
                game.flash(0.5, 0.3);
                audio.play(SFX.hairCharged, { volume: 0.7, rate: 0.5 });
                await cs.wait(1);
                cs.face(-1);
                await cs.say([{ speaker: "madeline", emotion: "panic", key: "resort.intro.7" }]);
                cs.face(1);
            }, {
                onEnd: () => {
                    host.visible = false;
                    game.camera.release();
                    beginChase("hall");
                }
            });
        };

        /**
         * Ending: Oshiro crashes into the wall and calms down.
         *
         * @returns {Promise<void>} Resolves when the chapter completes.
         */
        const endingScene = async () => {
            state.ending = true;
            await director.run(async (cs) => {
                boss.stop();
                boss.visible = true;
                boss.setCenter(end.x - 600, game.player.box.y);
                boss.snap();
                playAnimation(boss, "dash", true);
                await cs.walk(end.x + 3 * TILE, 0.7);
                cs.face(-1);
                await cs.track(boss.scriptedCharge(end.x + 9 * TILE, 1300), () => boss.finishMove());
                playAnimation(boss, "hurt", true);
                audio.play(SFX.quack, { volume: 0.7, rate: 0.6 });
                game.camera.shake(9, 0.5);
                game.flash(0.6, 0.35);
                audio.stopPercussion();
                vignette.classList.remove("danger");
                await cs.wait(1.2);
                boss.visible = false;
                host.visible = true;
                host.position.x = end.x + 6 * TILE;
                host.baseY = end.y - 3 * TILE;
                host.snap();
                host.facing = -1;
                playAnimation(host, "appear", true);
                await cs.wait(1.4);
                await cs.pan(end.x + 4 * TILE, end.y, 1.2);
                await cs.say([
                    { speaker: "madeline", emotion: "surprised", key: "resort.end.1" },
                    { speaker: "oshiro", emotion: "nervous", key: "resort.end.2" },
                    { speaker: "oshiro", emotion: "sideWorried", key: "resort.end.3" },
                    { speaker: "madeline", emotion: "sad", key: "resort.end.4" },
                    { speaker: "madeline", emotion: "normal", key: "resort.end.5" },
                    { speaker: "oshiro", emotion: "sideHappy", key: "resort.end.6" },
                    { speaker: "madeline", emotion: "peaceful", key: "resort.end.7" }
                ]);
                game.ui.chapterCard?.("chapter.resort.name", "chapter.resort.complete");
                await cs.wait(2.6);
            }, {
                keepCamera: true,
                onEnd: () => {
                    boss.stop();
                    audio.stopPercussion();
                    vignette.classList.remove("danger");
                }
            });
            context.session.ui.completeChapter();
        };

        return {
            level,
            checkpoints,
            preload: [SFX.dashRight, SFX.hairCharged, SFX.crack, SFX.breakBridge, SFX.quack, SFX.strawberry],

            /**
             * Plays the lobby scene on a fresh start, otherwise resumes the chase.
             *
             * @param {string} checkpoint - Starting checkpoint.
             * @returns {void}
             */
            onStart(checkpoint) {
                if (checkpoint === "start") {
                    introScene();
                } else {
                    host.visible = false;
                    beginChase(checkpoint);
                }
            },

            /**
             * Updates chase intensity and detects the end of the run.
             *
             * @returns {void}
             */
            step() {
                const player = game.player;
                if (!player || state.ending) return;
                if (state.chasing) {
                    const target = 0.3 + boss.proximity * 0.7;
                    audio.intensity += (target - audio.intensity) * 0.02;
                    vignette.style.setProperty("--danger", (0.15 + boss.proximity * 0.5).toFixed(2));
                    game.camera.offset.x += (140 - game.camera.offset.x) * 0.02;
                }
                if (player.state === PlayerState.DEAD) return;
                const px = player.box.x + player.box.w / 2;
                if (end && state.chasing && px >= end.x && player.onGround) endingScene();
            },

            /**
             * Resets hazards and gives the player a head start after a death.
             *
             * @returns {void}
             */
            onRespawn() {
                for (const entity of resettable) entity.reset();
                if (state.chasing) boss.reset();
            },

            /**
             * Stops chase audio and visuals when leaving.
             *
             * @returns {void}
             */
            onExit() {
                audio.stopPercussion();
                vignette.classList.remove("danger");
                vignette.style.removeProperty("--danger");
                if (game.camera) game.camera.offset.x = 0;
            }
        };
    }
};
