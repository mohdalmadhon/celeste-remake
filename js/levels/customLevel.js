import { TILE } from "../core/constants.js";
import { game } from "../core/game.js";
import { t } from "../core/i18n.js";
import { delay } from "../core/session.js";
import { addDecor, DashBlock, KeyItem, LevelNpc, LockedDoor, Seeker, SnowballThrower, Spring, SwitchGate, SwitchHub, TouchSwitch } from "../entities/gadgets.js";
import { DustBunny } from "../entities/hazards.js";
import { PlayerState } from "../entities/player.js";
import { Booster, CheckpointFlag, CrumbleBlock, DashCrystal, FallingBlock, Strawberry, ZipMover } from "../entities/props.js";
import { SFX } from "../helpers/sound.js";
import { Level } from "../level.js";
import { audio } from "../systems/audio.js";
import { addSpike, buildFromAscii } from "./builder.js";
import { MUSIC_OPTIONS, normalizeLevel, TILE_TYPES, WEATHER_PRESETS } from "./levelFormat.js";

const SPIKE_MARKER = { up: "^", down: "v", left: "<", right: ">" };
const AMBIENCE = { none: "none", snow: "wind", heavy: "wind", blizzard: "blizzard" };

/**
 * Options for turning a level file into a chapter.
 *
 * @typedef {object} LevelChapterOptions
 * @property {string} [id] - Chapter id; defaults to "custom:" plus the level id.
 * @property {number} [number] - Display number.
 * @property {string} [nameKey] - Translation key of the name; the level name is used when missing.
 * @property {string} [subtitleKey] - Translation key of the subtitle.
 * @property {string} [art] - Chapter select image.
 * @property {number} [strawberries] - Strawberry count shown before the level is loaded.
 * @property {Record<string, string>} [checkpointNames] - Toast keys by checkpoint id.
 * @property {boolean} [custom=true] - Whether runs stay out of the story save.
 * @property {() => void} [onFinish] - Replaces the normal results screen, used by editor playtests.
 * @property {Partial<import("./levelFormat.js").LevelData["settings"]>} [settings] - Play settings to use before a level loaded from a URL is fetched.
 * @property {{ path: string, surface: string }} [crumble] - Look and sound of crumbling blocks.
 * @property {boolean} [goalFlag=true] - Whether the goal shows a flag.
 * @property {(api: LevelScriptApi) => LevelScript} [script] - Chapter-specific scripting on top of the level file.
 */

/**
 * What a level script gets to work with.
 *
 * @typedef {object} LevelScriptApi
 * @property {Level} level - The built level.
 * @property {import("../core/session.js").ChapterContext} context - Build context.
 * @property {{ x: number, y: number }|null} goal - Where the goal is, in pixels.
 * @property {CheckpointFlag|null} flag - The goal flag entity, if the level has a goal.
 * @property {Record<string, { x: number, y: number }>} markers - Script markers by name: feet position in pixels.
 * @property {(entity: *) => *} add - Adds an entity to the level, resetting it on respawn when it can.
 * @property {string[]} checkpointOrder - Checkpoint ids in the order they are reached, starting with "start".
 * @property {SwitchHub} switches - Touch switch and gate state.
 * @property {SnowballThrower} snowballs - The level's snowball thrower.
 */

/**
 * Hooks a chapter can add to a level file.
 *
 * @typedef {object} LevelScript
 * @property {string[]} [preload] - Sounds to load before play.
 * @property {(checkpoint: string, fresh: boolean) => void} [onStart] - Runs when play starts.
 * @property {() => Promise<void>} [finale] - Replaces the flag-raising scene when the goal is reached.
 * @property {() => void} [onRespawn] - Runs after the player respawns.
 * @property {() => void} [step] - Runs every simulation step after the level's own checks.
 * @property {() => void} [onExit] - Runs when the chapter is left.
 */

/**
 * Draws the background wall layer: the same materials as the terrain, darker
 * and never solid. Edges are only drawn where a wall meets open air, so walls
 * blend into the terrain in front of them.
 *
 * @param {Level} level - Target level.
 * @param {string[]} background - Background rows.
 * @param {string[]} tiles - Terrain rows.
 * @returns {void}
 */
function buildBackground(level, background, tiles) {
    const covered = (c, r) => {
        if (r < 0 || r >= background.length || c < 0 || c >= background[r].length) return true;
        return background[r][c] !== "." || tiles[r][c] !== ".";
    };
    background.forEach((row, r) => {
        [...row].forEach((ch, c) => {
            if (ch === "." || tiles[r][c] !== "." || !TILE_TYPES[ch]) return;
            const mask = (covered(c, r - 1) ? 0 : 1) | (covered(c + 1, r) ? 0 : 2) | (covered(c, r + 1) ? 0 : 4) | (covered(c - 1, r) ? 0 : 8);
            level.addTile({
                x: c * TILE, y: r * TILE, w: TILE, h: TILE, solid: false, layer: "back",
                src: TILE_TYPES[ch].strip.replace("/auto_", "/bg_"),
                backgroundSize: `${TILE * 16}px ${TILE}px`,
                backgroundPosition: `${-mask * TILE}px 0px`
            });
        });
    });
}

/**
 * Creates a chapter definition that plays a level file.
 *
 * @param {import("./levelFormat.js").LevelData|string} source - The level, or the URL of its JSON file.
 * @param {LevelChapterOptions} [options] - Chapter metadata.
 * @returns {import("../core/session.js").ChapterDefinition} The chapter.
 */
export function chapterFromLevel(source, options = {}) {
    const preview = typeof source === "string" ? null : normalizeLevel(source);
    const settings = { theme: "summit", weather: "blizzard", music: "theme", timeLimit: 900, lives: 10, ...options.settings, ...preview?.settings };
    return {
        id: options.id ?? `custom:${preview?.id ?? source}`,
        number: options.number ?? -1,
        nameKey: options.nameKey ?? preview?.name ?? "Custom level",
        subtitleKey: options.subtitleKey ?? (preview?.author ? `by ${preview.author}` : ""),
        art: options.art ?? "./assets/generated/checkpoints/summit.png",
        timeLimit: settings.timeLimit,
        lives: settings.lives,
        strawberries: options.strawberries ?? preview?.entities.filter((entity) => entity.type === "strawberry").length ?? 0,
        music: MUSIC_OPTIONS[settings.music]?.path ?? SFX.theme,
        musicVolume: 0.6,
        ambience: AMBIENCE[settings.weather],
        weather: WEATHER_PRESETS[settings.weather],
        parallax: settings.theme,
        checkpointNames: options.checkpointNames,
        custom: options.custom ?? true,

        /**
         * Loads the level when needed and builds it.
         *
         * @param {import("../core/session.js").ChapterContext} context - Build context.
         * @returns {Promise<import("../core/session.js").ChapterRuntime>} The live chapter.
         */
        async build(context) {
            const level = preview ?? normalizeLevel(await (await fetch(source)).json());
            return buildLevelRuntime(level, context, this, options);
        }
    };
}

/**
 * Builds the playable runtime of a level file.
 *
 * @param {import("./levelFormat.js").LevelData} data - Clean level data.
 * @param {import("../core/session.js").ChapterContext} context - Build context.
 * @param {import("../core/session.js").ChapterDefinition} chapter - Owning chapter.
 * @param {LevelChapterOptions} options - Chapter options.
 * @returns {import("../core/session.js").ChapterRuntime} The live chapter.
 */
function buildLevelRuntime(data, context, chapter, options) {
    const width = data.width * TILE;
    const height = data.height * TILE;
    const level = new Level({ width, height }, context.world, chapter.id);
    const world = level.world;
    const materials = {};
    for (const [ch, tile] of Object.entries(TILE_TYPES)) materials[ch] = { strip: tile.strip, surface: tile.surface };
    buildFromAscii(level, data.tiles, materials, { edgeSolid: true });
    if (data.background) buildBackground(level, data.background, data.tiles);
    level.cameraBounds = { left: 0, top: 0, right: width, bottom: height };
    level.killY = height + 40;
    level.voidDeath = true;
    world.add({ x: -50, y: -2000, w: 50, h: height + 4000, kind: "solid", active: true, climbable: false, cells: [] });
    world.add({ x: width, y: -2000, w: 50, h: height + 4000, kind: "solid", active: true, climbable: false, cells: [] });

    const resettable = [];
    const fallers = new Map();
    const add = (entity) => {
        level.addEntity(entity);
        if (entity.body) world.add(entity.body);
        if (entity.reset) resettable.push(entity);
        return entity;
    };
    const checkpoints = {};
    const checkpointOrder = ["start"];
    let goal = null;
    let berryIndex = 0;
    const sorted = [...data.entities].sort((a, b) => a.y === b.y ? a.x - b.x : b.y - a.y);
    const flags = data.entities.filter((entity) => entity.type === "checkpoint");
    const markers = {};
    const switches = new SwitchHub();
    const snowballs = add(new SnowballThrower());

    for (const entity of sorted) {
        const x = entity.x * TILE;
        const y = entity.y * TILE;
        const cx = x + TILE / 2;
        const cy = y + TILE / 2;
        switch (entity.type) {
            case "spawn":
                checkpoints.start = { x: cx, y: y + TILE };
                break;
            case "checkpoint": {
                const id = `cp${flags.indexOf(entity) + 1}`;
                checkpoints[id] = { x: cx, y: y + TILE };
                checkpointOrder.push(id);
                const flag = add(new CheckpointFlag(id, cx, y + TILE, (reached) => context.session.reachCheckpoint(reached)));
                if (checkpointOrder.indexOf(context.session.checkpoint) >= checkpointOrder.indexOf(id)) flag.activate();
                break;
            }
            case "goal":
                goal = add(new CheckpointFlag("goal", cx, y + TILE, () => {}));
                goal.body.active = false;
                goal.visual.scaleX = 1.5;
                goal.visual.scaleY = 1.5;
                if (options.goalFlag === false) goal.elem.style.display = "none";
                goal.spot = { x: cx, y: y + TILE };
                break;
            case "spike":
                addSpike(level, SPIKE_MARKER[entity.dir] ?? "^", x, y);
                break;
            case "crumble":
                add(new CrumbleBlock({ x, y, w: TILE, h: TILE, path: options.crumble?.path ?? "./assets/tiles/celeste/blueIcePlain.png" }, options.crumble?.surface ?? "ice"));
                break;
            case "falling": {
                const block = add(new FallingBlock({ x, y, w: TILE, h: TILE, path: "./assets/tiles/celeste/dirtPlate.png" }, {
                    shakeTime: 0.35,
                    surface: "dirt",
                    lands: entity.lands,
                    triggerOnTouch: entity.trigger !== "event"
                }));
                fallers.set(entity.id, block);
                break;
            }
            case "crystal":
                add(new DashCrystal(cx, cy));
                break;
            case "booster":
                add(new Booster(cx, cy));
                break;
            case "strawberry": {
                const id = `${chapter.id}-berry-${++berryIndex}`;
                if (!context.session.strawberries.has(id)) add(new Strawberry(id, cx, cy));
                break;
            }
            case "dustBunny":
                add(new DustBunny(cx, cy, { dx: entity.dx * TILE, dy: entity.dy * TILE, speed: entity.speed }));
                break;
            case "zipMover":
                add(new ZipMover(x, y + TILE - 64, entity.dx * TILE, entity.dy * TILE));
                break;
            case "spring":
                add(new Spring(x, y, entity.dir));
                break;
            case "key":
                add(new KeyItem(cx, cy));
                break;
            case "door":
                add(new LockedDoor(x, y, TILE, entity.h * TILE));
                break;
            case "touchSwitch":
                add(new TouchSwitch(cx, cy, entity.group, switches));
                break;
            case "gate":
                add(new SwitchGate(x, y, entity.w * TILE, entity.h * TILE, entity.dx * TILE, entity.dy * TILE, entity.group, switches));
                break;
            case "dashBlock":
                add(new DashBlock(x, y, entity.w * TILE, entity.h * TILE));
                break;
            case "seeker":
                add(new Seeker(cx, cy, entity.speed));
                break;
            case "npc":
                add(new LevelNpc(entity.look, cx, y + TILE, entity.facing === "right" ? 1 : -1));
                break;
            case "decor":
                addDecor(level, entity.variant, x, y);
                break;
            case "marker":
                if (entity.name) markers[entity.name] = { x: cx, y: y + TILE };
                break;
            default:
                break;
        }
    }
    if (!checkpoints.start) checkpoints.start = { x: TILE * 2, y: TILE * 2 };
    const script = options.script?.({ level, context, goal: goal?.spot ?? null, flag: goal, markers, add, checkpointOrder, switches, snowballs }) ?? {};

    const director = game.ui.cutscenes;
    const state = { wind: 0, finishing: false, lastCheckpoint: context.session.checkpoint, deaths: 0 };
    const events = data.events.map((event) => ({ ...event, fired: false, inside: false }));

    /**
     * Ends the level with the flag raised.
     *
     * @returns {Promise<void>} Resolves when the results show.
     */
    const finish = async () => {
        if (state.finishing) return;
        state.finishing = true;
        if (script.finale) {
            await script.finale();
            context.session.ui.completeChapter();
            return;
        }
        await director.run(async (cs) => {
            if (goal) {
                goal.activate(true);
                cs.face(Math.sign(goal.spot.x - game.player.position.x) || 1);
            }
            audio.play(SFX.summitSit, { volume: 0.6 });
            game.flash(0.5, 0.5);
            await cs.wait(1.4);
        }, { keepCamera: true });
        if (options.onFinish) options.onFinish();
        else context.session.ui.completeChapter();
    };

    /**
     * Runs one action of an event.
     *
     * @param {{ type: string } & Record<string, *>} action - The action.
     * @returns {Promise<void>} Resolves when the action is done.
     */
    const runAction = async (action) => {
        const player = game.player;
        switch (action.type) {
            case "dialogue":
                if (action.lines.length) {
                    await director.run(async (cs) => {
                        await cs.say(action.lines.map((line) => ({ speaker: line.speaker, emotion: line.emotion || "normal", text: t(line.text) })));
                    });
                }
                break;
            case "toast":
                game.ui.toast(action.text);
                break;
            case "title":
                game.ui.chapterCard?.(action.text, action.sub);
                break;
            case "shake":
                game.camera.shake(action.strength, action.duration);
                break;
            case "flash":
                game.flash(action.strength, 0.4);
                break;
            case "drop":
                fallers.get(action.target)?.trigger();
                break;
            case "wind":
                state.wind = action.strength;
                break;
            case "weather":
                game.weather.set(WEATHER_PRESETS[action.preset]);
                audio.setAmbience(AMBIENCE[action.preset]);
                break;
            case "dashes":
                player.maxDashes = action.count;
                player.dashEnabled = action.count > 0;
                player.refillDash(false);
                break;
            case "refill":
                player.refillDash(true);
                break;
            case "camera":
                await director.run(async (cs) => {
                    await cs.pan(action.x * TILE + TILE / 2, action.y * TILE + TILE / 2, action.duration);
                    await cs.wait(0.4);
                });
                break;
            case "wait":
                await delay(action.seconds * 1000);
                break;
            case "kill":
                if (player.state !== PlayerState.DEAD) player.die(0, 0);
                break;
            case "snowballs":
                snowballs.set(action.on, action.interval, action.from === "left" ? 1 : -1);
                break;
            case "gates":
                switches.open(action.group);
                break;
            case "finish":
                await finish();
                break;
            default:
                break;
        }
    };

    /**
     * Fires an event unless it already ran and only runs once.
     *
     * @param {*} event - Runtime event.
     * @returns {Promise<void>} Resolves when its actions finish.
     */
    const fire = async (event) => {
        if (event.fired && event.once) return;
        event.fired = true;
        for (const action of event.actions) {
            if (state.finishing && action.type !== "finish") return;
            await runAction(action);
        }
    };

    /**
     * Fires every event with a given trigger that matches a condition.
     *
     * @param {string} type - Trigger type.
     * @param {(trigger: *) => boolean} [match] - Extra condition.
     * @returns {void}
     */
    const fireWhere = (type, match = () => true) => {
        for (const event of events) {
            if (event.trigger.type === type && match(event.trigger)) fire(event);
        }
    };

    return {
        level,
        checkpoints,
        preload: script.preload,

        /**
         * Applies the level's dash count and runs start events.
         *
         * @param {string} checkpoint - Starting checkpoint.
         * @param {boolean} fresh - Whether this is a new run.
         * @returns {void}
         */
        onStart(checkpoint, fresh) {
            script.onStart?.(checkpoint, fresh);
            game.player.maxDashes = Math.max(1, data.settings.dashes);
            game.player.dashEnabled = data.settings.dashes > 0;
            game.player.refillDash(false);
            fireWhere("start");
        },

        /**
         * Checks triggers, applies wind and detects the goal.
         *
         * @returns {void}
         */
        step() {
            const player = game.player;
            if (!player || state.finishing) return;
            player.wind = state.wind;
            if (player.state === PlayerState.DEAD) return;
            const box = player.box;
            for (const event of events) {
                const trigger = event.trigger;
                if (trigger.type !== "enter") continue;
                const inside = box.x < (trigger.x + trigger.w) * TILE && box.x + box.w > trigger.x * TILE &&
                    box.y < (trigger.y + trigger.h) * TILE && box.y + box.h > trigger.y * TILE;
                if (inside && !event.inside && !director.running) fire(event);
                event.inside = inside;
            }
            const checkpoint = context.session.checkpoint;
            if (checkpoint !== state.lastCheckpoint) {
                state.lastCheckpoint = checkpoint;
                const index = checkpointOrder.indexOf(checkpoint);
                fireWhere("checkpoint", (trigger) => trigger.index === 0 || trigger.index === index);
            }
            const berries = context.session.strawberries.size;
            fireWhere("strawberries", (trigger) => berries >= trigger.count);
            if (context.session.deaths !== state.deaths) {
                state.deaths = context.session.deaths;
                fireWhere("deaths", (trigger) => state.deaths >= trigger.count);
            }
            script.step?.();
            if (goal && !director.running && player.onGround) {
                const px = box.x + box.w / 2;
                const py = box.y + box.h;
                if (Math.abs(px - goal.spot.x) < TILE && Math.abs(py - goal.spot.y) < TILE) finish();
            }
        },

        /**
         * Resets moving props after a death.
         *
         * @returns {void}
         */
        onRespawn() {
            for (const entity of resettable) entity.reset();
            script.onRespawn?.();
        },

        /**
         * Restores the player's default abilities.
         *
         * @returns {void}
         */
        onExit() {
            script.onExit?.();
            if (game.player) {
                game.player.maxDashes = 1;
                game.player.dashEnabled = true;
                game.player.wind = 0;
            }
        }
    };
}
