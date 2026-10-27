export function playSound(path = "") {
    const sound = new Audio(path);
    sound.play();

    return sound;
}