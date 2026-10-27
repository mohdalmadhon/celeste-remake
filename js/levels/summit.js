import { game } from "../core/game.js";
import { BadelineChaser, Echo } from "../entities/echoes.js";
import { PlayerState } from "../entities/player.js";
import { SFX } from "../helpers/sound.js";
import { audio } from "../systems/audio.js";
import { chapterFromLevel } from "./customLevel.js";

/**
 * Echo sprites, keyed by the marker that places them.
 *
 * @type {Readonly<Record<string, { id: string, lift: number, sprite: ConstructorParameters<typeof Echo>[3] }>>}
 */
const ECHOES = Object.freeze({
    granny: { id: "granny-echo", lift: 0, sprite: { sheet: "./assets/generated/sprites/granny.png", frameWidth: 96, frameHeight: 96, scale: 1, sheetWidth: 2784, sheetHeight: 384, row: 0, frames: 12, fps: 8 } },
    theo: { id: "theo-echo", lift: 0, sprite: { sheet: "./assets/generated/sprites/theo.png", frameWidth: 32, frameHeight: 32, scale: 2, sheetWidth: 512, sheetHeight: 160, row: 1, frames: 11, fps: 8 } },
    oshiro: { id: "oshiro-echo", lift: 40, sprite: { sheet: "./assets/generated/sprites/oshiro.png", frameWidth: 96, frameHeight: 96, scale: 2, sheetWidth: 2976, sheetHeight: 672, row: 0, frames: 11, fps: 10 } }
});

/**
 * What each echo says when Madeline walks up to it.
 *
 * @type {Readonly<Record<string, import("../ui/dialogue.js").DialogueLine[]>>}
 */
const MEMORIES = Object.freeze({
    granny: [{ speaker: "grannyEcho", key: "summit.granny.1" }, { speaker: "grannyEcho", emotion: "laugh", key: "summit.granny.2" }],
    theo: [{ speaker: "theoEcho", emotion: "excited", key: "summit.theo.1" }, { speaker: "theoEcho", emotion: "normal", key: "summit.theo.2" }],
    oshiro: [{ speaker: "oshiro", emotion: "sideHappy", key: "summit.oshiro.1" }, { speaker: "oshiro", emotion: "normal", key: "summit.oshiro.2" }]
});

/**
 * Echo memories, the windy traverse, the doubt chase, the reconciliation
 * and the sunrise ending, on top of the summit level file.
 *
 * @param {import("./customLevel.js").LevelScriptApi} api - Level script access.
 * @returns {import("./customLevel.js").LevelScript} The chapter script.
 */
function summitScript({ add, markers, flag, checkpointOrder }) {
    const director = game.ui.cutscenes;
    const echoes = {};
    for (const [name, spec] of Object.entries(ECHOES)) {
        const spot = markers[name];
        if (spot) echoes[name] = add(new Echo(spec.id, spot.x, spot.y + spec.lift, spec.sprite));
    }
    const badeline = add(new BadelineChaser(1.9));
    const doubtSpot = markers.doubt;
    const peaceSpot = markers.peace;
    const windTop = markers["wind-top"]?.y ?? 0;
    const windBottom = markers["wind-bottom"]?.y ?? 0;
    const state = { chasing: false, reconciled: false, ending: false };
    const sky = document.getElementById("game");
    const vignette = document.getElementById("vignette");
    const doubtIndex = checkpointOrder.length - 2;
    const peaceIndex = checkpointOrder.length - 1;
    if (flag) {
        flag.visual.scaleX = 1.6;
        flag.visual.scaleY = 1.6;
    }

    /**
     * Plays an echo's memory once.
     *
     * @param {string} name - Echo name.
     * @returns {void}
     */
    const memory = (name) => {
        const echo = echoes[name];
        echo.spoken = true;
        director.run(async (cs) => {
            cs.face(Math.sign(echo.position.x - game.player.position.x) || 1);
            await cs.say(MEMORIES[name]);
        }, { onEnd: () => echo.fade() });
    };

    /**
     * Starts the chase music and the red edge of the screen.
     *
     * @returns {void}
     */
    const chaseMood = () => {
        audio.playMusic(SFX.musicAnxiety, { fade: 0.8, volume: 0.75 });
        vignette?.classList.add("danger");
    };

    /**
     * The doubt appears and the chase begins.
     *
     * @returns {Promise<void>} Resolves when control returns.
     */
    const doubtScene = async () => {
        state.chasing = true;
        await director.run(async (cs) => {
            badeline.start(doubtSpot.x + 140, doubtSpot.y - 64);
            badeline.visual.opacity = 1;
            cs.face(1);
            await cs.wait(0.6);
            await cs.say([
                { speaker: "badeline", emotion: "deadpan", key: "summit.doubt.1" },
                { speaker: "madeline", emotion: "surprised", key: "summit.doubt.2" },
                { speaker: "badeline", emotion: "angry", key: "summit.doubt.3" },
                { speaker: "madeline", emotion: "determined", key: "summit.doubt.4" }
            ]);
            cs.face(-1);
        }, {
            onEnd: () => {
                badeline.reset();
                chaseMood();
            }
        });
    };

    /**
     * Madeline stops running and talks to her doubt; they climb on together.
     *
     * @returns {Promise<void>} Resolves when control returns.
     */
    const peaceScene = async () => {
        state.reconciled = true;
        badeline.stop();
        audio.playMusic(SFX.musicGolden, { fade: 2.5, volume: 0.55 });
        vignette?.classList.remove("danger");
        await director.run(async (cs) => {
            await cs.walk(peaceSpot.x, 0.4);
            cs.face(1);
            badeline.visible = true;
            badeline.position.x = peaceSpot.x + 90;
            badeline.position.y = peaceSpot.y - 64;
            badeline.snap();
            badeline.facing = -1;
            badeline.setFrame(4, 10);
            await cs.pan(peaceSpot.x + 70, peaceSpot.y - 60, 1.2);
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
            game.particles?.burst({ x: peaceSpot.x + 60, y: peaceSpot.y - 30, count: 30, color: "#ff6def", size: 5, speed: 220, life: 0.8 });
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

    return {
        preload: [SFX.mirrorLanding, SFX.hairCharged, SFX.summitFly, SFX.summitSit, SFX.spring],

        /**
         * Restores what depends on how far the run already got.
         *
         * @param {string} checkpoint - Starting checkpoint.
         * @param {boolean} fresh - Whether this is a new run.
         * @returns {void}
         */
        onStart(checkpoint, fresh) {
            const index = checkpointOrder.indexOf(checkpoint);
            if (index >= 1 && echoes.granny) echoes.granny.spoken = true;
            if (index >= 4 && echoes.theo) echoes.theo.spoken = true;
            if (index >= doubtIndex && echoes.oshiro) echoes.oshiro.spoken = true;
            if (index === doubtIndex) {
                state.chasing = true;
                badeline.start(doubtSpot.x + 140, doubtSpot.y - 64);
                badeline.reset();
                chaseMood();
            }
            if (index >= peaceIndex) {
                state.chasing = true;
                state.reconciled = true;
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
         * Gusty wind on the traverse, the echoes and the two story scenes.
         *
         * @returns {void}
         */
        step() {
            const player = game.player;
            if (!player || player.state === PlayerState.DEAD || state.ending) return;
            const feet = player.box.y + player.box.h;
            const windy = feet >= windTop && feet <= windBottom + 50;
            const gust = game.weather?.windNow ?? 0;
            player.wind = windy ? Math.min(170, 45 + Math.max(0, gust - 110) * 0.4) : 0;
            if (state.reconciled && player.maxDashes < 2) {
                player.maxDashes = 2;
                player.refillDash(false);
            }
            if (director.running) return;
            for (const name of Object.keys(echoes)) {
                if (echoes[name].inRange()) {
                    memory(name);
                    return;
                }
            }
            const px = player.box.x + player.box.w / 2;
            if (!state.chasing && doubtSpot && Math.abs(px - doubtSpot.x) < 120 && Math.abs(feet - doubtSpot.y) < 10 && player.onGround) doubtScene();
            if (state.chasing && !state.reconciled && peaceSpot && Math.abs(px - peaceSpot.x) < 200 && Math.abs(feet - peaceSpot.y) < 10 && player.onGround) peaceScene();
        },

        /**
         * Ending: the summit at sunrise.
         *
         * @returns {Promise<void>} Resolves when the scene is over.
         */
        async finale() {
            state.ending = true;
            await director.run(async (cs) => {
                const spot = { x: flag.position.x + 16, y: flag.position.y + 48 };
                await cs.walk(spot.x - 40, 0.4);
                cs.face(1);
                flag.activate(true);
                audio.play(SFX.summitSit, { volume: 0.6 });
                sky.classList.add("sunrise");
                game.weather.set({ type: "snow", density: 0.35, wind: -15, gusts: 0.2 });
                audio.setAmbience("wind");
                audio.playMusic(SFX.theme, { fade: 3, volume: 0.9 });
                await cs.pan(spot.x - 200, spot.y - 150, 3);
                cs.pose("sitDown");
                await cs.wait(1.2);
                await cs.say([
                    { speaker: "madeline", emotion: "peaceful", key: "summit.end.1" },
                    { speaker: "madeline", emotion: "together", key: "summit.end.2" }
                ]);
                game.ui.chapterCard?.("chapter.summit.ending", "chapter.summit.endingSub");
                await cs.wait(3);
            }, { keepCamera: true, onEnd: () => game.player.forcedAnimation = "sit" });
        },

        /**
         * Clears the sunrise and the chase edge of the screen.
         *
         * @returns {void}
         */
        onExit() {
            sky.classList.remove("sunrise");
            vignette?.classList.remove("danger");
        }
    };
}

/**
 * Chapter 3: The Summit's Forgotten Echoes. A final climb through wind,
 * snowballs and an ice cave, past echoes of the people Madeline met, away
 * from the part of herself that doubts her, and up the last stretch with
 * two dashes. The layout lives in a level file made by
 * tools/build_summit.mjs, so it can be opened in developer mode too.
 *
 * @type {import("../core/session.js").ChapterDefinition}
 */
export const summit = chapterFromLevel("./js/data/levels/summit-echoes.json", {
    id: "summit-echoes",
    number: 3,
    nameKey: "chapter.summit.name",
    subtitleKey: "chapter.summit.subtitle",
    art: "./assets/generated/checkpoints/summit.png",
    strawberries: 3,
    custom: false,
    settings: { theme: "summit", weather: "blizzard", music: "golden", timeLimit: 840, lives: 20 },
    checkpointNames: {
        cp1: "checkpoint.summit.ridge",
        cp2: "checkpoint.summit.ice",
        cp3: "checkpoint.summit.cave",
        cp4: "checkpoint.summit.roof",
        cp5: "checkpoint.summit.reflection",
        cp6: "checkpoint.summit.peak"
    },
    script: summitScript
});
