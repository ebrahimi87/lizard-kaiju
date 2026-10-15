import { Game } from "./Game.js";
import { Hud } from "./ui/Hud.js";
import { InputController } from "./input/InputController.js";
import { Sound } from "./audio/Sound.js";

// Boot: wire the HUD, input, and sound to the game, then run the frame loop.

const hud = new Hud();
const input = new InputController(hud.controls);
const sound = new Sound();
const canvas = document.getElementById("game-canvas");
const game = new Game({ canvas, hud, input, sound });

hud.setHandlers({
  play: () => game.play(),
  pause: () => game.pause(),
  resume: () => game.resume(),
  home: () => game.home(),
  retry: () => game.retry(),
  sound: () => game.toggleSound(),
  again: () => game.playAgain(),
  lab: () => game.openLab(),
  book: () => game.openBook(),
  endless: () => game.playEndless(),
});

// The first touch anywhere unlocks audio on iPad.
window.addEventListener("pointerdown", () => sound.unlock(), { once: false, passive: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) game.pause();
});
// Block pinch-zoom and double-tap zoom gestures in Safari.
document.addEventListener("gesturestart", (event) => event.preventDefault());
document.addEventListener("dblclick", (event) => event.preventDefault());

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  game.frame(dt);
  requestAnimationFrame(loop);
}

await game.boot();
requestAnimationFrame(loop);

if (game.debug) {
  window.__LIZARD_KAIJU__ = {
    ready: true,
    game,
    snapshot: () => game.snapshot(),
    play: () => game.play(),
    addGrowth: (amount) => {
      game.growth += amount;
    },
    teleport: (x, z) => game.player.position.set(x, 0, z),
    jump: async (index) => {
      await game.loadStage(index);
      game.startPlaying();
      return game.snapshot();
    },
    step: (seconds, input = {}) => {
      const sample = { x: 0, y: 0, fire: false, water: false, mega: false, taps: 0, pause: false, ...input };
      const original = game.input.sample;
      let first = true;
      // Taps count once, on the first stepped frame.
      game.input.sample = () => {
        const value = first ? sample : { ...sample, taps: 0 };
        first = false;
        return value;
      };
      for (let t = 0; t < seconds; t += 1 / 60) game.frame(1 / 60, false);
      game.input.sample = original;
      return game.snapshot();
    },
  };
} else {
  window.__LIZARD_KAIJU__ = { ready: true };
}
