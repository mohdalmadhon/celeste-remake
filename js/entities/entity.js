export class Entity {
    id = "";    

    freeze = false;
    alive = true;
    position = {
        x: 0,
        y: 0
    };

    dimensions = {
        height: 0,
        width: 0
    };
    
    components = {};
    
    elem = document.createElement('div');
    update;

    constructor(
        position = {
            x: 0,
            y: 0
        }
        ,
        dimensions = {
            height: 0,
            width: 0
        }
        ,
        id = ""
        
    ) {
        this.position = position;
        this.dimensions = dimensions;

        this.id = id;
        this.#initElemant();
    }

    #initElemant() {
        this.elem.style.height = `${this.dimensions.height}px`;
        this.elem.style.width = `${this.dimensions.width}px`;
        this.elem.style.transform =
            `translate(${this.position.x}px, ${this.position.y}px)`;

        this.elem.style.position = "absolute";
        this.elem.style.backgroundRepeat = "no-repeat";
        this.elem.style.imageRendering = "pixelated";
        this.elem.style.overflow = "hidden";
        this.elem.style.backgroundSize = "auto";
    }

    setSpriteSheet(src = "") {
        this.spriteSheet = src;
        this.elem.style.backgroundImage = `url(${src})`;
    }

    setUpdate(func) {
        if(typeof func !== "function") {
            console.error(`${func} is not a function`);
            return;
        }
        this.update = func;
    }

}