export let inputs = [];

export const keys = {
  right: "ArrowRight",
  left: "ArrowLeft",
  jump: "space",
  dash: "a",
  boost: "x",
  pause: "e",
};

export function initInputs(
  rightKey = "ArrowRight",
  leftKey = "ArrowLeft",
  JumpKey = "ArrowUp",
  DashKey = "w",
) {
  keys.left = leftKey;
  keys.right = rightKey;
  keys.jump = JumpKey;
  keys.dash = DashKey;

  window.addEventListener("keydown", detectInput);
  window.addEventListener("keyup", removeKey);
}

export function detectInput(e) {
  if (!inputs.includes(e.key)) {
    inputs.push(e.key);
  }
}

export function removeKey(e) {
  const index = inputs.indexOf(e.key);
  if (index !== -1) {
    inputs.splice(index, 1);
  }
}
