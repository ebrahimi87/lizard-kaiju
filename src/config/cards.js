// Power cards offered after each evolution: the player taps one of three picture cards.
// Each card changes "perks" for the rest of the run. Icons are SVG symbol ids in
// index.html; color picks the card background.

export const CARDS = [
  { id: "bigFire", icon: "i-card-bigfire", color: "fire", apply: (perks) => { perks.fireRange *= 1.3; } },
  { id: "wideFire", icon: "i-card-widefire", color: "fire", apply: (perks) => { perks.fireWidth *= 1.35; } },
  { id: "quickBreath", icon: "i-card-bolt", color: "gold", apply: (perks) => { perks.regen *= 1.5; perks.drain *= 0.8; } },
  { id: "fastFeet", icon: "i-card-feet", color: "green", apply: (perks) => { perks.speed *= 1.12; } },
  { id: "bigChomp", icon: "i-card-chomp", color: "green", apply: (perks) => { perks.mouth *= 1.35; } },
  { id: "magnet", icon: "i-card-magnet", color: "blue", apply: (perks) => { perks.magnet += 1.8; } },
  { id: "extraHeart", icon: "i-heart", color: "pink", max: 2, apply: (perks) => { perks.extraHearts += 1; } },
  { id: "lucky", icon: "i-card-clover", color: "gold", apply: (perks) => { perks.luck *= 2.5; } },
  { id: "buddyCat", icon: "i-card-cat", color: "blue", apply: (perks) => { perks.buddies.push("cat"); } },
  { id: "buddyDog", icon: "i-card-dog", color: "blue", apply: (perks) => { perks.buddies.push("dog"); } },
  { id: "buddyHorse", icon: "i-card-horse", color: "blue", apply: (perks) => { perks.buddies.push("horse"); } },
];

export function freshPerks() {
  return { fireRange: 1, fireWidth: 1, regen: 1, drain: 1, speed: 1, mouth: 1, magnet: 0, extraHearts: 0, luck: 1, buddies: [], picked: {} };
}

// Three different cards, skipping ones that reached their limit. At most one buddy card.
export function drawCards(perks, random) {
  const pool = CARDS.filter((card) => !card.max || (perks.picked[card.id] ?? 0) < card.max);
  const hand = [];
  while (hand.length < 3 && pool.length > 0) {
    const index = Math.floor(random() * pool.length);
    const [card] = pool.splice(index, 1);
    if (card.id.startsWith("buddy") && hand.some((other) => other.id.startsWith("buddy"))) continue;
    hand.push(card);
  }
  return hand;
}

export function applyCard(perks, card) {
  card.apply(perks);
  perks.picked[card.id] = (perks.picked[card.id] ?? 0) + 1;
}
