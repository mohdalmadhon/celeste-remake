import { addAnimation, playAnimation } from "../components/animation.js";
import { addDashing, addJump, addMovement } from "../components/movement.js";
import { addCollisionDetect, addOffSet, applyGravity } from "../components/physics.js";
import { detectInput, inputs, keys, removeKey } from "../systems/input.js";
import { Entity } from "./entity.js";
import { playSound } from "../helpers/sound.js"
import { birdSounded, grannyConvo, granyConvoEnd } from "../levels/tutorial.js";
import { camera, mainLevel, player, showLoseScreen } from "../main.js";
import { getBounds, isTouchingLeftWall, isTouchingRightWall } from "../systems/physics.js";
import { hideSign, showSign } from "../helpers/sign.js";
import { wait } from "../helpers/scene.js";
import { showEndDialogue, stopGame } from "../helpers/mainMenu.js";

export function createPlayer(
    spawnPosition = {
        x: 0,
        y: 0
    },
    dimensions = {
        height: 0,
        width: 0
    },
    spriteSheetSrc = ""
) {
    const player = new Entity(spawnPosition, dimensions, "player");
    player.setSpriteSheet(spriteSheetSrc);
    player.setUpdate(playerUpdate);
    player.elem.style.willChange = "transform";
    
    addMovement(player, 350);
    applyGravity(player, 1000);
    addJump(player, 400);
    addDashing(player, 80);
    player.noControl = false;
    player.lives = 3;

    addOffSet(player, {
        top: 5,
        right: 10,
        left: 10,
        bottom: 5
    });
    addCollisionDetect(player);

    addAnimation(player, "idle", {
        row: 5,
        startFrame: 6,
        frameCount: 4,
        fps: 12
    });

    addAnimation(player, "run", {
        row: 0,
        startFrame: 0,
        frameCount: 8,
        fps: 12
    });

    addAnimation(player, "fall", {
        row: 9,
        startFrame: 1,
        frameCount: 10,
        fps: 12
    });

    addAnimation(player, "jump", {
        row: 9,
        startFrame: 0,
        frameCount: 1,
        fps: 12
    });

    addAnimation(player, "climb", {
        row: 3,
        startFrame: 8,
        frameCount: 4,
        fps: 12
    });

    addAnimation(player, "death", {
        row: 10,
        startFrame: 15,
        frameCount: 1,
        fps: 12
    });

    addAnimation(player, "talk", {
        row: 8,
        startFrame: 0,
        frameCount: 2,
        fps: 8
    });

    addAnimation(player, "sit", {
        row: 8,
        startFrame: 8,
        frameCount: 1,
        fps: 8
    });

    addAnimation(player, "dash", {
        row: 10,
        startFrame: 0,
        frameCount: 4,
        fps: 12
    });

    return player;
}

export function playerUpdate(player, dt) {
    
    if (player.freeze) return;
    if (!player.alive) {
        playerDeath(dt);
        return;
    }
    let moving = false;

    const touchingRightWall = isTouchingRightWall(player, mainLevel.entities);
    const touchingLeftWall = isTouchingLeftWall(player, mainLevel.entities);

    if (inputs.includes(keys.right)) {
        if (touchingRightWall) {
            player.components.physics.gravity.vy = 0;
            player.position.y -= player.components.movement.climbSpeed * dt;
        } else {
            player.position.x += player.components.movement.speed * dt;
        }
        player.components.movement.direction = 1;
        moving = true;
    }

    if (inputs.includes(keys.left) && player.position.x >= 0) {
        if (touchingLeftWall) {
            player.components.physics.gravity.vy = 0;
            player.position.y -= player.components.movement.climbSpeed * dt;
        } else {
            player.position.x -= player.components.movement.speed * dt;
        }
        player.components.movement.direction = -1;
        moving = true;
    }

    if (
        !player.components.physics.collision.right &&
        inputs.includes(keys.jump) &&
        !player.components.powers.jump.isJumping &&
        player.components.powers.jump.isJumping === false
    ) {
        player.components.physics.gravity.vy =
            -player.components.powers.jump.jumpPower;

        player.components.powers.jump.isJumping = true;
        playSound(
            "assets/soundTrack/player/jump_dreamblock.wav"
        );
        playAnimation(player, "jump");

    }

    const dashData = player.components.powers.dash;
    if (
        inputs.includes(keys.dash) &&
        !dashData.isDashing &&
        !dashData.onCooldown
    ) {
        dash(player, dt);
        playSound(
            "assets/soundTrack/player/dash_pink_left.wav"
        );
    }
    renderSprite(player);
    player.position.y += player.components.physics.gravity.vy * dt;

    if(player.components.powers.dash.isDashing) {
        playAnimation(player, "dash")
        return;
    }
    if ((player.components.physics.gravity.vy <= -300) ||
        (player.components.physics.gravity.vy >= 50)) {
        if (
            player.components.physics.gravity.vy < 0
        ) {
            playAnimation(player, "jump");
        } else {
            playAnimation(player, "fall");
        }
    } else {
        if (moving) {
            if (player.components.physics.collision.right || player.components.physics.collision.left) {
                playAnimation(player, "climb");
            } else {
                playAnimation(player, "run");
            }
        } else {
            if (player.noControl) return;
            playAnimation(player, "idle");
        }

    }


}

function renderSprite(player) {
    const animation = player.components.animation;
    if (!animation) return;

    const sprite = animation.sprites[animation.state.sprite];
    if (!sprite) return;

    const frame = sprite.startFrame + animation.state.frame;
    const frameWidth = player.dimensions.width;
    const frameHeight = player.dimensions.height;

    player.elem.style.backgroundPosition =
        `-${frame * frameWidth}px -${sprite.row * frameHeight}px`;
}

export function deathCount() {
    player.lives--;
    if(player.lives <= 0) {
        stopGame();
        showLoseScreen()
    }
    document.getElementById('live-count').textContent = `Lives: ${player.lives}`;
}

export async function playerDeath(dt) {
    renderSprite(player)
    window.removeEventListener('keydown', detectInput)
    window.removeEventListener('keyup', removeKey);
    inputs.length = 0;

    playAnimation(player, "death");

    player.position.y -= 100 * dt;
    await wait(200);
}

function dash(player, dt) {

    const dash = player.components.powers.dash;
    const maxDistance = 15;

    dash.distanceTravelled = 0;
    dash.isDashing = true;

    let dx = 0;
    let dy = 0;

    if (inputs.includes(keys.left)) dx = -1;
    if (inputs.includes(keys.right)) dx = 1;
    if (inputs.includes(keys.jump)) dy = -1;

    window.removeEventListener('keydown', detectInput);
    window.removeEventListener('keyup', removeKey);
    if (dx === 0 && dy === 0) {
        dx = player.components.movement.direction;
    }

    const length = Math.hypot(dx, dy);

    if (length > 0) {
        dx /= length;
        dy /= length;
    }

    let loop;

    function perform() {
        player.components.physics.gravity.vy = 0;
        const step = dash.dashPower;

        player.position.x += dx * step;
        player.position.y += dy * step;

        dash.distanceTravelled += step;

        if (dash.distanceTravelled >= maxDistance) {
            clearInterval(loop);

            dash.isDashing = false;
            dash.onCooldown = true;

            setTimeout(() => {
                dash.onCooldown = false;
            }, 1000);
        }
    }

    loop = setInterval(perform, 100);

    window.addEventListener('keydown', detectInput);
    window.addEventListener('keyup', removeKey);
}