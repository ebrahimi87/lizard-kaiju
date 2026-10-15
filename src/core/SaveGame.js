// Progress saved on this device. Unknown or broken data falls back to a fresh save.

const KEY = "lizard-kaiju-save";
const VERSION = 1;

export function freshSave() {
  return {
    version: VERSION,
    gems: 0,
    muted: false,
    tutorialDone: false,
    stage: 0, // checkpoint: the stage to start from
    bestStage: 0,
    wins: 0,
    stickers: {},
    upgrades: {},
    skin: "ruby",
    hat: null,
    buddy: null,
    owned: { hats: [], skins: ["ruby"] },
    bestWave: 0,
    waterTutorialDone: false,
  };
}

// storage defaults to localStorage. Reading it is inside try: some browsers throw just
// for touching localStorage when storage is blocked.
export function loadSave(storage = null) {
  try {
    const parsed = JSON.parse((storage ?? window.localStorage).getItem(KEY) ?? "null");
    if (!parsed || parsed.version !== VERSION) return freshSave();
    const fresh = freshSave();
    return { ...fresh, ...parsed, owned: { ...fresh.owned, ...parsed.owned } };
  } catch {
    return freshSave();
  }
}

export function writeSave(save, storage = null) {
  try {
    (storage ?? window.localStorage).setItem(KEY, JSON.stringify(save));
  } catch {
    // Private browsing can refuse storage; the game still plays without saving.
  }
}
