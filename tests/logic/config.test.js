import { test } from "node:test";
import assert from "node:assert/strict";
import { STAGES, ENDLESS } from "../../src/config/stages.js";
import { FORMS } from "../../src/config/forms.js";
import { BIOMES } from "../../src/config/biomes.js";
import { CARDS, applyCard, drawCards, freshPerks } from "../../src/config/cards.js";
import { UPGRADES, startingPerks } from "../../src/config/upgrades.js";
import { freshSave } from "../../src/core/SaveGame.js";

const formIds = new Set(FORMS.map((form) => form.id));

test("stages chain the forms in order and end with the kaiju boss", () => {
  assert.equal(STAGES.length, 5);
  STAGES.forEach((stage, index) => {
    assert.ok(formIds.has(stage.form), `${stage.id} form`);
    assert.ok(BIOMES[stage.biome], `${stage.id} biome`);
    if (index < STAGES.length - 1) assert.equal(stage.nextForm, STAGES[index + 1].form);
  });
  assert.equal(STAGES.at(-1).catcher.gear, "robot");
  assert.equal(ENDLESS.endless, true);
});

test("every stage is winnable: critters are slower than the lizard and growth is reachable", () => {
  for (const stage of STAGES) {
    for (const critter of stage.critters.table) {
      assert.ok(critter.fleeSpeed < stage.player.speed, `${stage.id}/${critter.kind} flees slower than the lizard`);
      assert.ok(critter.value > 0);
    }
    assert.ok(stage.catcher.speed < stage.player.speed, `${stage.id} catcher is slower than the lizard`);
    assert.ok(stage.catcher.maxSpeed < stage.player.speed, `${stage.id} catcher never outruns the lizard`);
    assert.ok(stage.growthTarget > 0 && stage.growthTarget <= 40);
    assert.ok(stage.hearts >= 3);
  }
});

test("cards: three different cards, limits respected, effects applied", () => {
  const perks = freshPerks();
  let seed = 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let round = 0; round < 50; round += 1) {
    const hand = drawCards(perks, random);
    assert.equal(hand.length, 3);
    assert.equal(new Set(hand.map((card) => card.id)).size, 3);
    assert.ok(hand.filter((card) => card.id.startsWith("buddy")).length <= 1);
  }
  const heart = CARDS.find((card) => card.id === "extraHeart");
  applyCard(perks, heart);
  applyCard(perks, heart);
  assert.equal(perks.extraHearts, 2);
  for (let round = 0; round < 30; round += 1) assert.ok(!drawCards(perks, random).some((card) => card.id === "extraHeart"));
});

test("upgrades become starting perks, with the chosen buddy", () => {
  const save = freshSave();
  assert.deepEqual(startingPerks(save).buddies, []);
  save.upgrades.fire = 2;
  save.upgrades.hearts = 1;
  save.buddy = "dog";
  const perks = startingPerks(save);
  assert.ok(Math.abs(perks.fireRange - 1.24) < 1e-9);
  assert.equal(perks.extraHearts, 1);
  assert.deepEqual(perks.buddies, ["dog"]);
  for (const upgrade of UPGRADES) assert.ok(upgrade.costs.every((cost, index) => index === 0 || cost > upgrade.costs[index - 1]));
});
