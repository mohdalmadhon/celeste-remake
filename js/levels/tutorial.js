import { Entity } from "../entities/entity.js";
import { Level } from "../level.js";
import { animationFrameId, camera, gameContainer, gameTimeRemaining, lastDisplayedTime, levels, main, mainLevel, player } from "../main.js";
import { collision, gravity } from "../systems/physics.js";
import { animationSystem } from "../systems/animationSystem.js";
import { addAnimation, playAnimation } from "../components/animation.js";
import { playSound } from "../helpers/sound.js";
import { hideSign, revealTitle, showSign } from "../helpers/sign.js";
import { applyGravity } from "../components/physics.js";
import { deathCount, playerDeath } from "../entities/player.js";
import { detectInput, initInputs, inputs, keys, removeKey } from "../systems/input.js";
import { showDialogue, wait } from "../helpers/scene.js";
import { createSnow } from "../helpers/snow.js";
import { createBird } from "../entities/bird.js";
import { fadeFromBlack, showEndDialogue, showMainMenu, showWinScreen, stopGame } from "../helpers/mainMenu.js";
import { resumeGame } from "../helpers/gameState.js";

let fallingBlocks;
let level;
let snow;
export let birdSounded = false;
let triggered = false;
let soundTriggered = false;
let death = false;
let first = false;
let breakTrapTriggered = false;
let birdLanded = false;
let dashBird;

export let grannyConvo = false;
export let granyConvoEnd = false;

let bird;
let dashTutorial = false;
let positionX = 0;
let positionY = 0;

export async function createTutorial(reset = true) {
    if (mainLevel != null) {
        if (reset == true) {
            mainLevel.removeEntities();
        }
    }
    snow = createSnow(gameContainer);
    fadeFromBlack(7000);

    resumeGame()
    initInputs();
    fallingBlocks = createFallingBlock();
    player.alive = true;
    death = false;
    first = false;
    triggered = false;
    soundTriggered = false;
    breakTrapTriggered = false;
    birdLanded = false;
    birdSounded = false;
    dashTutorial = false;
    camera.target = player;
    player.freeze = false;

    if (reset) {
        grannyConvo = false;
        granyConvoEnd = false;
        player.lives = 3;
        document.getElementById('live-count').textContent = `Lives: ${player.lives}`;
    }

    player.position = {
        x: 0,
        y: 200
    }

    const response = await fetch("./js/data/levels.json");

    const levelData = await response.json();
    bird = createBird();

    level = new Level({ height: 550, width: 1200 }, gameContainer);
    level.addSystem(gravity);

    level.addSystem(animationSystem);
    level.addEntity(bird);
    for (let i = 0; i < fallingBlocks.length; i++) {
        level.addEntity(fallingBlocks[i]);
    }

    dashBird = createDashBird();

    Object.values(levelData.tutorial.tiles).forEach(tileData => {
        tileData.positions.forEach(position => {
            const tile = new Entity(
                {
                    x: position.x,
                    y: position.y - 200
                },
                {
                    height: tileData.dimensions.height,
                    width: tileData.dimensions.width
                },
            );
            if (tileData.class) {
                tileData.class.forEach((c) => {
                    tile.elem.classList.add(c);
                })
                tile.elem.classList.add("no-render");
            }
            tile.elem.style.backgroundSize = 'cover';
            tile.setSpriteSheet(tileData.path);
            level.addEntity(tile);
        });
    });
    level.addEntity(player);
    const grany = new Entity({ x: 4300, y: 200 }, { height: 80, width: 66.6 });
    grany.setSpriteSheet("./assets/tiles/grany.png");
    grany.setUpdate(granyUpdate);
    grany.elem.classList.add('none-collision');
    grany.elem.style.scale = '1.2';
    addAnimation(grany, "idle", {
        row: 0,
        frameCount: 7,
        startFrame: 0,
        fps: 12
    });
    playAnimation(grany, "idle");
    bird.components.movement = {}
    bird.components.movement.direction = -1;
    level.addEntity(grany);
    level.addEntity(dashBird);

    initInputs();
    level.setConditions(conditions);
    level.end = false;
    return level;
}

async function conditions(dt) {

    if (death && !first) {
        first = true;
        stopGame();
        await wait(1000);

        mainLevel.removeEntities();
        let newLevel = await createTutorial(false);
        main(newLevel);
    }

    if ((player.position.x >= 1100 || triggered)) {
        triggered = true;

        if (!(fallingBlocks[0].position.y >= 253)) {
            for (let i = 0; i < fallingBlocks.length; i++) {
                fallingBlocks[i].position.y += 280 * dt;
            }
        } else {
            if (!soundTriggered) { playSound("./assets/soundTrack/quack.wav"); soundTriggered = true };
        }

    }

    let sign = null;
    if (player.position.x >= 2200 && !birdSounded) {
        birdSounded = true;
        playAnimation(bird, "sound");
        playSound("./assets/soundTrack/bird/squawk.wav");
        setInterval(() => {
            playAnimation(bird, "idle");
        }, 500);

        sign = showSign("./assets/signs/climb.png", 950, 10, document.getElementById('game'));
        setInterval(() => {
            hideSign(sign);
        }, 2000);
    }
    snow.update();
    if (player.position.y >= 500) {
        if (player.alive) playSound("./assets/soundTrack/player/death.wav");
        player.alive = false;
        if (!death) {
            death = true;
            deathCount();
        }
    }

    if (player.position.x >= 1100 &&
        player.position.x <= 1247 &&
        player.position.y >= 206 &&
        player.position.y <= 253 &&
        fallingBlocks[0].position.y >= 189 &&
        fallingBlocks[0].position.y <= 250
    ) {
        if (player.alive) playSound("./assets/soundTrack/player/death.wav");


        player.alive = false;
        if (!death) {
            deathCount();
        }
        death = true;
    }
    breakTrap(player);
    if (player.position.x >= 6600 && player.position.y >= 400 && !dashTutorial) {
        player.freeze = true;
        dashTutorial = true;
        dashTutorialScene();
    }

    if (dashTutorial && inputs.includes(keys.dash)) {
        player.freeze = false;
    }

    let loop;
    if (player.position.x >= 7001 && player.position.y <= 271) {
        player.freeze = true;
        camera.target = null;
        playAnimation(player, "idle");
        async function cameraMovement() {
            camera.position.y -= 3;
            if (camera.position.y <= -100) {
                clearInterval(loop);
                if (!level.end) {
                    level.end = true

                    await wait(3500);
                    stopGame();
                    levels.tutorial = true;
                    showEndDialogue(getTimeScore(lastDisplayedTime), null);
                }
            }
        }

        loop = setInterval(cameraMovement, 40);
    }

    if (player.position.x >= 4090 && !grannyConvo && !granyConvoEnd) {
        player.noControl = true;
        playAnimation(player, "talk");
        window.removeEventListener('keydown', detectInput);
        window.removeEventListener('keyup', removeKey);
        inputs.length = 0;
        grannyConvo = true;

        await showDialogue(
            "Excuse me, ma'am?",
            "./assets/faces/madline.png",
            "./assets/soundTrack/player/talk1.wav"
        );


        await (async () => {
            inputs.push('ArrowRight');
            setTimeout(() => {
                inputs.length = 0;
                playAnimation(player, "talk");
            }, 500);
        })();

        await showDialogue(
            "The sign out front is busted...\nis this the Mountain trail?",
            "./assets/faces/madline.png",
            "./assets/soundTrack/player/talk2.wav"
        );

        await showDialogue(
            "You are almost there.\nIt's across the bridge.",
            "./assets/faces/grany.png",
            "./assets/soundTrack/grany/talk1.wav"
        );

        await (async () => {
            inputs.push('ArrowRight');
            setTimeout(() => {
                inputs.length = 0;
                playAnimation(player, "talk");
                player.components.movement.direction = -1;
            }, 900);
        })();

        await showDialogue(
            "By The Way. You should call someone about your\ndriveWay. The ridge collapsed and I nearly died.",
            "./assets/faces/madlineSad.png",
            "./assets/soundTrack/player/talk3.wav"
        );

        await showDialogue(
            "Ha..HA...HA.HA",
            "./assets/faces/granyLaugh.png",
            "./assets/soundTrack/grany/laugh.wav"
        );

        await showDialogue(
            "if my driveway almost did you in,\nthe mountain might be a bit too much for you.",
            "./assets/faces/granyLaugh.png",
            "./assets/soundTrack/grany/talk1.wav"
        );

        await showDialogue(
            "well, if an old bat like you survive out here, I think I'll be fine.",
            "./assets/faces/madlineMad.png",
            "./assets/soundTrack/player/talk2.wav"
        );

        await showDialogue(
            "but you should know,\nCeleste mountains is a strange place.",
            "./assets/faces/grany.png",
            "./assets/soundTrack/grany/talk2.wav"
        );

        await showDialogue(
            "Ha..HA...HA.HA",
            "./assets/faces/granyLaugh.png",
            "./assets/soundTrack/grany/laugh.wav"
        );

        await showDialogue(
            "......",
            "./assets/faces/madlineMad.png"
        );

        inputs.length = 0;
        granyConvoEnd = true;
        window.addEventListener('keydown', detectInput);
        window.addEventListener('keyup', removeKey);
        player.noControl = false;

    }
}

function createFallingBlock() {
    const EdgeLeft = new Entity({ x: 1100, y: 0 }, { height: 50, width: 50 });
    EdgeLeft.setSpriteSheet("assets/tiles/celeste/blueIceEdgeLeft.png");
    EdgeLeft.elem.style.backgroundSize = 'cover';
    EdgeLeft.elem.classList.add('falling-snow');

    const topCenter = new Entity({ x: 1149, y: 0 }, { height: 50, width: 50 });
    topCenter.setSpriteSheet("assets/tiles/celeste/blueIce.png");
    topCenter.elem.style.backgroundSize = 'cover';
    topCenter.elem.classList.add('falling-snow');

    const EdgeRight = new Entity({ x: 1198, y: 0 }, { height: 50, width: 50 });
    EdgeRight.setSpriteSheet("assets/tiles/celeste/blueIceEdgeRight.png");
    EdgeRight.elem.style.backgroundSize = 'cover';
    EdgeRight.elem.classList.add('falling-snow');

    const EdgeBottomLeft = new Entity({ x: 1100, y: 49 }, { height: 50, width: 50 });
    EdgeBottomLeft.setSpriteSheet("assets/tiles/celeste/blueIceEdgeLeftBottom.png");
    EdgeBottomLeft.elem.style.backgroundSize = 'cover';
    EdgeBottomLeft.elem.classList.add('falling-snow');

    const bottomCenter = new Entity({ x: 1149, y: 49 }, { height: 50, width: 50 });
    bottomCenter.setSpriteSheet("assets/tiles/celeste/blueIceDown.png");
    bottomCenter.elem.style.backgroundSize = 'cover';
    bottomCenter.elem.classList.add('falling-snow');

    const EdgeBottomRight = new Entity({ x: 1198, y: 49 }, { height: 50, width: 50 });
    EdgeBottomRight.setSpriteSheet("assets/tiles/celeste/blueIceEdgeRightBototm.png");
    EdgeBottomRight.elem.style.backgroundSize = 'cover';
    EdgeBottomRight.elem.classList.add('falling-snow');


    return [EdgeBottomLeft, EdgeLeft, topCenter, EdgeRight, EdgeBottomRight, bottomCenter];
}

function breakTrap(player) {
    if (breakTrapTriggered) return;

    if (player.position.x >= 6500) {
        breakTrapTriggered = true;

        const arr = document.getElementsByClassName("fallingBreak");

        for (const elem of arr) {
            elem.classList.add("falling");
        }
        playSound("./assets/soundTrack/breakBridge.wav");

    }
}

function createDashBird() {
    const bird = new Entity({ x: 7100, y: 240 }, { height: 56, width: 64 }, "bird");
    bird.setSpriteSheet("./assets/bird.png");
    bird.elem.classList.add('none-collision');
    bird.components.movement = {
        direction: -1
    }
    bird.landed = false;

    addAnimation(bird, "idle", {
        row: 0,
        startFrame: 0,
        frameCount: 1,
        fps: 12
    });
    addAnimation(bird, "fly", {
        row: 0,
        startFrame: 32,
        frameCount: 5,
        fps: 12
    });

    addAnimation(bird, "sound", {
        row: 0,
        startFrame: 7,
        frameCount: 7,
        fps: 12
    });

    playAnimation(bird, "idle")
    return bird;
}

function dashTutorialScene(bird, dt) {
    // landing position x = 7100, y = 240


    function birdUpdate(dashBird, dt) {

        if (!birdLanded) {
            birdLanded = true;
            playSound("./assets/soundTrack/bird/squawk.wav");
            playAnimation(dashBird, "sound");

            let sign = showSign("./assets/signs/dash_sign.png", 920, 150, document.getElementById('game'));

            setTimeout(() => {
                hideSign(sign);
            }, 3000);

            setTimeout(() => {
                playAnimation(dashBird, "idle");
            }, 600);
        }


        const animation = dashBird.components.animation;
        if (!animation) return;

        const sprite = animation.sprites[animation.state.sprite];
        if (!sprite) return;

        const frame = sprite.startFrame + animation.state.frame;

        dashBird.elem.style.backgroundPosition =
            `-${frame * dashBird.dimensions.width}px -${sprite.row * dashBird.dimensions.height}px`;
    }

    dashBird.setUpdate(birdUpdate);

    level.addEntity(dashBird);
    level.mountEntities();
}

function granyUpdate(grany) {
    const animation = grany.components.animation;

    if (!animation) return;

    const sprite =
        animation.sprites[
        animation.state.sprite
        ];

    if (!sprite) return;

    const frame =
        sprite.startFrame +
        animation.state.frame;

    const frameWidth =
        grany.dimensions.width;

    const frameHeight =
        grany.dimensions.height;

    grany.elem.style.backgroundPosition =
        `-${frame * frameWidth}px -${sprite.row * frameHeight}px`;
}

export function getTimeScore(timeInSeconds) {
    const threeMinutes = 180;
    const fourMinutes = 240;

    if (timeInSeconds < threeMinutes) {
        const progress = timeInSeconds / threeMinutes;
        return Math.round(100 - progress * 20);
    }

    if (timeInSeconds < fourMinutes) {
        return 80;
    }

    return 60;
}