import { events } from "./core/events.js";
import { game } from "./core/game.js";
import { detectLanguage, setLanguage } from "./core/i18n.js";
import { GameLoop } from "./core/loop.js";
import { loadSave, persistSave, resetSave, save } from "./core/save.js";
import { delay, Session } from "./core/session.js";
import { loadSettings, setSetting, settings } from "./core/settings.js";
import { Player } from "./entities/player.js";
import { SFX } from "./helpers/sound.js";
import { CHAPTERS } from "./levels/chapters.js";
import { THEMES } from "./levels/themes.js";
import { audio } from "./systems/audio.js";
import { input } from "./systems/input.js";
import { Parallax } from "./systems/parallax.js";
import { Weather } from "./systems/weather.js";
import { mountControlsGuide } from "./ui/controlsGuide.js";
import { CutsceneDirector } from "./ui/cutscene.js";
import { Dialogue } from "./ui/dialogue.js";
import { applyDisplayScale } from "./ui/display.js";
import { Hud } from "./ui/hud.js";
import { PerfOverlay } from "./ui/perf.js";
import { Screens } from "./ui/screens.js";
import { Transition } from "./ui/transition.js";
import { t } from "./core/i18n.js";
import { LevelEditor } from "./editor/editor.js";
import { chapterFromLevel } from "./levels/customLevel.js";
import { normalizeLevel } from "./levels/levelFormat.js";

/** @type {Session|null} */
let session = null;
/** @type {number} */
let chapterIndex = 0;
/** @type {import("./core/session.js").ChapterDefinition|null} */
let currentChapter = null;
/** @type {"playtest"|"play"|null} */
let developerRun = null;
/** @type {number} */
let flashTime = 0;
/** @type {number} */
let flashDuration = 0;
/** @type {number} */
let flashStrength = 0;
/** @type {number} */
let toastTimer = 0;

const container = document.getElementById("game");
const flashElem = document.getElementById("flash");
const toastElem = document.getElementById("toast");
const cardElem = document.getElementById("chapter-card");

/**
 * Shows a short notification at the bottom of the screen.
 *
 * @param {string} key - Translation key.
 * @returns {void}
 */
function toast(key) {
    toastElem.textContent = t(key);
    toastElem.classList.add("show");
    toastTimer = 2.2;
}

/**
 * Shows the large chapter title card.
 *
 * @param {string} nameKey - Translation key of the title.
 * @param {string} [subKey] - Translation key of the subtitle.
 * @returns {void}
 */
function chapterCard(nameKey, subKey) {
    cardElem.querySelector(".chapter-card-name").textContent = t(nameKey);
    cardElem.querySelector(".chapter-card-sub").textContent = subKey ? t(subKey) : "";
    cardElem.classList.remove("show");
    void cardElem.offsetWidth;
    cardElem.classList.add("show");
}

/**
 * Applies the environment of a chapter: parallax, weather, ambience and music.
 *
 * @param {import("./core/session.js").ChapterDefinition} chapter - Chapter definition.
 * @returns {void}
 */
function applyEnvironment(chapter) {
    game.parallax.set(THEMES[chapter.parallax] || THEMES.forest);
    game.weather.set(chapter.weather || { type: "none" });
    audio.setAmbience(chapter.ambience || "none");
    audio.playMusic(chapter.music || null, { fade: 2, volume: chapter.musicVolume ?? 0.8 });
    document.getElementById("vignette").className = "vignette";
}

/**
 * Shows the menu backdrop environment.
 *
 * @returns {void}
 */
function applyMenuEnvironment() {
    game.parallax.set(THEMES.menu);
    game.weather.set({ type: "snow", density: 0.8, wind: -30 });
    audio.setAmbience("wind");
    audio.playMusic(SFX.theme, { fade: 2, volume: 0.8 });
}

/**
 * Starts a story chapter, optionally resuming the saved run.
 *
 * @param {number} index - Chapter index.
 * @param {{ resume?: boolean, checkpoint?: string }} [options] - Start options.
 * @returns {Promise<void>} Resolves once playable.
 */
async function startChapter(index, options = {}) {
    const chapter = CHAPTERS[index];
    if (!chapter) return;
    developerRun = null;
    await launch(chapter, index, options);
}

/**
 * Builds and starts any chapter, story or custom.
 *
 * @param {import("./core/session.js").ChapterDefinition} chapter - Chapter to play.
 * @param {number} index - Story index, or -1 for levels from developer mode.
 * @param {{ resume?: boolean, checkpoint?: string }} [options] - Start options.
 * @returns {Promise<void>} Resolves once playable.
 */
async function launch(chapter, index, options = {}) {
    if (game.state === "transition") return;
    game.state = "transition";
    await game.ui.transition.cover("fade", 0.45);
    ui.screens.close();
    closeSession();
    editor.hide();
    chapterIndex = index;
    currentChapter = chapter;
    loop.simulate = false;
    game.player.visible = true;
    game.player.controlLocked = false;
    game.player.forcedAnimation = null;
    applyEnvironment(chapter);
    session = new Session(chapter, game.ui);
    const resume = options.resume && save.session?.chapter === chapter.id ? save.session : null;
    await session.start({ resume, checkpoint: options.checkpoint });
    game.ui.hud.setVisible(true);
    game.state = "playing";
    loop.resetTiming();
    loop.simulate = true;
    input.clear();
    await game.ui.transition.reveal("fade", 0.6);
}

/**
 * Opens developer mode.
 *
 * @param {{ manager?: boolean, note?: string }} [options] - Show the level list first, and a message to show.
 * @returns {Promise<void>} Resolves once the editor shows.
 */
async function openEditor(options = {}) {
    if (game.state === "transition") return;
    const wasPlaying = Boolean(session);
    game.state = "transition";
    if (wasPlaying) await game.ui.transition.cover("fade", 0.35);
    closeSession();
    ui.screens.close();
    loop.simulate = false;
    developerRun = null;
    game.weather.set({ type: "none" });
    game.state = "editor";
    editor.open({ manager: options.manager });
    if (options.note) editor.flash(options.note);
    if (wasPlaying) await game.ui.transition.reveal("fade", 0.2);
}

/**
 * Turns a level from the editor into a playable chapter.
 *
 * @param {import("./levels/levelFormat.js").LevelData} level - Level to play.
 * @param {"playtest"|"play"} mode - Whether to come straight back to the editor when it ends.
 * @param {{ x: number, y: number }} [from] - Cell to start on instead of the player start.
 * @returns {void}
 */
function playLevel(level, mode, from) {
    const copy = structuredClone(level);
    if (from) {
        const spawn = copy.entities.find((entity) => entity.type === "spawn");
        if (spawn) {
            spawn.x = from.x;
            spawn.y = from.y;
        }
    }
    const chapter = chapterFromLevel(copy, {
        id: `custom:${copy.id}`,
        art: "./assets/generated/checkpoints/custom.png",
        onFinish: mode === "playtest" ? () => openEditor({ note: "Level finished!" }) : undefined
    });
    developerRun = mode;
    launch(chapter, -1);
}

/**
 * Removes the running chapter.
 *
 * @returns {void}
 */
function closeSession() {
    if (game.ui.cutscenes.running) game.ui.cutscenes.skip();
    session?.destroy();
    session = null;
    game.session = null;
    game.ui.hud.setVisible(false);
    game.ui.dialogue.root.classList.add("hidden");
    document.body.classList.remove("cutscene");
}

/**
 * Opens the pause menu.
 *
 * @returns {void}
 */
function pause() {
    if (game.state !== "playing") return;
    game.state = "paused";
    loop.simulate = false;
    game.ui.dialogue.paused = true;
    audio.ui("open");
    ui.screens.show("pause");
}

/**
 * Closes the pause menu.
 *
 * @returns {void}
 */
function resume() {
    if (game.state !== "paused") return;
    ui.screens.close();
    game.state = "playing";
    game.ui.dialogue.paused = false;
    input.clear();
    loop.resetTiming();
    loop.simulate = true;
}

/**
 * Returns to the main menu or chapter select.
 *
 * @param {string} [screen="main"] - Screen to open.
 * @returns {Promise<void>} Resolves once the menu shows.
 */
async function quitToMenu(screen = "main") {
    if (developerRun) {
        const manager = developerRun === "play";
        await openEditor({ manager });
        return;
    }
    game.state = "transition";
    await game.ui.transition.cover("fade", 0.35);
    session?.persist();
    closeSession();
    ui.screens.close();
    loop.simulate = false;
    applyMenuEnvironment();
    ui.screens.show("main");
    if (screen === "chapters") ui.screens.show("chapters");
    game.state = "menu";
    await game.ui.transition.reveal("fade", 0.45);
}

/**
 * Shows the results screen after finishing a chapter.
 *
 * @returns {void}
 */
function completeChapter() {
    if (!session) return;
    const result = session.complete(chapterIndex);
    game.state = "over";
    loop.simulate = true;
    const hasNext = chapterIndex >= 0 && chapterIndex + 1 < CHAPTERS.length;
    audio.play(SFX.summitSit, { volume: 0.5 });
    ui.screens.show("complete", {
        chapter: session.chapter,
        session,
        result,
        hasNext,
        next: () => startChapter(chapterIndex + 1)
    });
}

/**
 * Shows the game over screen.
 *
 * @param {string} reason - "lives" or "time".
 * @returns {void}
 */
function gameOver(reason) {
    if (game.state !== "playing") return;
    game.state = "over";
    loop.simulate = false;
    if (session) {
        session.finished = true;
        save.session = null;
        persistSave();
    }
    ui.screens.show("gameover", { reason });
}

/**
 * Respawns at the last checkpoint from the pause menu.
 *
 * @returns {void}
 */
function retry() {
    resume();
    if (game.player.state !== "dead") game.player.die(0, 0);
}

const loop = new GameLoop({
    /**
     * Polls input devices once per display frame.
     *
     * @param {number} dt - Frame time in seconds.
     * @returns {void}
     */
    frame(dt) {
        input.poll(dt);
    },
    /**
     * Advances the running chapter by one fixed step.
     *
     * @param {number} dt - Step length in seconds.
     * @returns {void}
     */
    step(dt) {
        if (session && game.state === "playing") session.step(dt);
    },
    /**
     * Draws the chapter or menu backdrop and updates overlays.
     *
     * @param {number} alpha - Interpolation factor between steps.
     * @param {number} frameDt - Frame time in seconds.
     * @returns {void}
     */
    render(alpha, frameDt) {
        if (session) {
            session.render(alpha, frameDt);
        } else {
            game.weather.update(frameDt, null);
        }
        game.ui.dialogue.update(frameDt);
        updateFlash(frameDt);
        if (toastTimer > 0) {
            toastTimer -= frameDt;
            if (toastTimer <= 0) toastElem.classList.remove("show");
        }
        perf.update(frameDt, game.level?.entities.length ?? 0);
    }
});

/**
 * Fades the white flash overlay.
 *
 * @param {number} dt - Frame time in seconds.
 * @returns {void}
 */
function updateFlash(dt) {
    if (flashTime <= 0) return;
    flashTime = Math.max(0, flashTime - dt);
    flashElem.style.opacity = (flashStrength * (flashTime / flashDuration)).toFixed(3);
}

const ui = {
    hud: new Hud(document.getElementById("hud")),
    dialogue: new Dialogue(document.getElementById("dialogue")),
    transition: new Transition(document.getElementById("transition")),
    toast,
    chapterCard,
    completeChapter,
    screens: null,
    cutscenes: null
};
ui.cutscenes = new CutsceneDirector(ui.dialogue, document.getElementById("letterbox"));
ui.screens = new Screens(document.getElementById("screens"), {
    continueGame: () => {
        const sessionRecord = save.session;
        const index = sessionRecord ? CHAPTERS.findIndex((chapter) => chapter.id === sessionRecord.chapter) : -1;
        if (index >= 0) startChapter(index, { resume: true });
        else ui.screens.show("chapters");
    },
    newGame: () => {
        resetSave();
        startChapter(0);
    },
    startChapter: (index, options) => startChapter(index, options),
    resume,
    retry,
    restartChapter: () => {
        if (chapterIndex < 0 && currentChapter) {
            launch(currentChapter, -1);
            return;
        }
        save.session = null;
        startChapter(chapterIndex);
    },
    openEditor: () => openEditor({ manager: true }),
    skipCutscene: () => {
        ui.cutscenes.skip();
        resume();
    },
    quitToMenu: (screen) => quitToMenu(screen),
    applyDisplay: () => applyDisplayScale(),
    chapters: () => CHAPTERS,
    inCutscene: () => ui.cutscenes.running && ui.cutscenes.skippable,
    history: () => ui.dialogue.history
});
game.ui = ui;
const editor = new LevelEditor(document.getElementById("editor"), {
    playtest: (level, from) => playLevel(level, "playtest", from),
    play: (level) => playLevel(level, "play"),
    exit: () => {
        editor.hide();
        game.state = "menu";
        applyMenuEnvironment();
        ui.screens.show("main");
    },
    example: async () => normalizeLevel(await (await fetch("./js/data/levels/shattered-spire.json")).json())
});
const perf = new PerfOverlay(document.getElementById("perf"), loop.stats);

events.on("fx:flash", ({ strength, duration }) => {
    if (!settings.flashes) return;
    flashStrength = strength;
    flashDuration = duration;
    flashTime = duration;
});
events.on("session:gameover", (current) => gameOver(current.lives <= 0 ? "lives" : "time"));
events.on("cutscene:start", () => document.body.classList.add("cutscene"));
events.on("cutscene:end", () => document.body.classList.remove("cutscene"));
events.on("input:ui", ({ action, repeat }) => {
    if (action === "pause" && !repeat && game.state === "playing" && !ui.screens.open) pause();
});
document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.state === "playing") pause();
});
window.addEventListener("resize", () => applyDisplayScale());
document.addEventListener("fullscreenchange", () => {
    setSetting("fullscreen", Boolean(document.fullscreenElement));
    applyDisplayScale();
});

/**
 * Boots the game: loads settings, save and language, creates shared
 * systems and shows the title screen, or a chapter when requested by the URL.
 *
 * @returns {Promise<void>} Resolves once the first screen is visible.
 */
async function boot() {
    loadSettings();
    loadSave();
    if (!settings.language) setSetting("language", detectLanguage());
    await setLanguage(settings.language);
    game.container = container;
    game.worldLayer = document.getElementById("world");
    game.parallax = new Parallax(container);
    game.weather = new Weather(container);
    game.player = new Player({ x: 100, y: 300 });
    mountControlsGuide(document.getElementById("controls-guide"));
    applyDisplayScale();
    ui.transition.set();
    loop.start();
    const params = new URLSearchParams(location.search);
    if (params.has("debug")) {
        window.game = game;
        window.gameLoop = loop;
    }
    const requested = params.get("chapter");
    const index = CHAPTERS.findIndex((chapter) => chapter.id === requested);
    if (index >= 0) {
        audio.unlock();
        await startChapter(index, { checkpoint: params.get("checkpoint") || "start" });
        return;
    }
    game.state = "menu";
    applyMenuEnvironment();
    ui.screens.show("title");
    await delay(50);
    await ui.transition.reveal("fade", 0.8);
}

boot();
