// Tuning for each stage. Distances are world units; the gecko is about 1.7 long at
// scale 1. Speeds are units per second. Every number that shapes play lives here.
//
// catcher.gear: "net" (on foot) | "netGun" (on foot, also shoots nets) | "jeep" |
//               "helicopter" | "robot" (final boss)

const BASE_CATCHER = {
  scale: 1.25,
  arriveAfter: 14, // seconds, or sooner once arriveAfterEaten critters are eaten
  arriveAfterEaten: 4,
  speed: 3.5,
  speedRamp: 0.012, // speed gained per second on the stage
  maxSpeed: 4.1,
  swingRange: 3.0,
  netRadius: 1.25,
  windup: 0.85,
  stuckTime: 1.3,
  hotPantsTime: 3.2,
  slipTime: 2.6,
  dizzyTime: 2.6,
};

const BUG_TABLE = [
  { kind: "ladybug", weight: 4, value: 1, speed: 1.1, fleeSpeed: 2.2, fleeRadius: 2.6, scale: 1 },
  { kind: "beetle", weight: 3, value: 1, speed: 1.3, fleeSpeed: 2.4, fleeRadius: 2.6, scale: 1 },
  { kind: "grasshopper", weight: 2, value: 2, speed: 1.6, fleeSpeed: 3.0, fleeRadius: 3.0, scale: 1 },
  { kind: "butterfly", weight: 2, value: 2, speed: 1.4, fleeSpeed: 2.8, fleeRadius: 3.2, scale: 1 },
];

export const STAGES = [
  {
    id: "garden",
    form: "gecko",
    nextForm: "frilled",
    biome: "garden",
    growthTarget: 24,
    // Growth scales the lizard from 1 to this size before it evolves.
    maxGrowthScale: 1.4,
    player: { speed: 4.6, acceleration: 22, turnRate: 11, mouthRadius: 0.42, bodyRadius: 0.45 },
    breath: { range: 3.4, halfAngle: 0.42, aimAngle: 0.9, drain: 34, regen: 30, regenDelay: 0.4 },
    camera: { height: 6.4, distance: 5.0, lookAhead: 1.4, fov: 42 },
    critters: { alive: 12, spawnMin: 9, spawnMax: 18, shinyChance: 1 / 30, table: BUG_TABLE },
    catcher: { ...BASE_CATCHER, gear: "net" },
    flowers: 0,
    escapeTaps: 6,
    hearts: 3,
    buddies: [{ kind: "dog" }],
  },
  {
    id: "jungle",
    form: "frilled",
    nextForm: "komodo",
    biome: "jungle",
    growthTarget: 26,
    maxGrowthScale: 1.4,
    player: { speed: 4.9, acceleration: 22, turnRate: 10, mouthRadius: 0.46, bodyRadius: 0.48 },
    breath: { range: 3.9, halfAngle: 0.42, aimAngle: 0.9, drain: 32, regen: 30, regenDelay: 0.4 },
    camera: { height: 6.8, distance: 5.3, lookAhead: 1.5, fov: 42 },
    critters: {
      alive: 12,
      spawnMin: 9,
      spawnMax: 18,
      shinyChance: 1 / 30,
      table: [
        { kind: "beetle", weight: 3, value: 1, speed: 1.4, fleeSpeed: 2.6, fleeRadius: 2.8, scale: 1.1 },
        { kind: "butterfly", weight: 3, value: 2, speed: 1.5, fleeSpeed: 3.0, fleeRadius: 3.2, scale: 1.1 },
        { kind: "frog", weight: 3, value: 2, speed: 1.4, fleeSpeed: 3.0, fleeRadius: 3.0, scale: 0.9 },
        { kind: "grasshopper", weight: 2, value: 2, speed: 1.7, fleeSpeed: 3.2, fleeRadius: 3.0, scale: 1.1 },
      ],
    },
    catcher: {
      ...BASE_CATCHER,
      gear: "netGun",
      speed: 3.7,
      maxSpeed: 4.4,
      shotRange: [5, 10], // shoots nets when the lizard is this far away
      shotAim: 1.0,
      shotFlight: 0.7,
      shotCooldown: 4.5,
    },
    flowers: 5,
    escapeTaps: 7,
    hearts: 3,
    buddies: [{ kind: "cat" }],
  },
  {
    id: "swamp",
    form: "komodo",
    nextForm: "dino",
    biome: "swamp",
    growthTarget: 28,
    maxGrowthScale: 1.4,
    player: { speed: 5.1, acceleration: 20, turnRate: 9, mouthRadius: 0.58, bodyRadius: 0.62 },
    breath: { range: 4.4, halfAngle: 0.42, aimAngle: 0.9, drain: 30, regen: 30, regenDelay: 0.4 },
    camera: { height: 7.6, distance: 5.9, lookAhead: 1.7, fov: 42 },
    critters: {
      alive: 12,
      spawnMin: 10,
      spawnMax: 20,
      shinyChance: 1 / 30,
      table: [
        { kind: "frog", weight: 3, value: 1, speed: 1.5, fleeSpeed: 3.0, fleeRadius: 3.2, scale: 1.2 },
        { kind: "crab", weight: 3, value: 2, speed: 1.4, fleeSpeed: 2.8, fleeRadius: 3.0, scale: 1.2 },
        { kind: "fish", weight: 2, value: 2, speed: 1.8, fleeSpeed: 3.2, fleeRadius: 3.4, scale: 1.2 },
        { kind: "mouse", weight: 3, value: 2, speed: 1.9, fleeSpeed: 3.6, fleeRadius: 3.4, scale: 1.1 },
      ],
    },
    catcher: {
      ...BASE_CATCHER,
      gear: "jeep",
      scale: 1.3,
      speed: 4.2,
      maxSpeed: 4.8,
      chargeSpeed: 11,
      chargeLength: 13,
      laneWidth: 2.2,
      chargeAim: 1.1,
      chargeCooldown: 2.5,
    },
    flowers: 5,
    escapeTaps: 7,
    hearts: 3,
    buddies: [{ kind: "horse" }],
  },
  {
    id: "volcano",
    form: "dino",
    nextForm: "kaiju",
    biome: "volcano",
    growthTarget: 30,
    maxGrowthScale: 1.35,
    player: { speed: 5.6, acceleration: 20, turnRate: 8.5, mouthRadius: 0.75, bodyRadius: 0.75 },
    breath: { range: 5.2, halfAngle: 0.42, aimAngle: 0.95, drain: 28, regen: 32, regenDelay: 0.35 },
    camera: { height: 9.2, distance: 7.0, lookAhead: 2, fov: 42 },
    critters: {
      alive: 13,
      spawnMin: 11,
      spawnMax: 22,
      shinyChance: 1 / 30,
      table: [
        { kind: "drone", weight: 4, value: 2, speed: 1.8, fleeSpeed: 3.4, fleeRadius: 3.6, scale: 1.6 },
        { kind: "chicken", weight: 3, value: 2, speed: 1.8, fleeSpeed: 3.6, fleeRadius: 3.6, scale: 1.3 },
        { kind: "crab", weight: 2, value: 2, speed: 1.5, fleeSpeed: 3.0, fleeRadius: 3.2, scale: 1.6 },
      ],
    },
    catcher: {
      ...BASE_CATCHER,
      gear: "helicopter",
      scale: 1.5,
      speed: 4.6,
      maxSpeed: 5.2,
      hover: 5.5,
      dropAim: 1.15,
      dropCount: 2,
      dropCooldown: 3.6,
      netRadius: 1.6,
    },
    flowers: 5,
    escapeTaps: 8,
    hearts: 3,
    buddies: [{ kind: "dog" }],
  },
  {
    id: "city",
    form: "kaiju",
    nextForm: null,
    biome: "city",
    // In the city the growth bar is the "power" bar: filling it calls the robot.
    growthTarget: 24,
    // The kaiju model is drawn 1.7× bigger here; player/breath sizes below are per model unit.
    baseScale: 1.7,
    maxGrowthScale: 1.25,
    player: { speed: 4.8, acceleration: 18, turnRate: 7.5, mouthRadius: 0.6, bodyRadius: 0.6 },
    breath: { range: 4.4, halfAngle: 0.38, aimAngle: 0.95, drain: 26, regen: 34, regenDelay: 0.3 },
    camera: { height: 12.5, distance: 9.4, lookAhead: 2.4, fov: 42 },
    critters: {
      alive: 10,
      spawnMin: 12,
      spawnMax: 24,
      shinyChance: 1 / 25,
      table: [{ kind: "drone", weight: 1, value: 1, speed: 2.2, fleeSpeed: 4, fleeRadius: 2.6, scale: 2.6 }],
    },
    catcher: {
      ...BASE_CATCHER,
      gear: "robot",
      scale: 0.42,
      speed: 3.2,
      maxSpeed: 3.6,
      armor: 3,
      armorHealth: 100,
      fireDamage: 38, // per second of fire on the robot
      shortedMultiplier: 2.2, // fire damage while water has shorted it out
      megaDamage: 120,
      punchRange: 5,
      punchRadius: 2.6,
      punchWindup: 1.0,
      cannonRange: [7, 16],
      cannonAim: 1.1,
      cannonCooldown: 5,
      shortTime: 2.5,
    },
    flowers: 4,
    escapeTaps: 9,
    hearts: 4,
    buddies: [],
  },
];

export const FORM_ORDER = ["gecko", "frilled", "komodo", "dino", "kaiju"];

// Endless Kaiju City (unlocked after the first win): the robot comes back again and
// again, a little tougher each wave. The city grows back between waves.
export const ENDLESS = {
  ...STAGES[4],
  id: "endless",
  endless: true,
  growthTarget: 8,
  hearts: 4,
};
