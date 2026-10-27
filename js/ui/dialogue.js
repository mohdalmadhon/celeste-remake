import { events } from "../core/events.js";
import { t } from "../core/i18n.js";
import { audio } from "../systems/audio.js";
import { input } from "../systems/input.js";

/**
 * Portrait strip description.
 *
 * @typedef {object} PortraitSet
 * @property {string} sheet - Sheet URL.
 * @property {number} cell - Source cell size in pixels.
 * @property {number} sheetWidth - Source sheet width.
 * @property {number} sheetHeight - Source sheet height.
 * @property {Record<string, [number, number]>} emotions - Row and frame count per emotion.
 */

/**
 * Speaker description used by the dialogue box.
 *
 * @typedef {object} Speaker
 * @property {string} nameKey - Translation key of the display name.
 * @property {"left"|"right"} side - Portrait side.
 * @property {PortraitSet|null} portraits - Animated portrait strips.
 * @property {Record<string, string>} [images] - Static portrait per emotion.
 * @property {string} color - Name tag colour.
 * @property {(emotion: string) => void} voice - Plays one voice blip.
 * @property {string} [className] - Extra CSS class for the box.
 */

const MADELINE_VOICE = "assets/soundTrack/all_sounds/Madeline/";
const VOICE_EMOTIONS = {
    normal: "normal", angry: "angry", deadpan: "deadpan", determined: "determined", distracted: "distracted",
    panic: "panic", peaceful: "normal", sad: "sad", sadder: "sadder", surprised: "surprised", together: "determined", upset: "upset"
};

/**
 * Plays a Madeline voice blip for an emotion.
 *
 * @param {string} emotion - Portrait emotion.
 * @param {number} [rate=1] - Playback rate.
 * @returns {void}
 */
function madelineVoice(emotion, rate = 1) {
    const voice = VOICE_EMOTIONS[emotion] || "normal";
    const variant = ["A", "B", "C"][Math.floor(Math.random() * 3)];
    audio.playVariant(`${MADELINE_VOICE}${voice}_mid_${variant}`, 10, { bus: "voice", volume: 0.5, rate });
}

/**
 * Synthesised voice blip for characters without recorded voices.
 *
 * @param {number} base - Base frequency in hertz.
 * @param {OscillatorType} type - Waveform.
 * @returns {void}
 */
function synthVoice(base, type) {
    audio.tone(base * (0.9 + Math.random() * 0.25), 0.07, 0.09, "voice", undefined, type);
}

/**
 * Every speaker that can appear in dialogue.
 *
 * @type {Record<string, Speaker>}
 */
export const SPEAKERS = {
    madeline: {
        nameKey: "speaker.madeline",
        side: "left",
        color: "#ff6f7f",
        portraits: {
            sheet: "./assets/generated/portraits/madeline.png", cell: 160, sheetWidth: 1120, sheetHeight: 1920,
            emotions: { normal: [0, 7], angry: [1, 7], deadpan: [2, 7], determined: [3, 7], distracted: [4, 7], panic: [5, 5], peaceful: [6, 4], sad: [7, 7], sadder: [8, 7], surprised: [9, 7], together: [10, 7], upset: [11, 7] }
        },
        voice: (emotion) => madelineVoice(emotion)
    },
    badeline: {
        nameKey: "speaker.badeline",
        side: "right",
        color: "#c58cff",
        className: "speaker-echo",
        portraits: {
            sheet: "./assets/generated/portraits/madeline_echo.png", cell: 160, sheetWidth: 1120, sheetHeight: 1440,
            emotions: { normal: [0, 7], angry: [1, 7], deadpan: [2, 7], determined: [3, 7], distracted: [4, 7], panic: [5, 7], sad: [6, 7], surprised: [7, 7], upset: [8, 7] }
        },
        voice: (emotion) => madelineVoice(emotion, 0.78)
    },
    granny: {
        nameKey: "speaker.granny",
        side: "right",
        color: "#9fd18b",
        portraits: null,
        images: { normal: "./assets/faces/grany.png", laugh: "./assets/faces/granyLaugh.png" },
        voice: () => audio.play(`assets/soundTrack/grany/talk${1 + Math.floor(Math.random() * 3)}.wav`, { bus: "voice", volume: 0.35, rate: 1.4 + Math.random() * 0.2 })
    },
    oshiro: {
        nameKey: "speaker.oshiro",
        side: "right",
        color: "#7fd6c4",
        portraits: {
            sheet: "./assets/faces/oshiro.png", cell: 160, sheetWidth: 2300, sheetHeight: 1280,
            emotions: { normal: [0, 14], nervous: [1, 10], serious: [2, 10], dramatic: [3, 8], losing: [4, 8], sideHappy: [5, 10], sideSuspicious: [6, 10], sideWorried: [7, 11] }
        },
        voice: () => synthVoice(190, "square")
    },
    theo: {
        nameKey: "speaker.theo",
        side: "right",
        color: "#f2b66d",
        portraits: {
            sheet: "./assets/generated/portraits/theo.png", cell: 160, sheetWidth: 1120, sheetHeight: 1280,
            emotions: { normal: [0, 7], excited: [1, 7], nailedIt: [2, 4], serious: [3, 7], thinking: [4, 7], worried: [5, 7], wtf: [6, 7], yolo: [7, 4] }
        },
        voice: () => synthVoice(150, "triangle")
    },
    theoEcho: {
        nameKey: "speaker.theoEcho",
        side: "right",
        color: "#c9b7ff",
        className: "speaker-echo",
        portraits: {
            sheet: "./assets/generated/portraits/theo_echo.png", cell: 160, sheetWidth: 1120, sheetHeight: 640,
            emotions: { normal: [0, 7], excited: [1, 7], serious: [2, 7], worried: [3, 7] }
        },
        voice: () => synthVoice(140, "sine")
    },
    grannyEcho: {
        nameKey: "speaker.grannyEcho",
        side: "right",
        color: "#c9e8bf",
        className: "speaker-echo",
        portraits: null,
        images: { normal: "./assets/faces/grany.png", laugh: "./assets/faces/granyLaugh.png" },
        voice: () => audio.play(`assets/soundTrack/grany/talk${1 + Math.floor(Math.random() * 3)}.wav`, { bus: "voice", volume: 0.25, rate: 1.2 })
    },
    narrator: {
        nameKey: "",
        side: "left",
        color: "#fff",
        className: "speaker-narrator",
        portraits: null,
        voice: () => {}
    }
};

/**
 * One line of dialogue.
 *
 * @typedef {object} DialogueLine
 * @property {string} speaker - Key of {@link SPEAKERS}.
 * @property {string} [key] - Translation key of the text.
 * @property {string} [text] - Literal text, used instead of a key by levels made in the editor.
 * @property {string} [emotion="normal"] - Portrait emotion.
 * @property {Record<string, string|number>} [params] - Translation parameters.
 * @property {() => void} [onShow] - Called when the line appears, used for scene animation.
 */

const CHARS_PER_SECOND = 45;
const ADVANCE_GUARD = 0.12;

/**
 * Celeste-style dialogue box with animated portraits, speaker names,
 * typewriter text with voice blips, instant reveal, line history and
 * localisation-aware text.
 */
export class Dialogue {
    /** @type {HTMLElement} */
    root;
    /** @type {Array<{ speaker: string, text: string }>} */
    history = [];
    /** @type {boolean} */
    active = false;
    /** @type {boolean} */
    paused = false;
    /** @type {boolean} */
    #skipping = false;
    /** @type {Function|null} */
    #advance = null;
    /** @type {number} */
    #reveal = 0;
    /** @type {string} */
    #text = "";
    /** @type {number} */
    #guard = 0;
    /** @type {DialogueLine|null} */
    #line = null;
    /** @type {number} */
    #portraitTimer = 0;
    /** @type {number} */
    #portraitFrame = 0;
    /** @type {number} */
    #blip = 0;
    /** @type {number} */
    #pause = 0;

    /**
     * @param {HTMLElement} root - Dialogue container.
     */
    constructor(root) {
        this.root = root;
        root.innerHTML = `
            <div class="dialogue-box">
                <div class="dialogue-portrait"><div class="portrait-image"></div></div>
                <div class="dialogue-body">
                    <div class="dialogue-name"></div>
                    <p class="dialogue-text"></p>
                </div>
                <div class="dialogue-next" aria-hidden="true"></div>
            </div>`;
        this.box = root.querySelector(".dialogue-box");
        this.portrait = root.querySelector(".portrait-image");
        this.nameTag = root.querySelector(".dialogue-name");
        this.textElem = root.querySelector(".dialogue-text");
        this.textElem.setAttribute("aria-live", "polite");
        events.on("input:ui", ({ action }) => {
            if (!this.active || this.#guard > 0 || this.paused) return;
            if (action === "confirm" || action === "jump") this.#press();
        });
        root.addEventListener("pointerdown", () => {
            if (this.active && this.#guard <= 0) this.#press();
        });
    }

    /**
     * Handles an advance press: reveals the line or moves on.
     *
     * @returns {void}
     */
    #press() {
        if (this.#reveal < this.#text.length) {
            this.#reveal = this.#text.length;
            this.#renderText();
            this.#guard = ADVANCE_GUARD;
            return;
        }
        this.#advance?.();
    }

    /**
     * Plays a sequence of lines and resolves when the last one is dismissed.
     *
     * @param {DialogueLine[]} lines - Lines to show.
     * @returns {Promise<void>} Resolves after the final line.
     */
    async play(lines) {
        this.active = true;
        this.#skipping = false;
        this.root.classList.remove("hidden");
        audio.duckMusic(true);
        for (const line of lines) {
            if (this.#skipping) {
                line.onShow?.();
                this.history.push({ speaker: line.speaker, text: line.text ?? t(line.key, line.params) });
                continue;
            }
            await this.#show(line);
        }
        this.root.classList.add("hidden");
        this.active = false;
        audio.duckMusic(false);
        input.consume("jump");
        input.consume("confirm");
        input.consume("dash");
    }

    /**
     * Shows one line and waits for it to be dismissed.
     *
     * @param {DialogueLine} line - The line.
     * @returns {Promise<void>} Resolves on advance.
     */
    #show(line) {
        const speaker = SPEAKERS[line.speaker] || SPEAKERS.narrator;
        this.#line = line;
        this.#text = line.text ?? t(line.key, line.params);
        this.#reveal = 0;
        this.#pause = 0;
        this.#guard = ADVANCE_GUARD;
        this.#portraitFrame = 0;
        this.box.className = `dialogue-box side-${speaker.side} ${speaker.className || ""}`;
        this.box.classList.remove("pop");
        void this.box.offsetWidth;
        this.box.classList.add("pop");
        this.nameTag.textContent = speaker.nameKey ? t(speaker.nameKey) : "";
        this.nameTag.style.color = speaker.color;
        this.nameTag.classList.toggle("hidden", !speaker.nameKey);
        this.#setPortrait(speaker, line.emotion || "normal", 0);
        this.#renderText();
        this.history.push({ speaker: line.speaker, text: this.#text });
        if (this.history.length > 80) this.history.shift();
        line.onShow?.();
        return new Promise((resolve) => {
            this.#advance = () => {
                this.#advance = null;
                audio.ui("move");
                resolve();
            };
        });
    }

    /**
     * Shows a portrait frame.
     *
     * @param {Speaker} speaker - Current speaker.
     * @param {string} emotion - Emotion name.
     * @param {number} frame - Frame index.
     * @returns {void}
     */
    #setPortrait(speaker, emotion, frame) {
        const style = this.portrait.style;
        const holder = this.portrait.parentElement;
        holder.classList.toggle("hidden", !speaker.portraits && !speaker.images);
        if (speaker.portraits) {
            const set = speaker.portraits;
            const [row, count] = set.emotions[emotion] || set.emotions.normal;
            const size = 120;
            const scale = size / set.cell;
            style.backgroundImage = `url("${set.sheet}")`;
            style.backgroundSize = `${set.sheetWidth * scale}px ${set.sheetHeight * scale}px`;
            style.backgroundPosition = `${-(frame % count) * set.cell * scale}px ${-row * set.cell * scale}px`;
        } else if (speaker.images) {
            style.backgroundImage = `url("${speaker.images[emotion] || speaker.images.normal}")`;
            style.backgroundSize = "100% 100%";
            style.backgroundPosition = "0 0";
        }
    }

    /**
     * Writes the revealed part of the text.
     *
     * @returns {void}
     */
    #renderText() {
        const shown = this.#text.slice(0, Math.floor(this.#reveal));
        this.textElem.textContent = shown;
        this.box.classList.toggle("complete", this.#reveal >= this.#text.length);
    }

    /**
     * Advances the typewriter and portrait animation each frame.
     *
     * @param {number} dt - Frame time in seconds.
     * @returns {void}
     */
    update(dt) {
        if (!this.active || !this.#line) return;
        this.#guard = Math.max(0, this.#guard - dt);
        const speaker = SPEAKERS[this.#line.speaker] || SPEAKERS.narrator;
        if (this.#reveal < this.#text.length) {
            if (this.#pause > 0) {
                this.#pause -= dt;
            } else {
                const before = Math.floor(this.#reveal);
                this.#reveal = Math.min(this.#text.length, this.#reveal + dt * CHARS_PER_SECOND);
                const after = Math.floor(this.#reveal);
                if (after !== before) {
                    const ch = this.#text[after - 1];
                    if (".!?…".includes(ch)) this.#pause = 0.18;
                    else if (",;:".includes(ch)) this.#pause = 0.08;
                    this.#blip -= after - before;
                    if (this.#blip <= 0 && ch.trim()) {
                        this.#blip = 3;
                        speaker.voice(this.#line.emotion || "normal");
                    }
                    this.#renderText();
                }
            }
            this.#portraitTimer += dt;
            if (this.#portraitTimer > 0.09) {
                this.#portraitTimer = 0;
                this.#portraitFrame++;
                this.#setPortrait(speaker, this.#line.emotion || "normal", this.#portraitFrame);
            }
        } else if (this.#portraitFrame !== 0) {
            this.#portraitFrame = 0;
            this.#setPortrait(speaker, this.#line.emotion || "normal", 0);
        }
    }

    /**
     * Finishes the current conversation immediately, used when skipping cutscenes.
     *
     * @returns {void}
     */
    skip() {
        if (!this.active) return;
        this.#skipping = true;
        this.#reveal = this.#text.length;
        this.#advance?.();
    }
}
