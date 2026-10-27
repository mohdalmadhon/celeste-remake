import { addAnimation, playAnimation } from "../components/animation.js";
import { Entity } from "../entities/entity.js";
import { deathCount } from "../entities/player.js";
import { gameState, resumeGame } from "../helpers/gameState.js";
import { fadeFromBlack, showEndDialogue, stopGame } from "../helpers/mainMenu.js";
import { showDialogue, wait } from "../helpers/scene.js";
import { createSnow } from "../helpers/snow.js";
import { playSound } from "../helpers/sound.js";
import { Level } from "../level.js";
import { camera, gameContainer, gameTimeRemaining, isStrawberryCollected, lastDisplayedStrawberries, lastDisplayedTime, main, mainLevel, player, strawCount } from "../main.js";
import { animationSystem } from "../systems/animationSystem.js";
import { detectInput, initInputs, inputs, removeKey } from "../systems/input.js";
import { gravity } from "../systems/physics.js";
import { getTimeScore } from "./tutorial.js";

let level;
let carts;
let bird;
let snow;
let death = false;
let first = false;

export let endScene = false;

export async function firstLevel(reset = true) {
    fadeFromBlack(7000);
    if (mainLevel != null) {
        if (reset == true) {
            mainLevel.removeEntities();
        }
    }
    resumeGame();
    initInputs();

    player.alive = true;
    first = false;
    gameState.isGameOver = false;
    player.alive = true;
    death = false;
    camera.target = player;
    player.freeze = false;
    snow = createSnow(gameContainer);
    if (reset) {
        player.lives = 3;
        document.getElementById('live-count').textContent = `Lives: ${player.lives}`;
    }

    player.position = {
        x: 10,
        y: 150
    }
    const response = await fetch("./js/data/firstLevel.json");
    const levelData = await response.json();

    level = new Level({ height: 550, width: 1200 }, gameContainer);
    level.addSystem(animationSystem);
    level.addSystem(gravity);

    Object.values(levelData.firstLevel.tiles).forEach(tileData => {
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
    level.setConditions(conditions);
    level.addEntity(player);

    makeStrawBerry();

    carts = createCarts();


    initInputs();

    createParrot();
    return level;
}

function createParrot() {
    bird = new Entity({ x: 2300, y: -2900 }, { height: 56, width: 64 }, "bird");
    bird.setSpriteSheet("./assets/bird.png");
    bird.elem.classList.add('none-collision');
    bird.components.movement = {
        direction: -1
    }
    bird.birdLanded = false;
    bird.components.movement.direction = 1;
    level.addEntity(bird)
    level.mountEntities();

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
        fps: 8
    });

    addAnimation(bird, "sound", {
        row: 0,
        startFrame: 7,
        frameCount: 7,
        fps: 12
    });

    playAnimation(bird, "fly");

}

function birdUpdate(bird, dt) {
    const landing = {
        x: 2750,
        y: -2630
    };

    const speed = 180;
    const dx = landing.x - bird.position.x;
    const dy = landing.y - bird.position.y;

    const distance = Math.hypot(dx, dy);
    let birdLanded = bird.birdLanded;
    if (distance > 2) {
        bird.position.x += (dx / distance) * speed * dt;
        bird.position.y += (dy / distance) * speed * dt;
    } else {
        bird.position.x = landing.x;
        bird.position.y = landing.y;

        if (!birdLanded) {
            birdLanded = true;

            playAnimation(bird, "idle");

            wait(1000);

        }
    }

    const animation = bird.components.animation;
    if (!animation) return;

    const sprite = animation.sprites[animation.state.sprite];
    if (!sprite) return;

    const frame = sprite.startFrame + animation.state.frame;

    bird.elem.style.backgroundPosition =
        `-${frame * bird.dimensions.width}px -${sprite.row * bird.dimensions.height}px`;
}


async function conditions(dt) {
    if (player.alive == false && !first) {
        first = true;
        stopGame();
        await wait(1000);

        mainLevel.removeEntities();
        let newLevel = await firstLevel(false);
        main(newLevel);
        deathCount()
    }

    if (player.position.y >= 500) {
        if (player.alive) playSound("./assets/soundTrack/player/death.wav");

        player.alive = false;

        if (!death) {
            death = true;
        }
    }

    carts.forEach(cart => {
        if (!cart.active) return;
        if (cart.distanceTraveled >= cart.maxDistance) return;

        if (!cart.played) {
            const sound = playSound("./assets/soundTrack/cart.wav");
            cart.played = true;
            setTimeout(() => {
                sound.pause();
            }, 700);
        }

        const speed = 300;
        const move = speed * dt;

        if (cart.direction === 1 || cart.direction === -1) {
            cart.position.x += move * cart.direction;

            if (cart.withPlayer) {
                player.position.x += move * cart.direction;
            }
        } else if (cart.direction === "up") {
            cart.position.y -= move;

            if (cart.withPlayer) {
                player.position.y -= move;
            }
        } else if (cart.direction === "down") {
            cart.position.y += move;

            if (cart.withPlayer) {
                player.position.y += move;
            }
        }

        cart.distanceTraveled += move;

        if (cart.distanceTraveled >= cart.maxDistance) {
            cart.active = false;
        }
    });
    snow.update();

    if (player.position.x <= 3277 && player.position.y <= -2609 && !endScene) {
        endScene = true;
        end();
        await wait(7000);
        const gameHud = document.getElementById("game-hud").classList.add("hidden");
        showEndDialogue((Math.round( (getCollectableScore(lastDisplayedStrawberries) + getTimeScore(lastDisplayedTime) ) / 2)));
    }
    // 3277 2-609

}


function makeStrawBerry() {
    const positions = [
        { x: 1450, y: -400, id: "first-level-strawberry-1" },
        { x: 3430, y: -1400, id: "first-level-strawberry-2" },
        { x: 2430, y: -2400, id: "first-level-strawberry-3" }
    ];

    for (let i = 0; i < positions.length; i++) {
        if (isStrawberryCollected(positions[i].id)) {
            continue;
        }

        const berry = new Entity({ x: positions[i].x, y: positions[i].y }, { height: 64, width: 64 }, positions[i].id);
        berry.elem.classList.add("strawBerry");
        berry.elem.classList.add("none-collision");
        berry.setSpriteSheet("./assets/player3.png");

        addAnimation(berry, "idle", {
            row: 13,
            frameCount: 5,
            startFrame: 0,
            fps: 8
        });

        berry.setUpdate(berryUpdate);
        playAnimation(berry, "idle")
        level.addEntity(berry);
    }
}

function createCarts() {
    let positions = [
        { x: 2700, y: -700, id: "first-cart", distance: 200, direction: 1 },
        { x: 2700, y: -1550, id: "first-cart", distance: 200, direction: "up" }
    ];
    let arr = [];
    for (let i = 0; i < positions.length; i++) {
        const cart = new Entity({ x: positions[i].x, y: positions[i].y }, { height: 64, width: 98 }, positions[i].id);
        cart.setSpriteSheet("./assets/tiles/celeste/cart.png");
        cart.elem.style.backgroundSize = 'cover';
        cart.elem.classList.add("cart");
        cart.active = false;
        cart.distance = positions[i].distance;
        cart.direction = positions[i].direction;
        cart.distanceTraveled = 0;
        cart.maxDistance = positions[i].distance;
        cart.played = false;
        level.addEntity(cart);

        arr.push(cart);
    }

    return arr;
}

function berryUpdate(berry) {
    const animation = berry.components.animation;

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
        berry.dimensions.width;

    const frameHeight =
        berry.dimensions.height;

    berry.elem.style.backgroundPosition =
        `-${frame * frameWidth}px -${sprite.row * frameHeight}px`;
}

async function end() {


    window.removeEventListener("keydown", detectInput);
    window.addEventListener("keyup", removeKey);
    inputs.length = 0;
    await wait(400);

    player.noControl = true;
    playAnimation(player, "talk");

    await showDialogue(
        "Ugh, I'm exhausted.",
        "./assets/faces/madline.png"
    );

    inputs.push("ArrowLeft");

    await wait(1500);

    inputs.length = 0;
    playAnimation(player, "talk");
    await wait(1000);


    playAnimation(player, "sit");

    bird.setUpdate(birdUpdate);
}

function getCollectableScore(collected) {
    const totalCollectables = 3;

    collected = Math.max(0, Math.min(collected, totalCollectables));

    return Math.round((collected / totalCollectables) * 100);
}

