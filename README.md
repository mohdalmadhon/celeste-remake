# Celeste Remake

A fan remake of Celeste that runs in the browser. It's written in plain JavaScript with ES modules and no frameworks, and it doesn't use a canvas. Every tile, sprite, particle and snowflake is a DOM element that gets moved around with CSS transforms, all driven by one `requestAnimationFrame` loop.

It started as a school project (a platformer built from scratch with DOM rendering only) and kept growing. These days it has five chapters, a level editor, seven languages and a settings menu that covers most of what the real game has.

This is a learning project. Celeste and its characters, art and music belong to Maddy Makes Games / EXOK. Full credits are in the game's Credits screen.

## Playing it

Once GitHub Pages is switched on for the repository (see [Publishing on GitHub Pages](#publishing-on-github-pages)), the game is playable at:

**https://mohdalmadhon.github.io/celeste-remake/**

## Running it locally

You need a local web server, because the levels are loaded with `fetch`. Opening `index.html` straight from the file system won't work.

Any static server is fine. Two easy ones:

```
python3 -m http.server 8000
```

or the Live Server extension in VS Code. Then open `http://localhost:8000/`.

There's nothing to install or build. The `tools/` folder has scripts for regenerating assets and checking levels, but you only need those if you're changing things.

## Controls

| Action | Keyboard | Gamepad |
|--------|----------|---------|
| Move / aim | Arrow keys | D-pad or left stick |
| Jump | Space or C | A or Y |
| Dash | X or W | X or B |
| Grab / climb | Z or Left Shift (or just hold toward a wall) | Shoulders and triggers |
| Pause | Esc or E | Start |

Every key can be rebound in Settings → Controls, and the bar under the game always shows your current bindings.

## Chapters

| # | Chapter | What's in it |
|---|---------|--------------|
| 0 | Prologue | The original tutorial layout on a clean grid, the snow block that drops on you, the climbing bird, Granny, the collapsing bridge and the dash lesson |
| 1 | Forsaken City | The original girder level, aligned to the grid and sitting on solid rock, with zip movers and crumbling girders |
| 2 | Celestial Resort | A new chapter: Oshiro chases you through the hotel, down a service shaft, across a collapsing ballroom and over the roof |
| 3 | The Summit's Forgotten Echoes | The finale, with wind, echoes of people you met, a chase with your own doubt and a two-dash climb at the end. It's tuned to be a fun climb rather than a hard one |
| 4 | The Shattered Spire | Optional and hard. Unlocks after the summit |

Each chapter has its own music: the main theme on the menu and in the Prologue, Golden in Forsaken City and on the summit, and Anxiety whenever something is chasing you and in the Spire. Music streams instead of loading up front, so a chapter starts playing right away.

Each chapter has a timer, lives, strawberries and checkpoints. Your best time and score are saved per chapter. If you fall off the bottom of the screen you die, same as in Celeste.

The Shattered Spire is meant to be difficult. You get crumbling stepping stones over spikes, a dash-crystal chain across a long spike pit, a shaft of falling footholds between spiked walls, a hall full of dust bunnies with a bridge that collapses under you, a well you climb by dashing from crystal to crystal, and a headwind on the last stretch. It has 30 lives and five checkpoints, and you'll probably use a lot of them.

## Developer mode

Developer mode is a level editor. You open it from the main menu. Anything you make there is saved in your browser, and you can export it as a JSON file or import one somebody sent you.

When you open it you get your list of levels. From there you can make a new one, import a file, or open Chapter 4 as an example. The example is a good way to see how a full level with events is put together. It opens as a copy, so you can't break the real chapter.

### Building a level

- **Blocks.** Pick a material on the left and paint with the left mouse button. Right-click erases. "Fill box" (R) lets you drag out a rectangle, and right-dragging clears one. Edges and corners fill in automatically, the same way they do in the game.
- **Objects.** Choose one from the Objects list and click on the map. You get: the player start, checkpoints, the goal flag, spikes (in four directions), crumbling blocks, falling blocks, dash crystals, boosters, strawberries, dust bunnies and zip movers. Select an object (V) to change its settings on the right, like which way spikes point, how far a dust bunny drifts, or where a zip mover travels. You can drag objects around with the Select tool.
- **Events.** Use the "Event area" tool (T) to drag an area. When the player walks into it, the event runs its actions in order. Events can also start when the level starts, at a checkpoint, after a number of strawberries or after a number of deaths. Actions include dialogue (pick the speaker, portrait and text), messages, title cards, screen shake, flashes, changing the wind or weather, changing the number of dashes, refilling the dash, moving the camera to look at something, waiting, dropping a falling block, killing the player and finishing the level.
- **Level settings.** The Level tab has the name, author, background theme, weather, music, time limit, lives and dash count. You can also resize the level there, keeping either the top or the bottom in place.

### Shortcuts

| Key | Does |
|-----|------|
| V, B, E, R, T, H | Select, paint, erase, fill box, event area, pan |
| 1 to 6 | Pick a block material |
| Space + drag, or middle mouse | Pan |
| Mouse wheel | Zoom (Shift + wheel scrolls sideways) |
| F | Fit the whole level on screen |
| P | Playtest from the cell under the cursor |
| Delete | Delete the selected object or event |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+S | Save |

Playtest runs the level in the real game. When you finish it, or quit from the pause menu, you land back in the editor where you left off. Playing a custom level never touches your story save.

### The level file

Exported levels are plain JSON, so you can edit them by hand too. A small one looks like this:

```json
{
  "format": "celeste-remake-level",
  "version": 1,
  "id": "level-abc123",
  "name": "Tiny Hop",
  "author": "Mohammed",
  "width": 30,
  "height": 12,
  "settings": { "theme": "forest", "weather": "snow", "music": "theme", "timeLimit": 300, "lives": 5, "dashes": 1 },
  "tiles": ["..............................", "...", "ssssssssssssssssssssssssssssss"],
  "entities": [
    { "id": "e1", "type": "spawn", "x": 2, "y": 10 },
    { "id": "e2", "type": "spike", "x": 12, "y": 10, "dir": "up" },
    { "id": "e3", "type": "goal", "x": 27, "y": 10 }
  ],
  "events": [
    {
      "id": "ev1", "name": "Hello", "once": true,
      "trigger": { "type": "enter", "x": 5, "y": 6, "w": 2, "h": 5 },
      "actions": [{ "type": "dialogue", "lines": [{ "speaker": "madeline", "emotion": "normal", "text": "Here we go." }] }]
    }
  ]
}
```

- Sizes and positions are in 50-pixel cells. One screen is 24 × 10 cells.
- `tiles` has one string per row. `.` is air, `s` snowy dirt, `d` dirt, `i` ice, `g` girder, `b` stone beam, `w` hotel wood.
- An object's `x` and `y` are the cell it stands in.
- Unknown objects, triggers and actions are dropped on import, and numbers are clamped to sane ranges, so a broken file won't crash the game.

The complete list of object types, triggers and actions, with every field they take, is in `js/levels/levelFormat.js`.

## How it's built

The short version:

- The game runs a fixed 120 Hz simulation and interpolates when it draws, so movement looks the same at any refresh rate.
- Collision uses a spatial hash. Actors move one pixel at a time against solids, the way Celeste does it, and moving platforms carry or squish whatever is on them.
- Madeline's movement uses Celeste's numbers scaled up four times: coyote time, jump buffering, variable jump height, wall jumps, wall slides, climbing with stamina, eight-way dashes and super jumps.
- Static tiles are written once into chunks that get hidden when they're off screen, so most frames only touch the camera transform and whatever is moving.
- Sound is Web Audio, with separate volume buses for music, effects and ambience. The wind, the hotel hum and the chase drums are generated in the browser.
- Text comes from the files in `js/i18n`. English, Spanish, French, German, Italian, Portuguese and Russian are complete.

### Folders

| Folder | What lives there |
|--------|------------------|
| `js/core` | Game loop, settings, save file, translations, the chapter session (timer, lives, checkpoints, deaths) |
| `js/systems` | Input, audio, collision, camera, particles, weather, parallax |
| `js/entities` | Madeline, props (strawberries, crumbling and falling blocks, zip movers, crystals, boosters), hazards, Oshiro, the echoes |
| `js/levels` | One script per chapter, the tile builder, the level format and the loader for level files |
| `js/levels/maps` | Grid maps for the Prologue, Forsaken City, the resort and the summit |
| `js/editor` | Developer mode |
| `js/ui` | HUD, dialogue, cutscenes, menus, transitions |
| `js/data` | The original level data and the Chapter 4 level file |
| `assets` | Original art and sound, plus `generated/` for sprite sheets, autotiles and backgrounds made by `tools/build_assets.py` |
| `tools` | Asset and level scripts (see below) |

### Tools

These are only for working on the game itself:

- `python3 tools/build_assets.py [group ...]` regenerates every derived asset from the original art (needs Pillow).
- `node tools/reachability.mjs ...` simulates Madeline's movement on a layout and tells you whether marked points can be reached. It's how I check that a level can actually be finished after changing it.
- `node tools/build_spire.mjs` rebuilds the Chapter 4 level file. It refuses to write the file if any checkpoint, strawberry or the goal becomes unreachable.
- `python3 tools/convert_city.py [fill.json]` regenerates the grid map of Forsaken City from the original level data.
- `node tools/dump_level.cjs` and `node tools/backfill.mjs` dump a running chapter's collision and work out which space the player can never reach. They need Playwright, and the game has to be running on port 8123.

### Debugging

- `index.html?chapter=<id>` jumps straight into a chapter. The ids are `prologue`, `forsaken-city`, `celestial-resort`, `summit-echoes` and `shattered-spire`.
- Add `&checkpoint=<id>` to start at a checkpoint.
- Add `&debug` to get `window.game` and `window.gameLoop` in the console.
- F3 shows frame times while you play.
- Settings → Assist mode gives you infinite lives and time if you just want to look around.

## Publishing on GitHub Pages

Everything the game needs is static files, so GitHub Pages can host it as-is. The repository includes a workflow (`.github/workflows/pages.yml`) that publishes the game every time you push to `main`.

To turn it on:

1. Push the repository to GitHub. On a free account the repository has to be public for Pages to work.
2. Open the repository's **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push any commit to `main`, or run the "Deploy to GitHub Pages" workflow from the **Actions** tab.

After a minute or so the game is live at `https://<your-username>.github.io/<repository-name>/`.

If you'd rather not use Actions, setting the source to **Deploy from a branch** with `main` and `/ (root)` works too. The `.nojekyll` file makes sure GitHub serves the files untouched.

A few things that matter when publishing:

- Every path in the game is relative, so it works from a sub-folder like `/celeste-remake/`.
- GitHub Pages cares about upper and lower case in file names even though Windows doesn't. If you add an asset, reference it with exactly the same case as the file.
- `game.html` just forwards to `index.html`, so old links and bookmarks still work.

## Known limits

- There's no Chinese, Japanese or Korean, because the pixel font only covers Latin and Cyrillic.
- Custom levels live in your browser's local storage. Clearing site data deletes them, so export anything you care about.
- The Quit button only shows up when the game runs as an installed app or in a window it opened itself, because browsers don't let a normal tab close itself.
