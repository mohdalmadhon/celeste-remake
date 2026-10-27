/**
 * Dumps the collision layout of a running chapter for tools/backfill.mjs.
 *
 * Needs Playwright and the game served on http://localhost:8123.
 * Usage: node tools/dump_level.cjs <chapter-id> <out.json> [endX,endY ...]
 */
const { chromium } = require("playwright");
const fs = require("fs");

/**
 * Loads the chapter in a headless browser and writes its bodies and marks.
 *
 * @returns {Promise<void>} Resolves when the dump is written.
 */
async function main() {
    const [chapter, out, ...extra] = process.argv.slice(2);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://localhost:8123/index.html?chapter=${chapter}&debug`);
    await page.waitForFunction(() => window.game?.level && window.game.player);
    await page.waitForTimeout(1000);
    const dump = await page.evaluate(() => {
        const game = window.game;
        const level = game.level;
        const solids = [];
        const hazards = [];
        const movers = [];
        const falling = [];
        const owners = new Map();
        for (const entity of level.entities) {
            if (entity.body) owners.set(entity.body, entity);
        }
        for (const body of level.world.bodies) {
            if (!body.active && !owners.has(body)) continue;
            const rect = [body.x, body.y, body.w, body.h];
            const owner = owners.get(body);
            const type = owner?.constructor?.name;
            if (body.kind === "hazard") {
                hazards.push(rect);
            } else if (body.kind === "solid") {
                if (type === "ZipMover") movers.push({ rect, end: [owner.end.x, owner.end.y] });
                else if (type === "FallingBlock") falling.push({ rect, active: body.active });
                else solids.push([...rect, body.surface || ""]);
            }
        }
        const runtime = game.session.runtime;
        const marks = Object.entries(runtime.checkpoints || {}).map(([label, p]) => ({ label, x: p.x, y: p.y - 4 }));
        for (const entity of level.entities) {
            if (entity.constructor.name === "Strawberry") marks.push({ label: entity.id, x: entity.position.x + 32, y: entity.position.y + 40, optional: true });
        }
        const start = runtime.checkpoints?.start || { x: game.player.box.x, y: game.player.box.y + game.player.box.h };
        return {
            solids, hazards, movers, falling, marks,
            start: [start.x, start.y - 4],
            bounds: level.cameraBounds,
            killY: level.killY
        };
    });
    for (const spec of extra) {
        const [x, y, label] = spec.split(",");
        dump.marks.push({ label: label || "end", x: Number(x), y: Number(y) });
    }
    fs.writeFileSync(out, JSON.stringify(dump));
    console.log(`${chapter}: ${dump.solids.length} solids, ${dump.hazards.length} hazards, ${dump.movers.length} movers, ${dump.falling.length} falling, ${dump.marks.length} marks`);
    await browser.close();
}

main();
