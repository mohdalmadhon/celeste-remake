import { playerDeath } from "../entities/player.js";
import { playSound } from "../helpers/sound.js";
import { Level } from "../level.js";
import { collectStrawberry, mainLevel } from "../main.js";

let test = false;
let first = true;

/*
    if statements in the beginning of the function is used for this game purposes only and cannot
    be used on other games. used for things such as collectables.
*/

export function collision(entityA, entities = [], dt) {
    if (entityA.components.physics?.gravity) {
        entityA.components.physics.gravity.isGround = false;
    }

    entities.forEach((entityB) => {
        // if entity is as far as 300 pixels away from any entity then no need to check for any collision
        if (entityA.position.x - 300 >= entityB.position.x || entityA.position.x + 300 <= entityB.position.x) {
            return;
        }

        // some entities contain none-collision class which is clear from it name, so just skip it
        if (entityB.elem.classList.contains("none-collision") && !entityB.elem.classList.contains("strawBerry")) {
            return;
        }

        if (entityA.elem.classList.contains("none-collision") && !entityB.elem.classList.contains("strawBerry")) {
            return;
        }
        if (entityB.elem.classList.contains("falling")) {
            entityB.position.y += 400 * dt;
            return;
        }

        const overlapX = getOverlapX(entityA, entityB);
        const overlapY = getOverlapY(entityA, entityB);


        if (overlapX <= 0 || overlapY <= 0) {
            return;
        }

        if (entityB.elem.classList.contains("strawBerry")) {
            playSound("./assets/soundTrack/strawBerry.wav");
            mainLevel.removeEntity(entityB);
            collectStrawberry(entityB.id);
            return;
        }
        if (entityB.elem.classList.contains("fall")) {
            if (!entityB.elem.classList.contains("falling")) {
                playSound("./assets/soundTrack/breakBridge.wav");
                entityB.elem.classList.add("falling");
            }
        }

        if (entityB.elem.classList.contains("deadly")) {
            playSound("./assets/soundTrack/player/death.wav");
            entityA.alive = false;
            return;
        }
        if (entityB.elem.classList.contains("cart")) {
            entityB.active = true;
            entityB.withPlayer = true;
        }

        if (overlapX < overlapY) {
            resolveX(entityA, entityB);
        } else if (overlapX >= overlapY) {
            resolveY(entityA, entityB);
        }


    });
}

function getOffSet(entity) {
    return entity.offSet || { top: 0, right: 0, left: 0, bottom: 0 };
}

// this function just return where the collision starts for an entity removing any offset in the spriteSheet
export function getBounds(entity) {
    const offSet = getOffSet(entity);
    return {
        left: entity.position.x + offSet.left,
        right: entity.position.x + entity.dimensions.width - offSet.right,
        top: entity.position.y + offSet.top,
        bottom: entity.position.y + entity.dimensions.height - offSet.bottom
    };
}

// this functions is used to know the entities are overlapping by how much
function getOverlapX(entityA, entityB) {
    const a = getBounds(entityA);
    const b = getBounds(entityB);

    return Math.min(a.right, b.right) - Math.max(a.left, b.left);
}

function getOverlapY(entityA, entityB) {
    const a = getBounds(entityA);
    const b = getBounds(entityB);

    return Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
}

// these functions are used to know entities are overlapping in which direction
function resolveX(entityA, entityB) {
    const a = getBounds(entityA);
    const b = getBounds(entityB);

    if (a.left < b.left) {
        left(entityA, entityB);

    } else if (a.left > b.left) {
        right(entityA, entityB);
    }
}

function resolveY(entityA, entityB) {
    const a = getBounds(entityA);
    const b = getBounds(entityB);

    if (a.top < b.top) {
        top(entityA, entityB);
    } else {
        bottom(entityA, entityB);
    }
}

function stopDash(entity) {
    if (entity.components.powers?.dash) {
        entity.components.powers.dash.distanceTravelled = 100000;
    }
}

function left(entityA, entityB) {
    const offSetA = getOffSet(entityA);
    const boundsB = getBounds(entityB);

    entityA.position.x = boundsB.left - entityA.dimensions.width + offSetA.right;

    stopDash(entityA);
}

// these functions are used to force a collision
function right(entityA, entityB) {
    const offSetA = getOffSet(entityA);
    const boundsB = getBounds(entityB);


    entityA.position.x = boundsB.right - offSetA.left;

    stopDash(entityA);
}

function top(entityA, entityB) {
    const offSetA = getOffSet(entityA);
    const boundsB = getBounds(entityB);

    entityA.position.y =
        boundsB.top -
        entityA.dimensions.height +
        offSetA.bottom;

    if (entityB.elem.classList.contains("cart") && entityB.distanceTraveled <= entityB.maxDistance) {
        entityB.active = true;
        entityB.withPlayer = true;
    }

    if (entityB.elem.classList.contains("cracked") && !entityB.elem.classList.contains("falling")) {
        if (!entityB.playedBreakSound) {
            entityB.playedBreakSound = true;
            playSound("./assets/soundTrack/breakBridge.wav");
        }
        setTimeout(() => {
            entityB.elem.classList.add("falling");

        }, 500)


    }

    if (entityA.components.physics?.gravity) {
        entityA.components.physics.gravity.isGround = true;
        entityA.components.physics.gravity.vy = 0;
    }

    if (entityA.components.powers?.jump) {
        entityA.components.powers.jump.isJumping = false;
        entityA.components.powers.jump.doubleJump = false;
    }
}

function bottom(entityA, entityB) {
    const offSetA = getOffSet(entityA);
    const boundsB = getBounds(entityB);

    entityA.position.y = boundsB.bottom - offSetA.top;

    stopDash(entityA);
}

export function gravity(entities = [], dt) {
    entities.forEach((entity) => {
        if (
            !entity.components ||
            !entity.components.physics ||
            !entity.components.physics.gravity ||
            entity.freeze
        ) {
            return;
        }

        if (entity.components.physics.gravity.isGround) return;

        entity.components.physics.gravity.vy += entity.components.physics.gravity.gravityForce * dt;
    });
}

export function isTouchingRightWall(player, entities) {
    const a = getBounds(player);

    for (const entity of entities) {
        if (entity.elem.classList.contains("none-collision")) {
            continue;
        }
        if (player.elem.classList.contains("none-collision")) {
            continue;
        }

        if (entity.id === player.id) continue;

        const b = getBounds(entity);

        const touching =
            Math.abs(a.right - b.left) <= 2 &&
            a.bottom > b.top &&
            a.top < b.bottom;

        if (touching) {
            if (player.components.physics.collision) {
                player.components.physics.collision.right = true;
            }
            return true;
        }
    }
    if (player.components.physics.collision) {
        player.components.physics.collision.right = false;
    }
    return false;
}

export function isTouchingLeftWall(player, entities) {
    const a = getBounds(player);

    for (const entity of entities) {
        if (entity.elem.classList.contains("none-collision")) {
            continue;
        }

        if (player.elem.classList.contains("none-collision")) {
            continue;
        }

        if (entity.id === player.id) continue;

        const b = getBounds(entity);

        const touching =
            Math.abs(a.left - b.right) <= 2 &&
            a.bottom > b.top &&
            a.top < b.bottom;

        if (touching) {
            if (player.components.physics.collision) {
                player.components.physics.collision.left = true;
            }
            return true;
        }
    }

    if (player.components.physics.collision) {
        player.components.physics.collision.left = false;
    }

    return false;
}
