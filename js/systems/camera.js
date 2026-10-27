
/*
    camera concept:
        get the position of the target (player mostly) position and multiply it by the chuck
        size to move the camera around.

        by help of render function in level class, entities out of chunck range display will be set
        to none for performance matters. and the entities inside the range will be used in this equation:
            position = entity.position - camera.position
        to get the correct position on camera.
*/
export class Camera {
    position = { x: 0, y: 0 };

    constructor(target) {
        this.target = target;

        this.CHUNK_WIDTH = 1200;
        this.CHUNK_HEIGHT = 500;

        this.chunkX = 0;
        this.chunkY = 0;
    }

    /*
        the first declaration for player positions were created for two purposes
            1: when player death where camera will not move but player will.
            2: ending scene where camera will move but not the player
    */
    update() {
        if (!this.target) return;
        let playerX = this.position.x;
        let playerY = this.position.y;

        if (this.target) {
            playerX = this.target.position.x;
            playerY = this.target.position.y;
        }


        while (playerX >= (this.chunkX + 1) * this.CHUNK_WIDTH) {
            this.chunkX++;
        }

        while (playerX < this.chunkX * this.CHUNK_WIDTH) {
            this.chunkX--;
        }

        while (playerY >= (this.chunkY + 1) * this.CHUNK_HEIGHT) {
            this.chunkY++;
        }

        while (playerY < this.chunkY * this.CHUNK_HEIGHT) {
            this.chunkY--;
        }

        this.position.x = this.chunkX * this.CHUNK_WIDTH;
        this.position.y = this.chunkY * this.CHUNK_HEIGHT;
    }
}