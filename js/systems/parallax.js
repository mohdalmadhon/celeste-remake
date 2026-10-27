import { VIEW_HEIGHT, VIEW_WIDTH } from "../core/constants.js";
import { snapPixel } from "../core/pixels.js";

/**
 * One background layer.
 *
 * @typedef {object} ParallaxLayer
 * @property {string} [src] - Image URL. Omit for a solid gradient layer.
 * @property {string} [background] - CSS background used instead of an image.
 * @property {number} [factorX=0] - Fraction of camera movement applied horizontally.
 * @property {number} [factorY=0] - Fraction of camera movement applied vertically.
 * @property {number} [scale=1] - Pixel scale applied to the image.
 * @property {number} [width] - Source image width, needed for horizontal tiling.
 * @property {number} [height] - Source image height.
 * @property {number} [y=0] - Vertical offset of the layer in screen pixels.
 * @property {boolean} [repeat=true] - Whether the image tiles horizontally.
 * @property {number} [drift=0] - Constant horizontal scroll in pixels per second.
 * @property {number} [opacity=1] - Layer opacity.
 * @property {boolean} [cover=false] - Stretch the image to cover the viewport.
 */

/**
 * Multi-layer parallax background driven by the camera position.
 */
export class Parallax {
    /** @type {HTMLDivElement} */
    root;
    /** @type {Array<{ config: ParallaxLayer, elem: HTMLDivElement, tileWidth: number, offset: number, last: string }>} */
    #layers = [];

    /**
     * @param {HTMLElement} container - Element the background is appended to.
     */
    constructor(container) {
        this.root = document.createElement("div");
        this.root.className = "parallax";
        container.prepend(this.root);
    }

    /**
     * Replaces the background layers.
     *
     * @param {ParallaxLayer[]} layers - Layer configuration from back to front.
     * @returns {void}
     */
    set(layers) {
        this.root.textContent = "";
        this.root.style.background = "";
        this.#layers = [];
        for (const config of layers) {
            if (!config.src) {
                this.root.style.background = config.background || "";
                continue;
            }
            const elem = document.createElement("div");
            elem.className = "parallax-layer";
            const scale = config.scale ?? 1;
            const tileWidth = config.width ? config.width * scale : VIEW_WIDTH;
            if (config.src) {
                elem.style.backgroundImage = `url("${config.src}")`;
                if (config.cover) {
                    elem.style.backgroundSize = "cover";
                    elem.style.backgroundPosition = "center";
                    elem.style.width = `${VIEW_WIDTH + 160}px`;
                    elem.style.height = `${VIEW_HEIGHT + 120}px`;
                    elem.style.left = "-80px";
                    elem.style.top = "-60px";
                } else {
                    elem.style.backgroundSize = `${tileWidth}px ${(config.height ?? VIEW_HEIGHT) * scale}px`;
                    elem.style.backgroundRepeat = config.repeat === false ? "no-repeat" : "repeat-x";
                    elem.style.width = `${Math.ceil(VIEW_WIDTH / tileWidth + 1) * tileWidth}px`;
                    elem.style.height = `${(config.height ?? VIEW_HEIGHT) * scale}px`;
                    elem.style.top = `${config.y ?? 0}px`;
                }
            }
            if (config.opacity !== undefined) elem.style.opacity = String(config.opacity);
            this.root.appendChild(elem);
            this.#layers.push({ config, elem, tileWidth, offset: 0, last: "" });
        }
    }

    /**
     * Repositions layers for the current camera position.
     *
     * @param {{ x: number, y: number }} camera - Camera top-left position.
     * @param {number} dt - Frame time in seconds, used for drifting layers.
     * @returns {void}
     */
    render(camera, dt) {
        for (const layer of this.#layers) {
            const { config } = layer;
            layer.offset += (config.drift ?? 0) * dt;
            if (config.cover) {
                const x = -Math.max(-80, Math.min(80, camera.x * (config.factorX ?? 0) % 160));
                const y = -Math.max(-60, Math.min(60, camera.y * (config.factorY ?? 0)));
                const transform = `translate3d(${snapPixel(x)}px,${snapPixel(y)}px,0)`;
                if (transform !== layer.last) {
                    layer.last = transform;
                    layer.elem.style.transform = transform;
                }
                continue;
            }
            const raw = camera.x * (config.factorX ?? 0) - layer.offset;
            const x = -(((raw % layer.tileWidth) + layer.tileWidth) % layer.tileWidth);
            const y = -camera.y * (config.factorY ?? 0);
            const transform = `translate3d(${snapPixel(x)}px,${snapPixel(y)}px,0)`;
            if (transform !== layer.last) {
                layer.last = transform;
                layer.elem.style.transform = transform;
            }
        }
    }
}
