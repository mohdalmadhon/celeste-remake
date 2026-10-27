# Celeste Remake

A browser remake of Celeste built with plain JavaScript modules and the DOM. No frameworks and no canvas: every tile, sprite, particle and snowflake is an element moved with CSS transforms, driven by a single `requestAnimationFrame` loop.

## Running

Serve the project folder with any static server (for example the VS Code Live Server extension) and open `game.html`. Opening the file directly from disk will not work because levels are loaded with `fetch`.

Useful URL parameters while developing:

- `?chapter=prologue|forsaken-city|celestial-resort|summit-echoes` starts a chapter directly.
- `&checkpoint=<id>` starts at a checkpoint.
- `&debug` exposes `window.game` and `window.gameLoop` for testing.
- Press `F3` in game for the frame time overlay.

## Chapters

| # | Chapter | Highlights |
|---|---------|------------|
| 0 | Prologue | Original layout, falling ice trap, climbing bird, Granny, collapsing bridge, dash lesson |
| 1 | Forsaken City | Original girder level, zip movers, crumbling girders, resting ending with the bird |
| 2 | Celestial Resort | New Oshiro chase through hallways, a service shaft, a collapsing ballroom and the rooftops |
| 3 | The Summit's Forgotten Echoes | New finale with wind, echoes of past characters, a doubt chase and a two-dash ascent |

## Default controls

| Action | Keyboard | Gamepad |
|--------|----------|---------|
| Move / aim | Arrow keys | D-pad or left stick |
| Jump | Space, C | A, Y |
| Dash | X, W | X, B |
| Grab / climb | Z, Left Shift (or hold towards a wall) | Shoulders and triggers |
| Pause | Esc, E | Start |

Every key can be remapped in Settings → Controls.

## Project layout

- `js/core` – constants, events, settings, save data, localisation, game loop and chapter session.
- `js/systems` – input, audio, collision world, camera, particles, weather and parallax.
- `js/entities` – the player controller, props, hazards, Oshiro and the summit echoes.
- `js/levels` – chapter scripts, the level builder, parallax themes and ASCII maps.
- `js/ui` – HUD, dialogue, cutscenes, menus, transitions and display scaling.
- `js/i18n` – string catalogs for English, Spanish, French, German, Italian, Portuguese and Russian.
- `assets/generated` – sprite sheets, autotiles, portraits and backgrounds built by `tools/build_assets.py`.

## Tools

- `python3 tools/build_assets.py [group ...]` rebuilds every derived asset from the original art.
- `node tools/reachability.mjs ...` checks that a layout can be completed with the current movement.
- `node tools/dump_level.cjs <chapter> <dump.json> [x,y,label]` (needs Playwright and the game served on port 8123, with the chapter's entry removed from `js/data/fills.json`) writes a chapter's collision layout.
- `node tools/backfill.mjs <dump.json> <chapter> js/data/fills.json --doomed [--sides=12]` fills the space the player can never reach with solid terrain and refuses to write anything that would cut off a checkpoint, strawberry or ending.
