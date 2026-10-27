import { addAnimation, playAnimation } from "../components/animation.js";
import { game } from "../core/game.js";
import { SFX } from "../helpers/sound.js";
import { audio } from "../systems/audio.js";
import { chapterFromLevel } from "./customLevel.js";
import { createBird } from "./tutorial.js";

/**
 * Adds the bird that waits at the lookout and the scene where Madeline
 * finally sits down next to it.
 *
 * @param {import("./customLevel.js").LevelScriptApi} api - Level script access.
 * @returns {import("./customLevel.js").LevelScript} The chapter script.
 */
function cityScript({ level, goal }) {
    const spot = goal ?? { x: 3725, y: 400 };
    const bird = createBird(spot.x - 120, spot.y - 170);
    bird.facing = 1;
    addAnimation(bird, "glide", { row: 1, startFrame: 0, frameCount: 4, fps: 8 });
    level.addEntity(bird);
    const director = game.ui.cutscenes;

    return {
        preload: [SFX.cart, SFX.crack, SFX.breakBridge, SFX.squawk, SFX.sit],

        /**
         * Shows the chapter title on a fresh start.
         *
         * @param {string} checkpoint - Starting checkpoint.
         * @param {boolean} fresh - Whether this is a new run.
         * @returns {void}
         */
        onStart(checkpoint, fresh) {
            if (fresh) game.ui.chapterCard?.("chapter.city.name", "chapter.city.subtitle");
        },

        /**
         * Madeline sits down, exhausted, and the bird lands beside her.
         *
         * @returns {Promise<void>} Resolves when the scene is over.
         */
        async finale() {
            await director.run(async (cs) => {
                await cs.wait(0.3);
                cs.pose("talk");
                await cs.say([{ speaker: "madeline", emotion: "sad", key: "city.end.1" }]);
                cs.pose(null);
                const player = game.player;
                await cs.walk(player.box.x + player.box.w / 2 - 60, 0.35);
                cs.face(1);
                cs.pose("sitDown");
                audio.play(SFX.sit, { volume: 0.5 });
                await cs.wait(0.8);
                playAnimation(bird, "fly");
                audio.play(SFX.squawk, { volume: 0.4 });
                await cs.move(bird, player.box.x + 50, player.box.y - 6, 220);
                playAnimation(bird, "peck", true);
                await cs.wait(0.8);
                await cs.say([
                    { speaker: "madeline", emotion: "peaceful", key: "city.end.2" },
                    { speaker: "madeline", emotion: "determined", key: "city.end.3" }
                ]);
                game.ui.chapterCard?.("chapter.city.name", "chapter.city.complete");
                await cs.wait(2.5);
            }, { keepCamera: true, onEnd: () => game.player.forcedAnimation = "sit" });
        }
    };
}

/**
 * Chapter 1: Forsaken City. A snowed-in street, a building site, a tower,
 * the rooftops, a scaffold chimney and a windy ridge up to the lookout. The
 * layout lives in a level file made by tools/build_city.mjs, so it can be
 * opened in developer mode too.
 *
 * @type {import("../core/session.js").ChapterDefinition}
 */
export const forsakenCity = chapterFromLevel("./js/data/levels/forsaken-city.json", {
    id: "forsaken-city",
    number: 1,
    nameKey: "chapter.city.name",
    subtitleKey: "chapter.city.subtitle",
    art: "./assets/generated/checkpoints/forsaken_city.png",
    strawberries: 5,
    custom: false,
    goalFlag: false,
    crumble: { path: "./assets/tiles/celeste/breakCracked.png", surface: "metal" },
    settings: { theme: "city", weather: "snow", music: "golden", timeLimit: 600, lives: 15 },
    checkpointNames: {
        cp1: "checkpoint.city.crossing",
        cp2: "checkpoint.city.tower",
        cp3: "checkpoint.city.rooftops",
        cp4: "checkpoint.city.scaffold",
        cp5: "checkpoint.city.heights"
    },
    script: cityScript
});

/**
 * Kept for compatibility with the original module interface.
 *
 * @returns {typeof forsakenCity} The chapter definition.
 */
export function firstLevel() {
    return forsakenCity;
}
