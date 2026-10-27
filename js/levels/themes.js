const GEN = "./assets/generated/parallax/";

/**
 * Parallax layer presets for each chapter environment, back to front.
 * The first entry without an image becomes the sky behind every layer.
 *
 * @type {Record<string, import("../systems/parallax.js").ParallaxLayer[]>}
 */
export const THEMES = {
    forest: [
        { background: "linear-gradient(180deg, #0b0d2a 0%, #1d1f4a 45%, #3a3468 100%)" },
        { src: `${GEN}stars.png`, width: 480, height: 200, scale: 2.5, factorX: 0.02, factorY: 0.01, y: -40 },
        { src: `${GEN}mountains_far.png`, width: 480, height: 89, scale: 2.5, factorX: 0.08, factorY: 0.03, y: 170, opacity: 0.9 },
        { src: `${GEN}mountains_mid.png`, width: 480, height: 48, scale: 2.5, factorX: 0.16, factorY: 0.06, y: 290 },
        { src: "./assets/bg2.png", width: 1672, height: 941, scale: 0.62, factorX: 0.32, factorY: 0.12, y: -40, opacity: 0.95 },
        { src: `${GEN}fog.png`, width: 480, height: 95, scale: 2.5, factorX: 0.45, factorY: 0.15, y: 300, drift: 12, opacity: 0.8 }
    ],
    city: [
        { background: "linear-gradient(180deg, #120f30 0%, #25245a 50%, #4b4580 100%)" },
        { src: `${GEN}stars.png`, width: 480, height: 200, scale: 2.5, factorX: 0.02, factorY: 0.02, y: -20 },
        { src: `${GEN}mountains_far.png`, width: 480, height: 89, scale: 2.5, factorX: 0.06, factorY: 0.05, y: 230, opacity: 0.85 },
        { src: `${GEN}mountains_mid.png`, width: 480, height: 48, scale: 2.5, factorX: 0.12, factorY: 0.08, y: 340 },
        { src: `${GEN}hills_near.png`, width: 480, height: 39, scale: 2.5, factorX: 0.22, factorY: 0.12, y: 410 },
        { src: `${GEN}fog.png`, width: 480, height: 95, scale: 2.5, factorX: 0.35, factorY: 0.1, y: 330, drift: 18, opacity: 0.7 }
    ],
    resort: [
        { background: "linear-gradient(180deg, #120a1e 0%, #24143a 55%, #3a1f4e 100%)" },
        { src: `${GEN}resort_far.png`, width: 480, height: 200, scale: 2.5, factorX: 0.08, factorY: 0.04, y: 20, opacity: 0.55 },
        { src: `${GEN}fog.png`, width: 480, height: 95, scale: 2.5, factorX: 0.3, factorY: 0.05, y: 340, drift: -8, opacity: 0.45 }
    ],
    summit: [
        { background: "linear-gradient(180deg, #060818 0%, #141a44 45%, #3b3a78 100%)" },
        { src: `${GEN}stars.png`, width: 480, height: 200, scale: 2.5, factorX: 0.01, factorY: 0.005, y: -60 },
        { src: `${GEN}aurora.png`, width: 480, height: 200, scale: 2.5, factorX: 0.03, factorY: 0.01, y: -40, drift: 6, opacity: 0.8 },
        { src: `${GEN}mountains_far.png`, width: 480, height: 89, scale: 2.5, factorX: 0.05, factorY: 0.02, y: 330, opacity: 0.8 },
        { src: `${GEN}mountains_mid.png`, width: 480, height: 48, scale: 2.5, factorX: 0.1, factorY: 0.03, y: 450 },
        { src: `${GEN}fog.png`, width: 480, height: 95, scale: 2.5, factorX: 0.25, factorY: 0.04, y: 330, drift: 40, opacity: 0.9 }
    ],
    menu: [
        { background: "linear-gradient(180deg, #0d0f2c 0%, #2b2460 100%)" }
    ]
};
