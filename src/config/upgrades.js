import { freshPerks } from "./cards.js";

// Permanent upgrades bought in the Lizard Lab with gems. Each level costs more; the
// level count is costs.length. They become the starting perks of every run.

export const UPGRADES = [
  { id: "fire", icon: "i-card-bigfire", costs: [25, 60, 120], apply: (perks, level) => { perks.fireRange *= 1 + 0.12 * level; } },
  { id: "breath", icon: "i-card-bolt", costs: [25, 60, 120], apply: (perks, level) => { perks.regen *= 1 + 0.18 * level; } },
  { id: "speed", icon: "i-card-feet", costs: [35, 80, 150], apply: (perks, level) => { perks.speed *= 1 + 0.05 * level; } },
  { id: "hearts", icon: "i-heart", costs: [60, 150], apply: (perks, level) => { perks.extraHearts += level; } },
  { id: "magnet", icon: "i-card-magnet", costs: [35, 80, 150], apply: (perks, level) => { perks.magnet += 0.9 * level; } },
  { id: "luck", icon: "i-card-clover", costs: [35, 80, 150], apply: (perks, level) => { perks.luck *= 1 + 0.6 * level; } },
];

// Run-start perks: fresh perks plus bought upgrades plus the chosen starting buddy.
export function startingPerks(save) {
  const perks = freshPerks();
  for (const upgrade of UPGRADES) {
    const level = save.upgrades[upgrade.id] ?? 0;
    if (level > 0) upgrade.apply(perks, level);
  }
  if (save.buddy) perks.buddies.push(save.buddy);
  return perks;
}
