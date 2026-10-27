// snow.js
const MAX_FLAKES = 1; 

export function createSnow(container) {
    const flakes = [];

    const layer = document.createElement("div");
    layer.style.position = "absolute";
    layer.style.top = "0";
    layer.style.left = "0";
    layer.style.width = "100%";
    layer.style.height = "100%";
    layer.style.pointerEvents = "none";
    layer.style.overflow = "hidden";
    layer.style.zIndex = "10";
    container.appendChild(layer);

    function spawnFlake(atTop = false) {
        const el = document.createElement("div");
        const size = Math.random() * 2 + 1.5; // 1.5–3.5px
        el.style.position = "absolute";
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
        el.style.borderRadius = "50%";
        el.style.background = "#fff";
        el.style.opacity = (Math.random() * 0.5 + 0.3).toFixed(2);
        el.style.willChange = "transform";
        layer.appendChild(el);

        return {
            el,
            x: Math.random() * container.clientWidth,
            y: atTop ? -10 : Math.random() * container.clientHeight,
            speedY: Math.random() * 30 + 15,   
            speedX: Math.random() * 10 - 5,    
        };
    }

    for (let i = 0; i < MAX_FLAKES; i++) {
        flakes.push(spawnFlake());
    }

    function update(dt) {
        const w = container.clientWidth;
        const h = container.clientHeight;

        flakes.forEach((f) => {
            f.y += f.speedY * dt;
            f.x += f.speedX * dt;

            if (f.y > h) {
                f.y = -10;
                f.x = Math.random() * w;
            }
            if (f.x < -5) f.x = w + 5;
            if (f.x > w + 5) f.x = -5;

            f.el.style.transform = `translate(${f.x}px, ${f.y}px)`;
        });
    }

    function destroy() {
        layer.remove();
    }

    return { update, destroy };
}