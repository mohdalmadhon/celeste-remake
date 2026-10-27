import { chapterFromLevel } from "./customLevel.js";

/**
 * Chapter 4: The Shattered Spire. An optional, very hard climb after the
 * summit, written in the same level format the editor saves, so it can be
 * opened in developer mode as an example.
 *
 * @type {import("../core/session.js").ChapterDefinition}
 */
export const shatteredSpire = chapterFromLevel("./js/data/levels/shattered-spire.json", {
    id: "shattered-spire",
    number: 4,
    nameKey: "chapter.spire.name",
    subtitleKey: "chapter.spire.subtitle",
    art: "./assets/generated/checkpoints/spire.png",
    strawberries: 2,
    custom: false,
    settings: { theme: "summit", weather: "heavy", timeLimit: 900, lives: 30 },
    checkpointNames: {
        cp1: "checkpoint.spire.cp1",
        cp2: "checkpoint.spire.cp2",
        cp3: "checkpoint.spire.cp3",
        cp4: "checkpoint.spire.cp4",
        cp5: "checkpoint.spire.cp5"
    }
});
