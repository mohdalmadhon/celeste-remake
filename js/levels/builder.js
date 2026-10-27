import { TILE } from "../core/constants.js";
import { createBody } from "../systems/physics.js";

/**
 * Tile data as stored in the original level JSON files.
 *
 * @typedef {object} JsonTileGroup
 * @property {string} path - Image URL.
 * @property {string[]} [class] - Behaviour classes.
 * @property {{ width: number, height: number }} dimensions - Tile size.
 * @property {Array<{ x: number, y: number }>} positions - Tile positions.
 */

/**
 * Result of building a JSON tile group with special behaviour.
 *
 * @typedef {object} SpecialTile
 * @property {string} type - Behaviour: fall, cracked or decoration.
 * @property {string} name - Group name in the JSON file.
 * @property {string} path - Image URL.
 * @property {number} x - Left edge.
 * @property {number} y - Top edge.
 * @property {number} w - Width.
 * @property {number} h - Height.
 */

/**
 * Picks the footstep surface for an image.
 *
 * @param {string} path - Tile image URL.
 * @returns {string} Surface name.
 */
export function surfaceFor(path) {
    const name = path.split("/").pop().toLowerCase();
    if (name.startsWith("blueice") || name.startsWith("hardice")) return "ice";
    if (name.startsWith("snow")) return "snow";
    if (name.startsWith("dirt")) return "dirt";
    if (name.startsWith("iron") || name.startsWith("break") || name.startsWith("rail")) return "metal";
    if (name.startsWith("stone") || name.startsWith("stick")) return "wood";
    return "snow";
}

/**
 * Spike direction and hitbox for a spike image.
 *
 * @param {string} path - Image URL.
 * @param {number} w - Tile width.
 * @param {number} h - Tile height.
 * @returns {{ direction: string, hitbox: { x: number, y: number, w: number, h: number } }} Spike data.
 */
export function spikeData(path, w, h) {
    const name = path.split("/").pop();
    if (name.startsWith("spikesFlippedLeft")) return { direction: "left", hitbox: { x: w * 0.35, y: 4, w: w * 0.65, h: h - 8 } };
    if (name.startsWith("spikesFlippedRight")) return { direction: "right", hitbox: { x: 0, y: 4, w: w * 0.65, h: h - 8 } };
    if (name.startsWith("spikeDown") || name.startsWith("spikesDown")) return { direction: "down", hitbox: { x: 4, y: 0, w: w - 8, h: h * 0.6 } };
    return { direction: "up", hitbox: { x: 4, y: h * 0.4, w: w - 8, h: h * 0.6 } };
}

/**
 * Adds the tiles of an original JSON level to a level.
 *
 * Plain tiles become static chunked tiles with solid bodies. Tiles with
 * behaviour classes are returned so the level script can create entities.
 *
 * @param {import("../level.js").Level} level - Target level.
 * @param {Record<string, JsonTileGroup>} groups - Tile groups.
 * @param {{ yOffset?: number, skip?: (name: string, group: JsonTileGroup) => boolean }} [options] - Build options.
 * @returns {SpecialTile[]} Tiles with special behaviour.
 */
export function buildFromJson(level, groups, options = {}) {
    const yOffset = options.yOffset ?? -200;
    const special = [];
    for (const [name, group] of Object.entries(groups)) {
        if (options.skip?.(name, group)) continue;
        const classes = group.class || [];
        const w = group.dimensions.width;
        const h = group.dimensions.height;
        for (const position of group.positions) {
            const x = position.x;
            const y = position.y + yOffset;
            if (classes.includes("fall") || classes.includes("fallingBreak")) {
                special.push({ type: "fall", name, path: group.path, x, y, w, h });
            } else if (classes.includes("cracked")) {
                special.push({ type: "cracked", name, path: group.path, x, y, w, h });
            } else if (classes.includes("none-collision")) {
                level.addTile({ x, y, w, h, src: group.path, solid: false, layer: "back", backgroundSize: "100% 100%" });
            } else if (classes.includes("deadly")) {
                const spike = spikeData(group.path, w, h);
                level.addTile({
                    x, y, w, h, src: group.path, kind: "hazard", backgroundSize: "100% 100%",
                    hitbox: spike.hitbox, body: { direction: spike.direction }, classes: ["spike"]
                });
            } else {
                level.addTile({
                    x, y, w, h, src: group.path, backgroundSize: "100% 100%",
                    body: { surface: surfaceFor(group.path) }
                });
            }
        }
    }
    return special;
}

/**
 * Material description for ASCII maps.
 *
 * @typedef {object} Material
 * @property {string} strip - URL of a 16 variant autotile strip.
 * @property {string} surface - Footstep surface.
 * @property {boolean} [climbable=true] - Whether walls of this material can be climbed.
 */

/**
 * Callback invoked for non tile characters of an ASCII map.
 *
 * @callback MarkerHandler
 * @param {string} char - Map character.
 * @param {number} x - Left edge of the cell in world pixels.
 * @param {number} y - Top edge of the cell in world pixels.
 * @param {number} col - Column.
 * @param {number} row - Row.
 * @returns {void}
 */

/**
 * Builds a level section from an ASCII map with automatic tile edges.
 *
 * Each material character becomes a 50 pixel tile whose edge variant is
 * chosen from its neighbours. Horizontal runs of the same material share
 * a single collision body to keep the collision world small.
 *
 * @param {import("../level.js").Level} level - Target level.
 * @param {string[]} rows - Map rows, top to bottom.
 * @param {Record<string, Material>} materials - Material per character.
 * @param {{ x?: number, y?: number, onMarker?: MarkerHandler, edgeSolid?: boolean }} [options] - Origin and marker handler.
 * @returns {{ width: number, height: number }} Size of the map in pixels.
 */
export function buildFromAscii(level, rows, materials, options = {}) {
    const ox = options.x ?? 0;
    const oy = options.y ?? 0;
    const height = rows.length;
    const width = Math.max(...rows.map((row) => row.length));
    const at = (c, r) => (r < 0 || r >= height || c < 0 ? null : rows[r][c] ?? null);
    const solidAt = (c, r) => {
        const ch = at(c, r);
        if (ch === null) return options.edgeSolid !== false;
        return ch in materials;
    };
    for (let r = 0; r < height; r++) {
        let runStart = -1;
        let runChar = "";
        const flush = (end) => {
            if (runStart < 0) return;
            const material = materials[runChar];
            level.addBody(createBody(ox + runStart * TILE, oy + r * TILE, (end - runStart) * TILE, TILE, "solid", {
                surface: material.surface,
                climbable: material.climbable !== false
            }));
            runStart = -1;
        };
        for (let c = 0; c <= width; c++) {
            const ch = at(c, r);
            const material = ch !== null ? materials[ch] : undefined;
            if (material) {
                if (runStart >= 0 && ch !== runChar) flush(c);
                if (runStart < 0) {
                    runStart = c;
                    runChar = ch;
                }
                const mask = (solidAt(c, r - 1) ? 0 : 1) | (solidAt(c + 1, r) ? 0 : 2) | (solidAt(c, r + 1) ? 0 : 4) | (solidAt(c - 1, r) ? 0 : 8);
                const x = ox + c * TILE;
                const y = oy + r * TILE;
                level.addTile({
                    x, y, w: TILE, h: TILE, src: material.strip, solid: false,
                    backgroundSize: `${TILE * 16}px ${TILE}px`,
                    backgroundPosition: `${-mask * TILE}px 0px`
                });
                level.includeBounds(x, y, TILE, TILE);
            } else {
                flush(c);
                if (ch && ch !== " " && ch !== "." && options.onMarker) {
                    options.onMarker(ch, ox + c * TILE, oy + r * TILE, c, r);
                }
            }
        }
    }
    return { width: width * TILE, height: height * TILE };
}

/**
 * Autotile strips generated from the original tiles.
 *
 * @type {Readonly<Record<string, Material>>}
 */
export const MATERIALS = Object.freeze({
    dirt: { strip: "./assets/generated/tiles/auto_dirt.png", surface: "dirt" },
    snow: { strip: "./assets/generated/tiles/auto_snow.png", surface: "snow" },
    ice: { strip: "./assets/generated/tiles/auto_ice.png", surface: "ice" },
    resort: { strip: "./assets/generated/tiles/auto_resort.png", surface: "wood" }
});

/**
 * Finds the top of the first solid below a point that has room for Madeline above it.
 *
 * @param {import("../systems/physics.js").CollisionWorld} world - Collision world.
 * @param {number} x - World x to probe.
 * @param {number} fromY - World y to start probing from.
 * @param {number} [maxDepth=2000] - How far down to search.
 * @returns {number} Ground y, or fromY when nothing was found.
 */
export function groundAt(world, x, fromY, maxDepth = 2000) {
    for (let y = fromY; y < fromY + maxDepth; y += 2) {
        const hit = world.solidAt(x - 12, y, 24, 2);
        if (hit && !world.solidAt(x - 12, hit.y - 46, 24, 46) && !world.each(x - 12, hit.y - 46, 24, 46, "hazard", () => true)) return hit.y;
    }
    return fromY;
}
