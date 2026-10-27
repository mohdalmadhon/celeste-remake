import { events } from "../core/events.js";
import { getLanguage, LANGUAGES, setLanguage, t, translateDom } from "../core/i18n.js";
import { chapterRecord, hasSave, save } from "../core/save.js";
import { DEFAULT_BINDINGS, resetSettings, setSetting, settings } from "../core/settings.js";
import { audio } from "../systems/audio.js";
import { input, keyLabel } from "../systems/input.js";
import { formatPrecise } from "./hud.js";
import { createIcon } from "./icons.js";
import { Menu } from "./menu.js";
import { revealTitle } from "../helpers/sign.js";

/**
 * Callbacks the screens use to drive the game.
 *
 * @typedef {object} ScreenActions
 * @property {() => void} continueGame - Resumes the saved run.
 * @property {() => void} newGame - Starts over from the Prologue.
 * @property {(index: number, options?: { resume?: boolean }) => void} startChapter - Starts a chapter.
 * @property {() => void} resume - Closes the pause menu.
 * @property {() => void} retry - Respawns at the last checkpoint.
 * @property {() => void} restartChapter - Restarts the current chapter.
 * @property {() => void} skipCutscene - Skips the running cutscene.
 * @property {() => void} quitToMenu - Leaves the chapter.
 * @property {() => void} applyDisplay - Re-applies display settings.
 * @property {() => import("../core/session.js").ChapterDefinition[]} chapters - Chapter list.
 * @property {() => boolean} inCutscene - Whether a skippable cutscene runs.
 * @property {() => Array<{ speaker: string, text: string }>} history - Dialogue history.
 */

/**
 * Builds and switches between full screen menus: title, main menu, chapter
 * select, settings, language, credits, pause, results and game over.
 */
export class Screens {
    /** @type {HTMLElement} */
    root;
    /** @type {ScreenActions} */
    actions;
    /** @type {{ name: string, elem: HTMLElement, menus: Menu[], cleanup: Function[] }|null} */
    current = null;
    /** @type {Array<{ name: string, params: * }>} */
    #stack = [];
    /** @type {HTMLElement|null} */
    #backdrop = null;

    /**
     * @param {HTMLElement} root - Screens container.
     * @param {ScreenActions} actions - Game callbacks.
     */
    constructor(root, actions) {
        this.root = root;
        this.actions = actions;
        events.on("language:change", () => {
            if (this.current) this.show(this.current.name, this.current.params, { replace: true, silent: true });
        });
    }

    /**
     * Whether any screen is open.
     *
     * @returns {boolean} True while a menu is visible.
     */
    get open() {
        return Boolean(this.current);
    }

    /**
     * Shared animated backdrop with the mountain image.
     *
     * @returns {HTMLElement} Backdrop element.
     */
    #makeBackdrop() {
        const backdrop = document.createElement("div");
        backdrop.className = "screen-backdrop";
        backdrop.innerHTML = '<div class="backdrop-image"></div><div class="backdrop-glow"></div><div class="backdrop-shade"></div>';
        return backdrop;
    }

    /**
     * Opens a screen.
     *
     * @param {string} name - Screen name.
     * @param {*} [params] - Screen parameters.
     * @param {{ replace?: boolean, silent?: boolean }} [options] - Whether to replace the current screen instead of pushing it.
     * @returns {void}
     */
    show(name, params = null, options = {}) {
        if (this.current && !options.replace) {
            this.#stack.push({ name: this.current.name, params: this.current.params, selected: this.current.menus[0]?.items[this.current.menus[0].index]?.id });
        }
        this.#teardown(Boolean(options.silent));
        const elem = document.createElement("div");
        elem.className = `screen ${name}-screen`;
        if (options.silent) elem.style.animation = "none";
        const screen = { name, params, elem, menus: [], cleanup: [] };
        this.current = screen;
        const builder = this.#builders()[name];
        builder.call(this, screen, params);
        this.root.appendChild(elem);
        translateDom(elem);
        events.emit("screen:show", name);
    }

    /**
     * Map of screen builders.
     *
     * @returns {Record<string, Function>} Builders by name.
     */
    #builders() {
        return {
            title: this.#title,
            main: this.#main,
            chapters: this.#chapters,
            settings: this.#settings,
            controls: this.#controls,
            language: this.#language,
            credits: this.#credits,
            pause: this.#pause,
            history: this.#history,
            complete: this.#complete,
            gameover: this.#gameover,
            confirm: this.#confirm
        };
    }

    /**
     * Returns to the previous screen.
     *
     * @returns {void}
     */
    back() {
        const previous = this.#stack.pop();
        if (!previous) return;
        this.show(previous.name, { ...(previous.params || {}), selected: previous.selected }, { replace: true });
    }

    /**
     * Closes every screen.
     *
     * @returns {void}
     */
    close() {
        this.#stack = [];
        this.#teardown(false);
        this.current = null;
    }

    /**
     * Removes the current screen.
     *
     * @param {boolean} instant - Skip the exit animation.
     * @returns {void}
     */
    #teardown(instant) {
        const screen = this.current;
        if (!screen) return;
        for (const menu of screen.menus) menu.destroy();
        for (const fn of screen.cleanup) fn();
        const elem = screen.elem;
        if (instant) {
            elem.remove();
        } else {
            elem.classList.add("leaving");
            setTimeout(() => elem.remove(), 200);
        }
        this.current = null;
    }

    /**
     * Adds a menu to a screen.
     *
     * @param {*} screen - Screen record.
     * @param {HTMLElement} container - Menu container.
     * @param {import("./menu.js").MenuItem[]} items - Rows.
     * @param {object} [options] - Menu options.
     * @returns {Menu} The menu.
     */
    #menu(screen, container, items, options = {}) {
        const menu = new Menu(container, items, { selected: screen.params?.selected, ...options });
        screen.menus.push(menu);
        return menu;
    }

    /**
     * Creates the left aligned menu layout with a heading.
     *
     * @param {HTMLElement} elem - Screen element.
     * @param {string} heading - Translation key of the heading.
     * @param {boolean} [backdrop=true] - Whether to add the mountain backdrop.
     * @returns {HTMLElement} Panel to put menus into.
     */
    #layout(elem, heading, backdrop = true) {
        if (backdrop) elem.appendChild(this.#makeBackdrop());
        const layout = document.createElement("div");
        layout.className = "menu-layout";
        const panel = document.createElement("div");
        panel.className = "menu-panel";
        const title = document.createElement("div");
        title.className = "menu-heading";
        title.innerHTML = '<span class="mini-logo"></span>';
        const text = document.createElement("span");
        text.textContent = t(heading);
        title.appendChild(text);
        panel.appendChild(title);
        layout.appendChild(panel);
        elem.appendChild(layout);
        return panel;
    }

    /**
     * Adds a hint line under a menu.
     *
     * @param {HTMLElement} panel - Panel element.
     * @param {string} key - Translation key.
     * @returns {void}
     */
    #hint(panel, key) {
        const hint = document.createElement("div");
        hint.className = "menu-hint";
        hint.textContent = t(key);
        panel.appendChild(hint);
    }

    /**
     * Title screen with the logo and a press-any-key prompt.
     *
     * @param {*} screen - Screen record.
     * @returns {void}
     */
    #title(screen) {
        const elem = screen.elem;
        elem.appendChild(this.#makeBackdrop());
        elem.classList.add("title-screen");
        const logo = document.createElement("div");
        logo.className = "title-logo";
        const word = document.createElement("div");
        word.className = "title-word";
        revealTitle(word, "Celeste", { delayBetween: 110, startDelay: 250 });
        const sub = document.createElement("div");
        sub.className = "title-sub";
        sub.textContent = t("title.subtitle");
        const prompt = document.createElement("div");
        prompt.className = "title-prompt";
        prompt.textContent = t("title.press");
        elem.append(logo, word, sub, prompt);
        const proceed = () => {
            audio.unlock();
            audio.ui("open");
            this.show("main", null, { replace: true });
        };
        const timer = performance.now() + 500;
        const offKey = events.on("input:key", () => {
            if (performance.now() > timer) proceed();
        });
        const offUi = events.on("input:ui", (event) => {
            if (event.source === "gamepad" && performance.now() > timer) proceed();
        });
        elem.addEventListener("click", proceed);
        screen.cleanup.push(offKey, offUi);
    }

    /**
     * Main menu.
     *
     * @param {*} screen - Screen record.
     * @returns {void}
     */
    #main(screen) {
        const panel = this.#layout(screen.elem, "menu.title");
        const canQuit = Boolean(window.opener) || window.matchMedia?.("(display-mode: standalone)").matches;
        const items = [];
        if (hasSave()) items.push({ id: "continue", label: "menu.continue", icon: "flag", action: () => this.actions.continueGame() });
        items.push(
            {
                id: "new", label: "menu.newGame", icon: "flagGold", action: () => {
                    if (hasSave()) {
                        this.show("confirm", { text: "confirm.newGame", yes: () => this.actions.newGame() });
                    } else {
                        this.actions.newGame();
                    }
                }
            },
            { id: "chapters", label: "menu.chapters", icon: "strawberry", action: () => this.show("chapters"), disabled: () => !hasSave() },
            { id: "settings", label: "menu.settings", icon: "clock", action: () => this.show("settings") },
            { id: "language", label: "menu.language", icon: "bird", action: () => this.show("language") },
            { id: "credits", label: "menu.credits", icon: "heart", action: () => this.show("credits") }
        );
        if (canQuit) items.push({ id: "quit", label: "menu.quit", icon: "skull", action: () => window.close() });
        this.#menu(screen, panel, items, { onBack: () => this.show("title", null, { replace: true }) });
        this.#hint(panel, "hint.navigate");
    }

    /**
     * Chapter select with artwork cards, strawberry counts and completion.
     *
     * @param {*} screen - Screen record.
     * @param {{ selected?: string }} [params] - Initially selected chapter id.
     * @returns {void}
     */
    #chapters(screen, params) {
        const elem = screen.elem;
        elem.appendChild(this.#makeBackdrop());
        const wrap = document.createElement("div");
        wrap.className = "chapter-screen";
        wrap.style.position = "absolute";
        wrap.style.inset = "0";
        const heading = document.createElement("div");
        heading.className = "menu-heading";
        heading.innerHTML = `<span class="mini-logo"></span><span>${t("menu.chapters")}</span>`;
        const strip = document.createElement("div");
        strip.className = "chapter-strip";
        const detail = document.createElement("div");
        detail.className = "chapter-detail";
        const actionsRow = document.createElement("div");
        actionsRow.className = "chapter-actions";
        wrap.append(heading, strip, detail, actionsRow);
        elem.appendChild(wrap);
        const chapters = this.actions.chapters();
        const items = chapters.map((chapter, index) => {
            const record = chapterRecord(chapter.id);
            const locked = index >= save.unlocked;
            return {
                id: chapter.id,
                text: "",
                disabled: () => false,
                decorate: (row) => {
                    row.className = `chapter-card-item${locked ? " locked" : ""}`;
                    row.textContent = "";
                    const art = document.createElement("div");
                    art.className = "chapter-art";
                    art.style.backgroundImage = `url("${chapter.art}")`;
                    const number = document.createElement("div");
                    number.className = "chapter-number";
                    number.textContent = chapter.number === 0 ? t("chapter.prologueTag") : t("chapter.number", { n: chapter.number });
                    art.appendChild(number);
                    const info = document.createElement("div");
                    info.className = "chapter-info";
                    const name = document.createElement("div");
                    name.className = "chapter-name";
                    name.textContent = locked ? "???" : t(chapter.nameKey);
                    const stats = document.createElement("div");
                    stats.className = "chapter-stats";
                    const berries = document.createElement("span");
                    berries.append(createIcon("strawberry", 18), `${record.strawberries.length}/${chapter.strawberries}`);
                    const deaths = document.createElement("span");
                    deaths.append(createIcon("skull", 18), String(record.deaths));
                    stats.append(berries, deaths);
                    if (record.completed) {
                        const done = document.createElement("span");
                        done.append(createIcon("flag", 18));
                        stats.append(done);
                    }
                    const labelSpan = document.createElement("span");
                    labelSpan.className = "label";
                    labelSpan.hidden = true;
                    info.append(name, stats);
                    row.append(art, info, labelSpan);
                },
                action: () => {
                    if (locked) {
                        audio.ui("error");
                        return;
                    }
                    const resumable = save.session?.chapter === chapter.id && save.session.checkpoint !== "start";
                    if (resumable) {
                        this.show("confirm", {
                            text: "confirm.resumeChapter",
                            yesLabel: "menu.continueCheckpoint",
                            noLabel: "menu.startOver",
                            yes: () => this.actions.startChapter(index, { resume: true }),
                            no: () => this.actions.startChapter(index)
                        });
                    } else {
                        this.actions.startChapter(index);
                    }
                }
            };
        });
        const menu = this.#menu(screen, strip, items, {
            horizontal: true,
            className: "chapter-strip",
            selected: params?.selected || save.session?.chapter || chapters[Math.min(save.unlocked, chapters.length) - 1]?.id,
            onBack: () => this.back()
        });
        strip.remove();
        wrap.insertBefore(menu.root, detail);
        const updateDetail = () => {
            const chapter = chapters[menu.index];
            const record = chapterRecord(chapter.id);
            const locked = menu.index >= save.unlocked;
            detail.textContent = "";
            const lines = locked ? [t("chapter.locked")] : [
                t(chapter.subtitleKey),
                record.bestTime !== null ? t("chapter.best", { time: formatPrecise(record.bestTime), score: record.bestScore }) : t("chapter.notCleared")
            ];
            lines.forEach((line) => {
                const p = document.createElement("p");
                p.textContent = line;
                detail.appendChild(p);
            });
        };
        updateDetail();
        const off = events.on("menu:select", updateDetail);
        screen.cleanup.push(off);
        const hint = document.createElement("div");
        hint.className = "menu-hint";
        hint.style.textAlign = "center";
        hint.textContent = t("hint.chapters");
        wrap.appendChild(hint);
    }

    /**
     * Settings menu covering audio, video, accessibility and controls.
     *
     * @param {*} screen - Screen record.
     * @returns {void}
     */
    #settings(screen) {
        const inGame = Boolean(screen.params?.inGame);
        const panel = this.#layout(screen.elem, "menu.settings", !inGame);
        if (inGame) screen.elem.prepend(Object.assign(document.createElement("div"), { className: "screen-dim" }));
        const volume = (key) => ({
            type: "slider", min: 0, max: 1, step: 0.1,
            get: () => settings[key],
            set: (value) => setSetting(key, value)
        });
        const toggle = (key, after) => ({
            type: "toggle",
            get: () => settings[key],
            set: (value) => {
                setSetting(key, value);
                after?.();
            }
        });
        const items = [
            { type: "section", label: "settings.audio" },
            { id: "master", label: "settings.master", ...volume("masterVolume") },
            { id: "music", label: "settings.music", ...volume("musicVolume") },
            { id: "sfx", label: "settings.sfx", ...volume("sfxVolume") },
            { type: "section", label: "settings.video" },
            {
                id: "fullscreen", label: "settings.fullscreen", type: "toggle",
                get: () => Boolean(document.fullscreenElement),
                set: async (value) => {
                    try {
                        if (value) await document.documentElement.requestFullscreen();
                        else await document.exitFullscreen();
                    } catch {
                        audio.ui("error");
                    }
                    setSetting("fullscreen", Boolean(document.fullscreenElement));
                    this.current?.menus[0]?.refresh();
                },
                disabled: () => !document.fullscreenEnabled
            },
            {
                id: "scale", label: "settings.scale", type: "choice",
                options: [
                    { value: "fit", label: "settings.scale.fit" },
                    { value: "integer", label: "settings.scale.integer" },
                    { value: "native", label: "settings.scale.native" }
                ],
                get: () => settings.displayScale,
                set: (value) => {
                    setSetting("displayScale", value);
                    this.actions.applyDisplay();
                }
            },
            {
                id: "framecap", label: "settings.frameCap", type: "choice",
                options: [
                    { value: 0, label: "settings.frameCap.vsync" },
                    { value: 60, label: "settings.frameCap.60" },
                    { value: 30, label: "settings.frameCap.30" }
                ],
                get: () => settings.frameCap,
                set: (value) => setSetting("frameCap", value)
            },
            { id: "fps", label: "settings.showFps", ...toggle("showFps") },
            { type: "section", label: "settings.accessibility" },
            { id: "shake", label: "settings.shake", type: "slider", min: 0, max: 1, step: 0.25, get: () => settings.screenShake, set: (value) => setSetting("screenShake", value) },
            { id: "flashes", label: "settings.flashes", ...toggle("flashes") },
            {
                id: "vfx", label: "settings.vfx", type: "choice",
                options: [
                    { value: 0.35, label: "settings.vfx.low" },
                    { value: 0.7, label: "settings.vfx.medium" },
                    { value: 1, label: "settings.vfx.high" }
                ],
                get: () => settings.vfxIntensity,
                set: (value) => setSetting("vfxIntensity", value)
            },
            { id: "lookahead", label: "settings.lookAhead", type: "slider", min: 0, max: 1, step: 0.25, get: () => settings.cameraLookAhead, set: (value) => setSetting("cameraLookAhead", value) },
            { id: "autoclimb", label: "settings.autoClimb", ...toggle("autoClimb") },
            { id: "assist", label: "settings.assist", ...toggle("assistMode") },
            { type: "section", label: "settings.input" },
            { id: "controls", label: "settings.controls", action: () => this.show("controls", { inGame }) },
            {
                id: "reset", label: "settings.reset", action: () => this.show("confirm", {
                    text: "confirm.resetSettings",
                    inGame,
                    yes: () => {
                        resetSettings();
                        this.actions.applyDisplay();
                        this.back();
                    }
                })
            },
            { id: "back", label: "menu.back", action: () => this.back() }
        ];
        this.#menu(screen, panel, items, { onBack: () => this.back() });
        this.#hint(panel, "hint.settings");
    }

    /**
     * Key remapping screen.
     *
     * @param {*} screen - Screen record.
     * @returns {void}
     */
    #controls(screen) {
        const inGame = Boolean(screen.params?.inGame);
        const panel = this.#layout(screen.elem, "settings.controls", !inGame);
        if (inGame) screen.elem.prepend(Object.assign(document.createElement("div"), { className: "screen-dim" }));
        screen.elem.classList.add("settings-screen");
        const actions = ["left", "right", "up", "down", "jump", "dash", "grab", "pause"];
        let menu = null;
        const items = actions.map((action) => ({
            id: action,
            label: `action.${action}`,
            type: "choice",
            options: [{ value: 0, label: "" }],
            valueText: () => (settings.bindings[action] || []).map(keyLabel).join(" / ") || "—",
            get: () => 0,
            set: () => {},
            action: () => {
                menu.active = false;
                const row = menu.rows[menu.index];
                row.querySelector(".value").textContent = t("controls.pressKey");
                input.captureNextKey((code) => {
                    if (code !== "Escape") {
                        const bindings = { ...settings.bindings };
                        for (const other of Object.keys(bindings)) {
                            if (other !== action && ["left", "right", "up", "down", "jump", "dash", "grab"].includes(other) && ["left", "right", "up", "down", "jump", "dash", "grab"].includes(action)) {
                                bindings[other] = bindings[other].filter((existing) => existing !== code);
                            }
                        }
                        bindings[action] = [code, ...(bindings[action] || []).filter((existing) => existing !== code)].slice(0, 2);
                        setSetting("bindings", bindings);
                        audio.ui("confirm");
                    } else {
                        audio.ui("back");
                    }
                    setTimeout(() => {
                        menu.active = true;
                        menu.refresh();
                    }, 120);
                });
            }
        }));
        items.forEach((item) => {
            item.type = "button";
            item.decorate = (row) => {
                const value = document.createElement("span");
                value.className = "value";
                row.appendChild(value);
            };
        });
        items.push(
            { id: "defaults", label: "controls.defaults", action: () => { setSetting("bindings", structuredClone(DEFAULT_BINDINGS)); menu.refresh(); } },
            { id: "back", label: "menu.back", action: () => this.back() }
        );
        menu = this.#menu(screen, panel, items, { onBack: () => this.back() });
        const refreshValues = () => menu.items.forEach((item, i) => {
            const value = menu.rows[i].querySelector(".value");
            if (value && item.valueText) value.textContent = item.valueText();
        });
        refreshValues();
        const original = menu.refresh.bind(menu);
        menu.refresh = () => {
            original();
            refreshValues();
        };
        this.#hint(panel, "hint.controls");
        screen.cleanup.push(() => input.cancelCapture());
    }

    /**
     * Language selection with the provided flags.
     *
     * @param {*} screen - Screen record.
     * @returns {void}
     */
    #language(screen) {
        const panel = this.#layout(screen.elem, "menu.language");
        const items = LANGUAGES.map((language) => ({
            id: language.code,
            text: language.name,
            decorate: (row) => {
                const flag = document.createElement("span");
                flag.className = "flag";
                flag.style.backgroundPosition = `${-language.flag.x / 2}px ${-language.flag.y / 2}px`;
                row.prepend(flag);
                if (language.code === getLanguage()) row.dataset.current = "true";
            },
            action: async () => {
                setSetting("language", language.code);
                await setLanguage(language.code);
            }
        }));
        items.push({ id: "back", label: "menu.back", action: () => this.back() });
        this.#menu(screen, panel, items, { onBack: () => this.back(), selected: screen.params?.selected || getLanguage() });
        this.#hint(panel, "hint.language");
    }

    /**
     * Scrolling credits.
     *
     * @param {*} screen - Screen record.
     * @returns {void}
     */
    #credits(screen) {
        const elem = screen.elem;
        elem.appendChild(this.#makeBackdrop());
        elem.appendChild(Object.assign(document.createElement("div"), { className: "screen-dim" }));
        const roll = document.createElement("div");
        roll.className = "credits-roll";
        const sections = [
            ["", ["credits.title"]],
            ["credits.remake", ["credits.remakeBy"]],
            ["credits.original", ["credits.originalBy", "credits.originalTeam"]],
            ["credits.art", ["credits.artBy", "credits.portraits", "credits.icons"]],
            ["credits.audio", ["credits.audioBy", "credits.procedural"]],
            ["credits.font", ["credits.fontBy"]],
            ["credits.thanks", ["credits.thanksText"]]
        ];
        for (const [heading, lines] of sections) {
            if (heading) {
                const h = document.createElement("h2");
                h.textContent = t(heading);
                roll.appendChild(h);
            }
            for (const key of lines) {
                const p = document.createElement("p");
                p.textContent = t(key);
                if (key === "credits.title") p.className = "credits-title";
                roll.appendChild(p);
            }
        }
        elem.appendChild(roll);
        const menuHost = document.createElement("div");
        menuHost.style.position = "absolute";
        menuHost.style.left = "24px";
        menuHost.style.bottom = "18px";
        elem.appendChild(menuHost);
        this.#menu(screen, menuHost, [{ id: "back", label: "menu.back", action: () => this.back() }], { onBack: () => this.back() });
        roll.addEventListener("animationend", () => this.current?.name === "credits" && this.back());
    }

    /**
     * Pause menu shown over the game.
     *
     * @param {*} screen - Screen record.
     * @returns {void}
     */
    #pause(screen) {
        const elem = screen.elem;
        elem.appendChild(Object.assign(document.createElement("div"), { className: "screen-dim" }));
        const panel = document.createElement("div");
        panel.className = "center-panel";
        panel.innerHTML = `<div class="menu-heading"><span>${t("pause.title")}</span></div>`;
        elem.appendChild(panel);
        const items = [{ id: "resume", label: "pause.resume", action: () => this.actions.resume() }];
        if (this.actions.inCutscene()) items.push({ id: "skip", label: "pause.skip", action: () => this.actions.skipCutscene() });
        items.push(
            { id: "retry", label: "pause.retry", action: () => this.actions.retry(), disabled: () => this.actions.inCutscene() },
            { id: "history", label: "pause.history", action: () => this.show("history"), disabled: () => !this.actions.history().length },
            { id: "settings", label: "menu.settings", action: () => this.show("settings", { inGame: true }) },
            { id: "restart", label: "pause.restart", action: () => this.show("confirm", { inGame: true, text: "confirm.restart", yes: () => this.actions.restartChapter() }) },
            { id: "quit", label: "pause.quit", action: () => this.actions.quitToMenu() }
        );
        this.#menu(screen, panel, items, { onBack: () => this.actions.resume() });
        const close = events.on("input:ui", (event) => {
            if (event.action === "pause" && !event.repeat && this.current === screen) this.actions.resume();
        });
        screen.cleanup.push(close);
    }

    /**
     * Dialogue history log.
     *
     * @param {*} screen - Screen record.
     * @returns {void}
     */
    #history(screen) {
        const elem = screen.elem;
        elem.appendChild(Object.assign(document.createElement("div"), { className: "screen-dim" }));
        const panel = document.createElement("div");
        panel.className = "center-panel";
        panel.style.width = "760px";
        panel.innerHTML = `<div class="menu-heading"><span>${t("pause.history")}</span></div>`;
        const list = document.createElement("div");
        list.className = "history-list";
        for (const entry of this.actions.history()) {
            const p = document.createElement("p");
            const name = document.createElement("b");
            name.textContent = t(`speaker.${entry.speaker}`);
            p.append(name, entry.text);
            list.appendChild(p);
        }
        panel.appendChild(list);
        elem.appendChild(panel);
        requestAnimationFrame(() => {
            list.scrollTop = list.scrollHeight;
        });
        this.#menu(screen, panel, [{ id: "back", label: "menu.back", action: () => this.back() }], { onBack: () => this.back() });
        const scroll = events.on("input:ui", (event) => {
            if (event.action === "up") list.scrollTop -= 40;
            if (event.action === "down") list.scrollTop += 40;
        });
        screen.cleanup.push(scroll);
    }

    /**
     * Chapter results.
     *
     * @param {*} screen - Screen record.
     * @param {{ chapter: *, session: *, result: *, hasNext: boolean, next: () => void }} params - Result data.
     * @returns {void}
     */
    #complete(screen, params) {
        const elem = screen.elem;
        elem.appendChild(Object.assign(document.createElement("div"), { className: "screen-dim" }));
        const panel = document.createElement("div");
        panel.className = "center-panel";
        panel.innerHTML = `<div class="menu-heading"><span>${t("complete.title")}</span></div>`;
        const name = document.createElement("div");
        name.className = "confirm-text";
        name.textContent = t(params.chapter.nameKey);
        const results = document.createElement("div");
        results.className = "results";
        const row = (icon, label, value, cls = "") => {
            const l = document.createElement("div");
            l.className = "label";
            if (icon) l.appendChild(createIcon(icon, 22));
            l.append(t(label));
            const v = document.createElement("div");
            v.className = `val ${cls}`;
            v.textContent = value;
            results.append(l, v);
        };
        const session = params.session;
        row("strawberry", "complete.strawberries", `${session.strawberries.size} / ${params.chapter.strawberries}`);
        row("clock", "complete.time", formatPrecise(session.elapsed));
        row("skull", "complete.deaths", String(session.deaths));
        row("goldHeart", "complete.score", String(params.result.score), "score");
        panel.append(name, results);
        elem.appendChild(panel);
        const items = [];
        if (params.hasNext) items.push({ id: "next", label: "complete.next", action: () => params.next() });
        items.push(
            { id: "chapters", label: "menu.chapters", action: () => this.actions.quitToMenu("chapters") },
            { id: "menu", label: "pause.quit", action: () => this.actions.quitToMenu() }
        );
        this.#menu(screen, panel, items);
    }

    /**
     * Game over screen when lives or time run out.
     *
     * @param {*} screen - Screen record.
     * @param {{ reason: string }} params - Why the run ended.
     * @returns {void}
     */
    #gameover(screen, params) {
        const elem = screen.elem;
        elem.appendChild(Object.assign(document.createElement("div"), { className: "screen-dim" }));
        const panel = document.createElement("div");
        panel.className = "center-panel";
        panel.innerHTML = `<div class="menu-heading"><span>${t("gameover.title")}</span></div>`;
        const text = document.createElement("div");
        text.className = "confirm-text";
        text.textContent = t(params?.reason === "time" ? "gameover.time" : "gameover.lives");
        panel.appendChild(text);
        elem.appendChild(panel);
        this.#menu(screen, panel, [
            { id: "restart", label: "pause.restart", action: () => this.actions.restartChapter() },
            { id: "menu", label: "pause.quit", action: () => this.actions.quitToMenu() }
        ]);
    }

    /**
     * Yes or no confirmation.
     *
     * @param {*} screen - Screen record.
     * @param {{ text: string, yes: () => void, no?: () => void, yesLabel?: string, noLabel?: string, inGame?: boolean }} params - Prompt.
     * @returns {void}
     */
    #confirm(screen, params) {
        const elem = screen.elem;
        if (!params.inGame) elem.appendChild(this.#makeBackdrop());
        elem.appendChild(Object.assign(document.createElement("div"), { className: "screen-dim" }));
        const panel = document.createElement("div");
        panel.className = "center-panel";
        const text = document.createElement("div");
        text.className = "confirm-text";
        text.textContent = t(params.text);
        panel.appendChild(text);
        elem.appendChild(panel);
        this.#menu(screen, panel, [
            { id: "yes", label: params.yesLabel || "option.yes", action: () => params.yes() },
            { id: "no", label: params.noLabel || "option.no", action: () => (params.no ? params.no() : this.back()) }
        ], { onBack: () => this.back(), selected: "no" });
    }
}
