
export function applyGravity(entity, gravityForce = 500) {

    if (!entity.components) {
        entity.components = {};
    }

    if (!entity.components.physics) {
        entity.components.physics = {};
    }

    entity.components.physics.gravity = {
        vy: 0,
        isGround: false,
        isJumping: false,
        wasOnGround: false,
        gravityForce: gravityForce
    };
}

export function addOffSet(entity, data = {
    top: 0,
    right: 0,
    left: 0,
    bottom: 0
}) {
    entity.offSet = data;
}

export function addCollisionDetect(entity) {
    if(!entity.components.physics) {
        entity.components.physics = {};
    }

    entity.components.physics.collision = {
        top: false,
        right: false,
        bottom: false,
        left: false
    }
} 