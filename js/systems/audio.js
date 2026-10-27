import { events } from "../core/events.js";
import { settings } from "../core/settings.js";

const MAX_INSTANCES_PER_SOUND = 3;
const MIN_REPEAT_INTERVAL = 0.035;

/**
 * Options accepted when playing a sound effect.
 *
 * @typedef {object} SfxOptions
 * @property {number} [volume=1] - Gain multiplier.
 * @property {number} [rate=1] - Playback rate, which also shifts the pitch.
 * @property {number} [pan=0] - Stereo pan from -1 to 1.
 * @property {"sfx"|"ui"|"voice"} [bus="sfx"] - Mixer bus.
 * @property {boolean} [loop=false] - Whether the sound loops until stopped.
 */

/**
 * Web Audio based mixer with buses, a buffer cache, music crossfades and
 * procedural ambience for wind, blizzards and the hotel.
 */
export class AudioSystem {
    /** @type {AudioContext|null} */
    context = null;
    /** @type {Record<string, GainNode>} */
    buses = {};
    /** @type {Map<string, Promise<AudioBuffer|null>>} */
    #buffers = new Map();
    /** @type {Map<string, { count: number, last: number }>} */
    #instances = new Map();
    /** @type {{ path: string, element: HTMLAudioElement, source: MediaElementAudioSourceNode, gain: GainNode, volume: number }|null} */
    #music = null;
    /** @type {string|null} */
    #wantedMusic = null;
    /** @type {{ nodes: AudioNode[], gain: GainNode, kind: string }|null} */
    #ambience = null;
    /** @type {AudioBuffer|null} */
    #noise = null;

    /**
     * Registers the user gesture listeners that unlock audio playback.
     */
    constructor() {
        const unlock = () => this.unlock();
        window.addEventListener("pointerdown", unlock);
        window.addEventListener("keydown", unlock);
        events.on("settings:change", () => this.applyVolumes());
    }

    /**
     * Creates or resumes the audio context after a user gesture.
     *
     * @returns {void}
     */
    unlock() {
        if (!this.context) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            this.context = new AudioContextClass();
            const master = this.context.createGain();
            const compressor = this.context.createDynamicsCompressor();
            compressor.threshold.value = -10;
            compressor.ratio.value = 4;
            master.connect(compressor).connect(this.context.destination);
            this.buses.master = master;
            for (const name of ["music", "ambience", "sfx", "ui", "voice"]) {
                const gain = this.context.createGain();
                gain.connect(master);
                this.buses[name] = gain;
            }
            this.applyVolumes();
            events.emit("audio:ready");
        }
        if (this.context.state === "suspended") {
            this.context.resume();
        }
    }

    /**
     * Whether the audio context exists and is running.
     *
     * @returns {boolean} True when sounds can play.
     */
    get ready() {
        return Boolean(this.context && this.context.state === "running");
    }

    /**
     * Applies the volume settings to every bus.
     *
     * @returns {void}
     */
    applyVolumes() {
        if (!this.context) return;
        const now = this.context.currentTime;
        const set = (bus, value) => this.buses[bus]?.gain.setTargetAtTime(value, now, 0.03);
        set("master", settings.masterVolume);
        set("music", settings.musicVolume);
        set("ambience", settings.musicVolume * 0.9);
        set("sfx", settings.sfxVolume);
        set("ui", settings.sfxVolume * 0.7);
        set("voice", settings.sfxVolume * 0.75);
    }

    /**
     * Loads and decodes an audio file, caching the result.
     *
     * @param {string} path - URL of the audio file.
     * @returns {Promise<AudioBuffer|null>} The decoded buffer, or null on failure.
     */
    load(path) {
        if (!this.#buffers.has(path)) {
            const promise = fetch(encodeURI(path))
                .then((response) => {
                    if (!response.ok) throw new Error(`${response.status} ${path}`);
                    return response.arrayBuffer();
                })
                .then((data) => this.#decode(data))
                .catch(() => null);
            this.#buffers.set(path, promise);
        }
        return this.#buffers.get(path);
    }

    /**
     * Decodes audio data once a context exists.
     *
     * @param {ArrayBuffer} data - Encoded audio.
     * @returns {Promise<AudioBuffer>} Decoded buffer.
     */
    async #decode(data) {
        if (!this.context) {
            await new Promise((resolve) => events.once("audio:ready", resolve));
        }
        return this.context.decodeAudioData(data);
    }

    /**
     * Starts loading several sounds so they play without delay later.
     *
     * @param {string[]} paths - Audio URLs.
     * @returns {Promise<void>} Resolves when every file finished loading.
     */
    async preload(paths) {
        await Promise.all(paths.map((path) => this.load(path)));
    }

    /**
     * Plays a sound effect, skipping it when too many copies already overlap.
     *
     * @param {string} path - Audio URL.
     * @param {SfxOptions} [options] - Playback options.
     * @returns {Promise<{ stop: Function }|null>} A handle that can stop the sound.
     */
    async play(path, options = {}) {
        if (!this.context) return null;
        const now = this.context.currentTime;
        const record = this.#instances.get(path) || { count: 0, last: -1 };
        if (record.count >= MAX_INSTANCES_PER_SOUND || now - record.last < MIN_REPEAT_INTERVAL) {
            return null;
        }
        record.last = now;
        this.#instances.set(path, record);
        const buffer = await this.load(path);
        if (!buffer) return null;
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.loop = Boolean(options.loop);
        source.playbackRate.value = options.rate ?? 1;
        const gain = this.context.createGain();
        gain.gain.value = options.volume ?? 1;
        let node = source.connect(gain);
        if (options.pan && this.context.createStereoPanner) {
            const panner = this.context.createStereoPanner();
            panner.pan.value = Math.max(-1, Math.min(1, options.pan));
            node = node.connect(panner);
        }
        node.connect(this.buses[options.bus || "sfx"]);
        record.count++;
        source.onended = () => {
            record.count = Math.max(0, record.count - 1);
        };
        source.start();
        return {
            stop: (fade = 0.05) => {
                const t = this.context.currentTime;
                gain.gain.setTargetAtTime(0, t, fade / 3);
                source.stop(t + fade);
            }
        };
    }

    /**
     * Plays one random variant of a numbered sound family such as footsteps.
     *
     * @param {string} prefix - Path without the "_NN.wav" suffix.
     * @param {number} count - Number of variants available.
     * @param {SfxOptions} [options] - Playback options.
     * @returns {Promise<{ stop: Function }|null>} Sound handle.
     */
    playVariant(prefix, count, options) {
        const index = String(1 + Math.floor(Math.random() * count)).padStart(2, "0");
        return this.play(`${prefix}_${index}.wav`, options);
    }

    /**
     * Crossfades to a looping music track, leaving it alone if it is already playing.
     *
     * Music is streamed through an audio element instead of being decoded up
     * front, so long tracks start at once and do not sit in memory, while
     * still running through the music volume bus.
     *
     * @param {string|null} path - Music URL, or null to fade out.
     * @param {{ fade?: number, volume?: number }} [options] - Fade time and volume.
     * @returns {Promise<void>} Resolves once the new track started.
     */
    async playMusic(path, options = {}) {
        const fade = options.fade ?? 1.5;
        this.#wantedMusic = path;
        if (this.#music?.path === path) {
            if (options.volume !== undefined && this.context) {
                this.#music.volume = options.volume;
                this.#music.gain.gain.setTargetAtTime(options.volume, this.context.currentTime, 0.3);
            }
            return;
        }
        if (!this.context) {
            await new Promise((resolve) => events.once("audio:ready", resolve));
            if (this.#wantedMusic !== path) return;
        }
        const previous = this.#music;
        this.#music = null;
        if (previous) {
            const t = this.context.currentTime;
            previous.gain.gain.cancelScheduledValues(t);
            previous.gain.gain.setValueAtTime(previous.gain.gain.value, t);
            previous.gain.gain.linearRampToValueAtTime(0, t + fade);
            setTimeout(() => {
                previous.element.pause();
                previous.element.removeAttribute("src");
                previous.element.load();
                previous.source.disconnect();
            }, (fade + 0.1) * 1000);
        }
        if (!path) return;
        const element = new Audio();
        element.src = encodeURI(path);
        element.loop = true;
        element.preload = "auto";
        const source = this.context.createMediaElementSource(element);
        const gain = this.context.createGain();
        const volume = options.volume ?? 0.8;
        const t = this.context.currentTime;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume, t + fade);
        source.connect(gain).connect(this.buses.music);
        this.#music = { path, element, source, gain, volume };
        try {
            await element.play();
        } catch {
            if (this.#music?.element === element) this.#music = null;
        }
    }

    /**
     * Temporarily lowers the music, used while dialogue plays.
     *
     * @param {boolean} ducked - Whether the music should be ducked.
     * @returns {void}
     */
    duckMusic(ducked) {
        if (!this.#music || !this.context) return;
        this.#music.gain.gain.setTargetAtTime(this.#music.volume * (ducked ? 0.45 : 1), this.context.currentTime, 0.25);
    }

    /**
     * Returns a cached buffer of white noise for procedural sounds.
     *
     * @returns {AudioBuffer} Two seconds of noise.
     */
    #noiseBuffer() {
        if (!this.#noise) {
            const length = this.context.sampleRate * 2;
            this.#noise = this.context.createBuffer(1, length, this.context.sampleRate);
            const data = this.#noise.getChannelData(0);
            for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
        }
        return this.#noise;
    }

    /**
     * Starts procedural ambience for a chapter: wind, hotel hum or summit gusts.
     *
     * @param {"wind"|"blizzard"|"hotel"|"none"} kind - Ambience type.
     * @returns {void}
     */
    setAmbience(kind) {
        if (!this.context) {
            events.once("audio:ready", () => this.setAmbience(kind));
            return;
        }
        if (this.#ambience?.kind === kind) return;
        this.stopAmbience();
        if (kind === "none") return;
        const ctx = this.context;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(this.buses.ambience);
        const nodes = [];
        const noise = ctx.createBufferSource();
        noise.buffer = this.#noiseBuffer();
        noise.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = kind === "hotel" ? "lowpass" : "bandpass";
        filter.frequency.value = kind === "hotel" ? 180 : kind === "blizzard" ? 700 : 420;
        filter.Q.value = kind === "hotel" ? 0.7 : 0.9;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = kind === "blizzard" ? 0.23 : 0.08;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = kind === "hotel" ? 20 : kind === "blizzard" ? 380 : 220;
        lfo.connect(lfoGain).connect(filter.frequency);
        noise.connect(filter).connect(gain);
        noise.start();
        lfo.start();
        nodes.push(noise, lfo);
        if (kind === "hotel") {
            const hum = ctx.createOscillator();
            hum.type = "sine";
            hum.frequency.value = 55;
            const humGain = ctx.createGain();
            humGain.gain.value = 0.05;
            hum.connect(humGain).connect(gain);
            hum.start();
            nodes.push(hum);
        }
        const target = kind === "blizzard" ? 0.32 : kind === "hotel" ? 0.22 : 0.18;
        gain.gain.linearRampToValueAtTime(target, ctx.currentTime + 2.5);
        this.#ambience = { nodes, gain, kind };
    }

    /**
     * Fades out the current ambience.
     *
     * @returns {void}
     */
    stopAmbience() {
        if (!this.#ambience || !this.context) return;
        const { nodes, gain } = this.#ambience;
        const t = this.context.currentTime;
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(gain.gain.value, t);
        gain.gain.linearRampToValueAtTime(0, t + 1);
        for (const node of nodes) node.stop(t + 1.1);
        this.#ambience = null;
    }

    /**
     * Plays a short synthesised interface sound.
     *
     * @param {"move"|"confirm"|"back"|"toggle"|"slider"|"error"|"open"} kind - Sound type.
     * @returns {void}
     */
    ui(kind) {
        if (!this.context) return;
        const presets = {
            move: [[660, 0.05, 0.12]],
            confirm: [[660, 0.06, 0.16], [990, 0.08, 0.14]],
            back: [[520, 0.06, 0.14], [390, 0.08, 0.12]],
            toggle: [[740, 0.05, 0.13]],
            slider: [[880, 0.03, 0.08]],
            error: [[180, 0.12, 0.2]],
            open: [[440, 0.06, 0.12], [660, 0.06, 0.12], [880, 0.1, 0.1]]
        };
        let at = this.context.currentTime;
        for (const [frequency, duration, volume] of presets[kind] || presets.move) {
            this.tone(frequency, duration, volume, "ui", at, kind === "error" ? "square" : "triangle");
            at += duration * 0.8;
        }
    }

    /**
     * Plays a single synthesised tone.
     *
     * @param {number} frequency - Frequency in hertz.
     * @param {number} duration - Length in seconds.
     * @param {number} volume - Peak gain.
     * @param {string} [bus="sfx"] - Mixer bus.
     * @param {number} [at] - Context start time.
     * @param {OscillatorType} [type="triangle"] - Oscillator waveform.
     * @returns {void}
     */
    tone(frequency, duration, volume, bus = "sfx", at, type = "triangle") {
        if (!this.context) return;
        const start = at ?? this.context.currentTime;
        const osc = this.context.createOscillator();
        osc.type = type;
        osc.frequency.value = frequency;
        const gain = this.context.createGain();
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gain).connect(this.buses[bus]);
        osc.start(start);
        osc.stop(start + duration + 0.02);
    }
}

/**
 * Shared audio system instance.
 *
 * @type {AudioSystem}
 */
export const audio = new AudioSystem();
