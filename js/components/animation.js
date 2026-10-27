export function addAnimation(
    entity,
    spriteName,
    data = {
        row: 0,
        startFrame: 0,
        frameCount: 0,
        fps: 10
    }
) {
    entity.components ??= {};

    entity.components.animation ??= {
        state: {
            frame: 0,
            sprite: "",
            timer: 0
        },
        sprites: {}
    };

    if (entity.components.animation.sprites[spriteName]) {
        return;
    }

    entity.components.animation.sprites[spriteName] = data;
}

export function playAnimation(entity, sprite) {
    const animation = entity.components.animation;

    if (animation.state.sprite === sprite) return;

    animation.state.sprite = sprite;
    animation.state.frame = 0;
    animation.state.timer = 0;
}