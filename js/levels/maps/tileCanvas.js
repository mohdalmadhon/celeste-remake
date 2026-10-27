/**
 * Mutable character grid used to author ASCII level maps with rectangle fills.
 */
export class TileCanvas {
    /** @type {string[][]} */
    cells;

    /**
     * @param {number} width - Columns.
     * @param {number} height - Rows.
     * @param {string} [fill="."] - Initial character.
     */
    constructor(width, height, fill = ".") {
        this.width = width;
        this.height = height;
        this.cells = Array.from({ length: height }, () => Array(width).fill(fill));
    }

    /**
     * Sets one cell, ignoring coordinates outside the grid.
     *
     * @param {number} x - Column.
     * @param {number} y - Row.
     * @param {string} ch - Character.
     * @returns {TileCanvas} This canvas for chaining.
     */
    set(x, y, ch) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) this.cells[y][x] = ch;
        return this;
    }

    /**
     * Fills a rectangle.
     *
     * @param {number} x - Left column.
     * @param {number} y - Top row.
     * @param {number} w - Width in cells.
     * @param {number} h - Height in cells.
     * @param {string} ch - Character.
     * @returns {TileCanvas} This canvas for chaining.
     */
    rect(x, y, w, h, ch) {
        for (let row = y; row < y + h; row++) {
            for (let col = x; col < x + w; col++) this.set(col, row, ch);
        }
        return this;
    }

    /**
     * Clears a rectangle back to empty space.
     *
     * @param {number} x - Left column.
     * @param {number} y - Top row.
     * @param {number} w - Width in cells.
     * @param {number} h - Height in cells.
     * @returns {TileCanvas} This canvas for chaining.
     */
    clear(x, y, w, h) {
        return this.rect(x, y, w, h, ".");
    }

    /**
     * Returns the grid as strings, one per row.
     *
     * @returns {string[]} Map rows.
     */
    toRows() {
        return this.cells.map((row) => row.join(""));
    }
}
