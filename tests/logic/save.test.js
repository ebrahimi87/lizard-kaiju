import { test } from "node:test";
import assert from "node:assert/strict";
import { freshSave, loadSave, writeSave } from "../../src/core/SaveGame.js";

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
  };
}

test("missing or broken saves start fresh", () => {
  assert.deepEqual(loadSave(memoryStorage()), freshSave());
  assert.deepEqual(loadSave(memoryStorage({ "lizard-kaiju-save": "{not json" })), freshSave());
  assert.deepEqual(loadSave(memoryStorage({ "lizard-kaiju-save": JSON.stringify({ version: 99, gems: 5 }) })), freshSave());
});

test("saves round-trip and keep default owned items", () => {
  const storage = memoryStorage();
  const save = freshSave();
  save.gems = 42;
  save.owned.hats.push("crown");
  writeSave(save, storage);
  const loaded = loadSave(storage);
  assert.equal(loaded.gems, 42);
  assert.deepEqual(loaded.owned.hats, ["crown"]);
  assert.deepEqual(loaded.owned.skins, ["ruby"]);
});
