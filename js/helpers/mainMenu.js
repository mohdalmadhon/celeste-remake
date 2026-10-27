
import { firstLevel } from "../levels/firstLevel.js";
import { createTutorial } from "../levels/tutorial.js";
import { animationFrameId, level, levels, main, mainLevel, resetGameProgress, setLevel } from "../main.js";
import { gameState, resumeGame } from "./gameState.js";
import { wait } from "./scene.js";

const mainMenu = document.getElementById("main-menu");
const chooseLevelBtn = document.getElementById("choose-level-btn");
const levelSelect = document.getElementById("level-select");
const levelBackBtn = document.getElementById("level-back-btn");
const continueBtnMenu = document.getElementById("continue-btn-menu");
const levelCards = document.querySelectorAll(".menu-row[data-level]");

export function showMainMenu() {
  mainMenu.classList.remove("hidden");
}

export function hideMainMenu() {
  mainMenu.classList.add("hidden");
}

chooseLevelBtn.addEventListener("click", () => {
  levelSelect.classList.remove("hidden");
});

levelBackBtn.addEventListener("click", () => {
  levelSelect.classList.add("hidden");
});



document.getElementById('tutorial-btn').addEventListener('click', async () => {
  hideMainMenu();
  resetGameProgress();
  setLevel(0);
  const level = await createTutorial();
  await main(level);
})

document.getElementById('oldSite').addEventListener('click', async () => {
  hideMainMenu();
  resetGameProgress();
  setLevel(1)
  const level = await firstLevel();
  main(level)
})

export function stopGame() {
  cancelAnimationFrame(animationFrameId);
}


document.getElementById("res-btn").addEventListener("click", async () => {
  stopGame();

  resetGameProgress();
  await wait(500);
  mainLevel.removeEntities();
  const func = levels[level];
  const newLevel = await func(true);
  main(newLevel);
  resumeGame();
});

const winScreen = document.getElementById("win-screen");
const winCount = document.getElementById("win-collectable-count");
const winIcon = document.getElementById("win-collectable-icon");
const winMainMenuBtn = document.getElementById("win-main-menu-btn");

export function showWinScreen(collected, total, iconSrc = null) {
  if (iconSrc) {
    winIcon.src = iconSrc;
  }

  winCount.textContent = `${collected} / ${total}`;
  winScreen.classList.remove("hidden");
}

export function hideWinScreen() {
  winScreen.classList.add("hidden");
}

winMainMenuBtn.addEventListener("click", () => {
  hideWinScreen();
});

const endDialogue = document.getElementById("end-dialogue");
const endDialogueImage = document.getElementById("end-dialogue-image");
const endDialogueScore = document.getElementById("end-dialogue-score");
const endDialogueRestartBtn = document.getElementById("end-dialogue-restart-btn");
const endDialogueMainMenuBtn = document.getElementById("end-dialogue-main-menu-btn");

export function showEndDialogue(score, imageSrc = null) {
  if (imageSrc) {
    endDialogueImage.src = imageSrc;
  }

  endDialogueScore.textContent = `Score: ${score}`;
  endDialogue.classList.remove("hidden");
}

export function hideEndDialogue() {
  endDialogue.classList.add("hidden");
}

endDialogueRestartBtn.addEventListener("click", async () => {
  hideEndDialogue();
  stopGame();

  await wait(500);
  mainLevel.removeEntities();
  const func = levels[level];
  const newLevel = await func(true);
  main(newLevel);
  resumeGame();

});

endDialogueMainMenuBtn.addEventListener("click", () => {
  hideEndDialogue();
  stopGame();
  showMainMenu();
});

document.getElementById('lose-restart-btn').addEventListener('click', async () => {
  document.getElementById("lose-screen").classList.add("hidden");
  stopGame();


  resetGameProgress();
  await wait(500);
  mainLevel.removeEntities();
  const func = levels[level];
  const newLevel = await func(true);
  main(newLevel);
  gameState.isGameOver = false;
  resumeGame();



})

export function fadeFromBlack(duration = 1000) {
  const game = document.getElementById("game");

  if (getComputedStyle(game).position === "static") {
    game.style.position = "relative";
  }

  const overlay = document.createElement("div");
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.background = "black";
  overlay.style.opacity = "1"; 
  overlay.style.pointerEvents = "none";
  overlay.style.transition = `opacity ${duration}ms ease`;
  overlay.style.zIndex = "9999";

  game.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = "0"; 
  });

  return new Promise(resolve => {
    setTimeout(() => {
      overlay.remove();
      resolve();
    }, duration);
  });
}