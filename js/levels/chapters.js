import { forsakenCity } from "./firstLevel.js";
import { oshiroChase } from "./oshiroChase.js";
import { prologue } from "./tutorial.js";

/**
 * Every chapter in play order.
 *
 * @type {import("../core/session.js").ChapterDefinition[]}
 */
export const CHAPTERS = [prologue, forsakenCity, oshiroChase];
