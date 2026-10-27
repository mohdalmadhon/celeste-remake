export function animationSystem(entities, dt) {
    entities.forEach(entity => {
        const animation = entity.components?.animation;

        if (!animation) {
            return;
        }

        const current = animation.sprites[animation.state.sprite];

        if (!current || current.frameCount <= 1) {
            return;
        }

        animation.state.timer += dt;

        const frameDuration = 1 / current.fps;

        while (animation.state.timer >= frameDuration) {
            animation.state.timer -= frameDuration;

            animation.state.frame =
                (animation.state.frame + 1) % current.frameCount;
        }
    });

}