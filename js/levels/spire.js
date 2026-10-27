import { chapterFromLevel } from "./customLevel.js";

/**
 * Chapter 4: The Shattered Spire. An optional, very hard climb after the
 * summit with a puzzle in every part: a hidden key, a rubble floor, a hall of
 * touch switches and a seeker on the ridge. It is written in the same level
 * format the editor saves, so it can be opened in developer mode as an
 * example.
 *
 * @type {import("../core/session.js").ChapterDefinition}
 */
export const shatteredSpire = chapterFromLevel("./js/data/levels/shattered-spire.json", {
    id: "shattered-spire",
    number: 4,
    nameKey: "chapter.spire.name",
    subtitleKey: "chapter.spire.subtitle",
    art: "./assets/generated/checkpoints/spire.png",
    strawberries: 3,
    custom: false,
    settings: { theme: "summit", weather: "heavy", music: "anxiety", timeLimit: 1080, lives: 35 },
    checkpointNames: {
        cp1: "checkpoint.spire.cp1",
        cp2: "checkpoint.spire.door",
        cp3: "checkpoint.spire.cp2",
        cp4: "checkpoint.spire.cp3",
        cp5: "checkpoint.spire.cp4",
        cp6: "checkpoint.spire.cp5"
    }
});
