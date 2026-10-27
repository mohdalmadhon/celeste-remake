import { addAnimation, playAnimation } from "../components/animation.js";
import { Entity } from "./entity.js";

export function createBird() {

    const bird = new Entity({ x: 2348, y: 110 }, { height: 56, width: 64 }, "bird");
    bird.setSpriteSheet("./assets/bird.png");
    bird.elem.classList.add('none-collision')
    bird.components.movement = {
        direction: -1
    }
    
    addAnimation(bird, "idle", {
        row: 0,
        startFrame: 0,
        frameCount: 1,
        fps: 12
    });
    
    addAnimation(bird, "sound", {
        row: 0,
        startFrame: 7,
        frameCount: 7,
        fps: 12
    });

    playAnimation(bird, "idle");
    bird.setUpdate(birdUpdate);
    return bird;
}

function birdUpdate(bird) {
    const animation = bird.components.animation;

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
        bird.dimensions.width;

    const frameHeight =
        bird.dimensions.height;

    bird.elem.style.backgroundPosition =
        `-${frame * frameWidth}px -${sprite.row * frameHeight}px`;
}
