function createSign(src, x, y) {
    const sign = document.createElement("img");
    sign.src = src;
    sign.className = "prompt-sign";

    sign.style.position = "absolute";
    sign.style.left = `${x}px`;
    sign.style.top = `${y}px`;
    sign.style.width = "259px";
    sign.style.height = "181px";
    sign.style.imageRendering = "pixelated";
    sign.style.pointerEvents = "none";

    sign.style.opacity = "0";
    sign.style.transform = "translateY(8px) scale(0.95)";
    sign.style.transition = "opacity 0.18s ease-out, transform 0.18s ease-out";

    return sign;
}

export function showSign(src, x, y, parentContainer = document.body) {
    const sign = createSign(src, x, y);
    parentContainer.appendChild(sign);

    requestAnimationFrame(() => {
        sign.style.opacity = "1";
        sign.style.transform = "translateY(0) scale(1)";
    });

    return sign;
}

export function hideSign(sign) {
    sign.style.opacity = "0";
    sign.style.transform = "translateY(8px) scale(0.95)";

    sign.addEventListener("transitionend", () => {
        sign.remove();
    }, { once: true });
}

export function revealTitle(el, text, options = {}) {
    const { delayBetween = 150, startDelay = 0 } = options;

    el.innerHTML = '';
    el.classList.remove('done');

    const chars = text.split('');
    chars.forEach((ch, i) => {
        const span = document.createElement('span');
        span.className = 'letter' + (ch === ' ' ? ' space' : '');
        span.textContent = ch === ' ' ? '\u00A0' : ch;
        span.style.animationDelay = `${startDelay + i * delayBetween}ms`;
        el.appendChild(span);
    });
}

const dialogue = document.getElementById("dialogue");

export function showDialogue() {
    dialogue.classList.remove("hidden");
}

export function hideDialogue() {
    dialogue.classList.add("hidden");
}
