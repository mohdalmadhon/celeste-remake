import { Entity } from "./entities/entity.js";
import { camera, player } from "./main.js";
import { collision } from "./systems/physics.js";
import { Camera } from "./systems/camera.js";

export class Level {
    parent;

    end = false;
    dimensions = {
        height: 0,
        width: 0
    };

    entities = [];
    systems = [];

    /* 
        render entities is not used currently as it is not needed for such a small game,
        but leave it there for future plans
    */
    renderEntities = [];

    conditions;
    constructor(
        dimensions = {
            height: 0,
            width: 0
        },
        parent = document.body
    ) {
        this.dimensions = dimensions;
        this.parent = parent;
    }

    addEntity(entity) {
        if (entity instanceof Entity) {
            this.entities.push(entity);
        }
    }

    addSystem(func) {
        if (typeof func !== "function") {
            console.error(`${func} is not a function`);
            return;
        }
        this.systems.push(func);
    }

    removeSystem(func) {
        const index = this.systems.indexOf(func);
        if (index === -1) {
            console.error(`${func} is not in systems`);
            return;
        }
        this.systems.splice(index, 1);
    }

    removeEntity(entity) {
        const index = this.entities.indexOf(entity);

        if (index === -1) {
            console.error(`${entity} is not in entities`);
            return;
        }

        if (entity.elem && entity.elem.parentNode) {
            entity.elem.parentNode.removeChild(entity.elem);
        }

        this.entities.splice(index, 1);

        const renderIndex = this.renderEntities.indexOf(entity);
        if (renderIndex !== -1) {
            this.renderEntities.splice(renderIndex, 1);
        }
    }

    removeEntities(entities = this.entities) {
        this.entities = this.entities.filter(entity => {
            if (!entities.includes(entity)) {
                return true; 
            }

            if (entity.elem.id === "game-hud") {
                return true; 
            }

            entity.elem.remove();
            return false; 
        });
    }

    mountEntities() {
        this.entities.forEach(entity => {
            this.parent.appendChild(entity.elem);
        })
    }

    setConditions(func) {
        this.conditions = func;
    }

    render() {
        const left = camera.position.x;
        const right = left + 1200;

        this.entities.forEach(entity => {
            const entityLeft = entity.position.x;
            const entityRight = entity.position.x + entity.dimensions.width;

            if (entityRight < left || entityLeft > right) {
                entity.elem.style.display = "none";
                return;
            }

            entity.elem.style.display = "";

            const x = entity.position.x - camera.position.x;
            const y = entity.position.y - camera.position.y;

            const direction = entity.components.movement?.direction ?? 1;

            entity.elem.style.transform =
                `translate(${x}px, ${y}px) scaleX(${direction})`;
        });
    }

    update(dt) {
        if (this.conditions) this.conditions(dt);
        if (player.alive) {
            collision(player, this.entities.filter((entity) => entity !== player), dt);
        }

        this.entities.forEach((entity) => {
            if (entity.update) entity.update(entity, dt, this.entities);
        });

        this.systems.forEach((system) => system(this.entities, dt));

        this.render();
    }
}