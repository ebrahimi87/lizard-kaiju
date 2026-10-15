import { FootCatcher } from "./FootCatcher.js";
import { JeepCatcher, JEEP_MODELS } from "./JeepCatcher.js";
import { HelicopterCatcher } from "./HelicopterCatcher.js";
import { RobotBoss, ROBOT_MODELS } from "./RobotBoss.js";

// One catcher per stage, chosen by the stage's gear. All share one interface:
//   active, stunned, aimPoint, hitRadius, arrive(world, player, tuning), hide(),
//   update(dt, player, stage, world) → event | null, burn(tuning, dt), soak(tuning, forward),
//   dizzy(tuning), cheer(), slow(seconds), dispose()

export const GEAR_MODELS = {
  net: [],
  netGun: [],
  jeep: JEEP_MODELS,
  helicopter: [],
  robot: ROBOT_MODELS,
};

export function createCatcher(gear, scene, particles, sound) {
  if (gear === "jeep") return new JeepCatcher(scene, particles, sound);
  if (gear === "helicopter") return new HelicopterCatcher(scene, particles, sound);
  if (gear === "robot") return new RobotBoss(scene, particles, sound);
  return new FootCatcher(scene, particles, sound);
}
