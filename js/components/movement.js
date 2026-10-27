import { Entity } from "../entities/entity.js";

export function addMovement(entity, speed = 5) {
    if (!(entity instanceof Entity)) {
        console.error(`${entity} is not an instance of Entity`);
        return;
    }

    entity.components.movement = {
        direction: 1,
        speed: speed,
        climbSpeed: 150
    };
}

export function addJump(entity, jumpPow) {
    if (!entity.components.powers) {
        entity.components.powers = {}
    }

    if (entity.components.powers.jump) return;

    entity.components.powers.jump = {
        jumpPower: jumpPow,
        isJumping: false,
        doubleJump: false
    }
}

export function addDashing(entity, dashPower = 30) {
    if (!entity.components.powers) {
        entity.components.powers = {}
    }

    if (entity.components.powers.dash) return;

    entity.components.powers.dash = {
        isDashing: false,
        dashPower: dashPower,
        distanceTravelled: 0,
        onCooldown: false
    }
}

export function addBost(entity, boostPower = 5) {
    if (!entity.components.powers) {
        entity.components.powers = {};
    }

    if (entity.components.powers.boost) return;

    entity.components.powers.boost = {
        isBoost: false,
        boostPower,
        boostDistance: 0,
        onCooldown: false
    };
}