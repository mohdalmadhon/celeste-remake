import { playSound } from "../helpers/sound.js";

const dialogue = document.getElementById("dialogue");
const dialogueText = document.getElementById("dialogueText");
const dialogueImage = dialogue.querySelector("img");

export function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function showDialogue(text, image, sound = null) {
    dialogueText.textContent = text;
    dialogueImage.src = image;

    if (sound) {
        playSound(sound);
    }

    dialogue.style.display = "flex";

    requestAnimationFrame(() => {
        dialogue.classList.remove("hidden");
    });

    await wait(2500);

    dialogue.classList.add("hidden");

    await wait(500);

    dialogue.style.display = "none";
}