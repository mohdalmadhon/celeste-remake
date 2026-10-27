import { addAnimation, playAnimation } from "../components/animation.js";
import { game } from "../core/game.js";
import { PlayerState } from "../entities/player.js";
import { CheckpointFlag, CrumbleBlock, DashCrystal, Strawberry, ZipMover } from "../entities/props.js";
import { SFX } from "../helpers/sound.js";
import { Level } from "../level.js";
import { audio } from "../systems/audio.js";
import { createBody } from "../systems/physics.js";
import { buildFromJson, groundAt } from "./builder.js";
import { createBird } from "./tutorial.js";

/**
 * Dash crystals that keep the long girder and ice climbs fair with the
 * stamina-limited climbing, placed where the reachability check found
 * walls taller than one full stamina bar.
 *
 * @type {Array<[number, number]>}
 */
const CRYSTALS = [];

/**
 * Chapter 1: Forsaken City. The original girder and ice level with zip
 * movers, crumbling girders and spikes, ending with Madeline resting as the
 * bird lands beside her.
 *
 * @type {import("../core/session.js").ChapterDefinition}
 */
export const forsakenCity = {
    id: "forsaken-city",
    number: 1,
    nameKey: "chapter.city.name",
    subtitleKey: "chapter.city.subtitle",
    art: "./assets/generated/checkpoints/forsaken_city.png",
    timeLimit: 480,
    lives: 6,
    strawberries: 3,
    music: SFX.theme,
    musicVolume: 0.7,
    ambience: "wind",
    weather: { type: "snow", density: 1.2, wind: -60, gusts: 1.4 },
    parallax: "city",
    checkpointNames: { crossing: "checkpoint.city.crossing", chasm: "checkpoint.city.chasm", heights: "checkpoint.city.heights" },

    /**
     * Builds Forsaken City.
     *
     * @param {import("../core/session.js").ChapterContext} context - Build context.
     * @returns {Promise<import("../core/session.js").ChapterRuntime>} The live chapter.
     */
    async build(context) {
        const data = await (await fetch("./js/data/firstLevel.json")).json();
        const level = new Level({ width: 3800, height: 3500 }, context.world, "forsaken-city");
        const special = buildFromJson(level, data.firstLevel.tiles);
        const world = level.world;
        const b = level.contentBounds;
        level.cameraBounds = { left: b.left - 20, top: b.top - 120, right: b.right + 20, bottom: b.bottom + 40 };
        level.killY = b.bottom + 160;
        world.add(createBody(b.left - 60, b.top - 600, 60, b.bottom - b.top + 1200, "solid", { climbable: false }));
        world.add(createBody(b.right, b.top - 600, 60, b.bottom - b.top + 1200, "solid", { climbable: false }));

        const crumbles = [];
        for (const tile of special) {
            if (tile.type !== "cracked") continue;
            const block = new CrumbleBlock(tile, "metal");
            level.addEntity(block);
            world.add(block.body);
            crumbles.push(block);
        }

        const zips = [new ZipMover(2700, -700, 200, 0), new ZipMover(2700, -1550, 0, -200)];
        for (const zip of zips) {
            level.addEntity(zip);
            world.add(zip.body);
        }

        const crystals = CRYSTALS.map(([x, y]) => new DashCrystal(x, y));
        for (const crystal of crystals) {
            level.addEntity(crystal);
            world.add(crystal.body);
        }

        const berries = [
            new Strawberry("city-berry-1", 1482, -368),
            new Strawberry("city-berry-2", 3462, -1368),
            new Strawberry("city-berry-3", 2462, -2368)
        ];
        for (const berry of berries) {
            if (context.session.strawberries.has(berry.id)) continue;
            level.addEntity(berry);
            world.add(berry.body);
        }

        const checkpoints = {
            start: { x: 54, y: groundAt(world, 54, 100) },
            crossing: { x: 2350, y: groundAt(world, 2350, -700) },
            chasm: { x: 2860, y: groundAt(world, 2860, -1200) },
            heights: { x: 2620, y: groundAt(world, 2620, -1900) }
        };
        const order = Object.keys(checkpoints);
        for (const id of order.slice(1)) {
            const point = checkpoints[id];
            const flag = new CheckpointFlag(id, point.x, point.y, (reached) => context.session.reachCheckpoint(reached));
            if (order.indexOf(id) <= order.indexOf(context.session.checkpoint)) flag.activate();
            level.addEntity(flag);
            world.add(flag.body);
        }

        const bird = createBird(2300, -2900);
        bird.facing = 1;
        addAnimation(bird, "glide", { row: 1, startFrame: 0, frameCount: 4, fps: 8 });
        level.addEntity(bird);

        const director = game.ui.cutscenes;
        const state = { ending: false };

        /**
         * Ending: Madeline sits down, exhausted, and the bird lands beside her.
         *
         * @returns {Promise<void>} Resolves when the chapter completes.
         */
        const endingScene = async () => {
            state.ending = true;
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
            context.session.ui.completeChapter();
        };

        return {
            level,
            checkpoints,
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
             * Level script: detects the summit ledge.
             *
             * @returns {void}
             */
            step() {
                const player = game.player;
                if (!player || player.state === PlayerState.DEAD || state.ending) return;
                const px = player.box.x + player.box.w / 2;
                const py = player.box.y + player.box.h;
                if (px <= 3290 && py <= -2540 && player.onGround) endingScene();
            },

            /**
             * Resets moving and breakable props after a death.
             *
             * @returns {void}
             */
            onRespawn() {
                for (const zip of zips) zip.reset();
                for (const block of crumbles) block.reset();
                for (const crystal of crystals) crystal.reset();
            }
        };
    }
};

/**
 * Kept for compatibility with the original module interface.
 *
 * @returns {typeof forsakenCity} The chapter definition.
 */
export function firstLevel() {
    return forsakenCity;
}
