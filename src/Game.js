import * as THREE from "three";
import { createRenderer, pickQuality } from "./render/Renderer.js";
import { FollowCamera } from "./render/FollowCamera.js";
import { createThumbnailer, renderFormPortraits } from "./render/Portraits.js";
import { buildWorld } from "./world/World.js";
import { disposeTree, loadModels } from "./world/Assets.js";
import { FlowerSystem } from "./world/Flowers.js";
import { SmashSystem } from "./world/Smash.js";
import { MysteryEgg } from "./world/MysteryEgg.js";
import { Particles } from "./fx/Particles.js";
import { Breath } from "./fx/Breath.js";
import { MegaBeam } from "./fx/MegaBeam.js";
import { Player } from "./actors/Player.js";
import { CritterSystem } from "./actors/Critters.js";
import { BuddySystem } from "./actors/Buddies.js";
import { createCatcher, GEAR_MODELS } from "./actors/catchers/createCatcher.js";
import { createNetDome } from "./actors/catcher/CatcherModel.js";
import { LizardModel } from "./actors/lizard/LizardModel.js";
import { attachHat, createHat, HATS } from "./actors/lizard/Hats.js";
import { createBuddyModel, createCritterModel, CRITTER_KINDS } from "./actors/critters/CritterModels.js";
import { ENDLESS, STAGES } from "./config/stages.js";
import { FORMS, SKINS, formById } from "./config/forms.js";
import { SKIN_LIST } from "./config/cosmetics.js";
import { UPGRADES, startingPerks } from "./config/upgrades.js";
import { applyCard, drawCards } from "./config/cards.js";
import { LabScene } from "./ui/LabScene.js";
import { LabMenu } from "./ui/LabMenu.js";
import { StickerBook } from "./ui/StickerBook.js";
import { loadSave, writeSave } from "./core/SaveGame.js";
import { Random } from "./core/Random.js";
import { Music } from "./audio/Music.js";

// Phases of play and what moves the game from one to the next:
//
//   title ⇄ lab (shop) ; title ⇄ book (stickers) ; title ─city─► endless playing
//   loading → title ──play──► playing ◄──────────────────────┐
//                               │ catcher arrives / boss lands │
//                               ├─► intro (camera) ────────────┤
//                               │ net lands                    │
//                               ├─► caught ─taps───────────────┤ (hearts left)
//                               │        └─► captured ─retry─► reload stage
//                               │ growth bar full
//                               ├─► evolving ─► cards ─► next stage
//                               │ (city) boss defeated
//                               └─► victory ─► play again / title
//   paused freezes whichever phase was running.

const INTRO_TIME = 2.4;
const BOSS_INTRO_TIME = 3.2;
const EVOLVE_SWAP = 1.3;
const EVOLVE_END = 3.6;
const CAPTURED_DELAY = 1.7;
const ESCAPE_DECAY = 0.12;
const VICTORY_BONUS = 50;
const FLOWER_SIZE = [1.3, 1.5, 1.9, 2.5, 3.2];

// The trophy sticker is the same drawing as the trophy icon, as an image.
function trophyImage() {
  const symbol = document.getElementById("i-trophy");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">${symbol.innerHTML}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Stage tuning with the run's power-card perks applied.
function tuneStage(stage, perks) {
  return {
    ...stage,
    player: { ...stage.player, speed: stage.player.speed * perks.speed, mouthRadius: stage.player.mouthRadius * perks.mouth },
    breath: {
      ...stage.breath,
      range: stage.breath.range * perks.fireRange,
      halfAngle: stage.breath.halfAngle * perks.fireWidth,
      regen: stage.breath.regen * perks.regen,
      drain: stage.breath.drain * perks.drain,
    },
    critters: { ...stage.critters, shinyChance: stage.critters.shinyChance * perks.luck },
    hearts: stage.hearts + perks.extraHearts,
  };
}

export class Game {
  constructor({ canvas, hud, input, sound }) {
    this.canvas = canvas;
    this.hud = hud;
    this.input = input;
    this.sound = sound;
    this.music = new Music(sound);
    this.save = loadSave();
    this.perks = startingPerks(this.save);
    this.phase = "loading";
    this.pausedPhase = null;
    this.debug = new URLSearchParams(window.location.search).get("debug") === "1";
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);
    this.follow = new FollowCamera(this.camera);
    this.scene = null;
    this.time = 0;
    this.temp = new THREE.Vector3();
    this.screen = { x: 0, y: 0, onScreen: false, behind: false };
    this.move = { x: 0, z: 0 };
    this.titleActors = [];
    this.endless = false;
    this.wave = 0;
    this.thumbs = new Map();
    this.labMenu = new LabMenu({
      onTab: (tab) => this.openLabTab(tab),
      onPick: (tab, item, card) => this.pickLabItem(tab, item, card),
      onForm: (step) => this.cycleLabForm(step),
      onBack: () => this.closeOverlay(),
    });
    this.book = new StickerBook(() => this.closeOverlay());
  }

  get skin() {
    return SKINS[this.save.skin] ?? SKINS.ruby;
  }

  async boot() {
    this.graphics = createRenderer(this.canvas, pickQuality());
    this.thumbnailer = createThumbnailer(this.graphics.renderer, this.graphics.environment);
    this.portraits = renderFormPortraits(this.thumbnailer, this.skin);
    this.sound.setMuted(this.save.muted);
    this.hud.setSound(!this.save.muted);
    this.resize();
    window.addEventListener("resize", () => this.resize());
    // The rotate prompt (CSS, same rule) covers everything in portrait. frame() pauses
    // play whenever it shows, including when a new stage starts behind it.
    this.portrait = window.matchMedia("(orientation: portrait) and (max-width: 1100px)");
    await this.loadStage(Math.min(this.save.stage, STAGES.length - 1));
    this.enterTitle();
  }

  // ---------- stage setup ----------

  async loadStage(index, endless = false) {
    this.phase = "loading";
    this.hud.showScreen("loading");
    this.hud.setLoading(0.1);
    this.disposeStage();
    this.stageIndex = index;
    this.endless = endless;
    this.stage = tuneStage(endless ? ENDLESS : STAGES[index], this.perks);
    this.random = new Random(1000 + index * 7919 + Math.floor(Math.random() * 100000));
    const random = () => this.random.next();
    this.scene = new THREE.Scene();
    await loadModels(GEAR_MODELS[this.stage.catcher.gear]);
    this.world = await buildWorld(this.scene, this.graphics, this.stage.biome, random, { clearRadius: 6 });
    this.hud.setLoading(0.8);
    this.particles = new Particles(this.scene);
    this.particles.resize(this.graphics.renderer.domElement.height, this.camera.fov);
    this.breath = new Breath(this.scene, this.particles);
    this.mega = new MegaBeam(this.scene, this.particles, this.sound);
    this.player = new Player(this.scene, this.stage.form, this.skin, this.save.hat);
    this.critters = new CritterSystem(this.scene, this.particles, random);
    this.catcher = createCatcher(this.stage.catcher.gear, this.scene, this.particles, this.sound);
    this.buddies = new BuddySystem(this.scene, this.particles, this.sound);
    this.buddies.reset(this.stage, this.world, random);
    this.flowers = new FlowerSystem(this.scene, this.particles, this.sound);
    this.flowers.reset(this.stage.flowers, this.world, random, FLOWER_SIZE[index]);
    this.smash = new SmashSystem(this.scene, this.particles, this.sound);
    this.smash.reset(this.world.smashables ?? []);
    this.netDome = createNetDome();
    this.netDome.group.visible = false;
    this.scene.add(this.netDome.group);
    this.egg = new MysteryEgg(this.scene, this.particles, this.sound);
    // Off to the side of the start, small enough not to block the view ahead.
    const reach = this.stage.camera.height / 6.4;
    this.egg.place(-2.2 * reach, 3.2 * reach, FLOWER_SIZE[index] * 0.7);
    this.resetStageState();
    for (const kind of this.perks.buddies) this.buddies.addFreed(kind, this.temp.set(-1.5, 0, -2));
    this.camera.fov = this.stage.camera.fov;
    this.camera.updateProjectionMatrix();
    this.follow.override = null;
    this.follow.snap(this.player.position, this.stage.camera, this.zoom());
    this.hud.setFormIcons(this.portraits[this.stage.form], this.portraits[this.stage.nextForm] ?? null);
    this.hud.setBoss(false);
    this.hud.setLoading(1);
    this.graphics.resetMonitor();
  }

  resetStageState() {
    this.growth = 0;
    this.hearts = this.stage.hearts;
    this.stageTime = 0;
    this.eatenCount = 0;
    this.catcherArrived = false;
    this.bossMode = false;
    this.wave = 0;
    this.nextWaveAt = 0;
    this.runStartGems = this.save.gems;
    this.megaMeter = 0;
    this.escape = 0;
    this.phaseTime = 0;
    this.displayGems = this.save.gems;
    this.tutorialStep = this.save.tutorialDone ? "done" : "move";
    this.waterHint = this.stageIndex === 1 && !this.save.waterTutorialDone ? 7 : 0;
    this.movedDistance = 0;
    this.fireHintTime = 0;
    this.player.position.set(0, 0, 0);
    this.player.velocity.set(0, 0, 0);
    this.player.heading = 0;
    this.player.scale = this.stage.baseScale ?? 1;
    this.player.invulnerable = 0;
    this.breath.reset();
    this.critters.clear();
    this.catcher.hide();
    this.netDome.group.visible = false;
    this.hud.setHearts(this.hearts, this.stage.hearts);
    this.hud.setGrowth(0);
    this.hud.setGems(this.save.gems);
    this.hud.setPowers({ water: this.stageIndex >= 1, mega: false });
    this.hud.setEscape(false);
    this.hud.setTarget(false);
    this.hud.setFinger(null);
    this.hud.hintButton("fire", false);
    this.hud.hintButton("water", false);
    this.graphics.finish.uniforms.uFlash.value = 0;
  }

  disposeStage() {
    if (!this.scene) return;
    // Free GPU memory first, while everything is still attached to the scene.
    disposeTree(this.scene);
    this.clearTitleActors();
    this.critters.clear();
    this.buddies.clear();
    this.flowers.clear();
    this.smash.dispose();
    this.egg.dispose();
    this.catcher.dispose();
    this.player.dispose();
    this.netDome.dispose();
    this.sound.setLoop("fire", false);
    this.sound.setLoop("water", false);
    this.scene = null;
  }

  // ---------- title ----------

  enterTitle() {
    this.phase = "title";
    this.phaseTime = 0;
    this.hud.showScreen("title");
    this.hud.setTitleInfo(this.save.gems, this.save.wins > 0);
    this.music.setIntensity(0);
    this.music.play("title");
    this.player.model.group.visible = false;
    this.egg.model.group.visible = false;
    this.clearTitleActors();
    const spots = [
      { x: -3.4, z: 2.4, scale: 1, yaw: 0.95 },
      { x: -1.4, z: 0.9, scale: 1.2, yaw: 1.0 },
      { x: 0.9, z: -0.8, scale: 1.45, yaw: 1.05 },
      { x: 3.4, z: -3.0, scale: 1.9, yaw: 1.1 },
      { x: 6.6, z: -6.4, scale: 2.9, yaw: 0.85 },
    ];
    FORMS.forEach((form, index) => {
      const model = new LizardModel(form, this.skin);
      attachHat(model, this.save.hat);
      const spot = spots[index];
      model.group.position.set(spot.x, 0, spot.z + 4);
      model.group.rotation.y = spot.yaw;
      model.group.scale.setScalar(spot.scale);
      this.scene.add(model.group);
      this.titleActors.push({ model, motion: { speed: 0, turnRate: 0, mouthOpen: 0, roar: 0, glow: 0, glowFront: 1.2, lookYaw: 0 }, index });
    });
  }

  clearTitleActors() {
    for (const actor of this.titleActors) {
      this.scene.remove(actor.model.group);
      actor.model.dispose();
    }
    this.titleActors.length = 0;
  }

  updateTitle(dt) {
    const t = this.phaseTime;
    for (const actor of this.titleActors) {
      // The kaiju roars now and then; everyone breathes and looks around.
      const kaiju = actor.index === 4;
      const roarWave = kaiju ? Math.max(0, Math.sin(t * 0.9) - 0.4) / 0.6 : 0;
      actor.motion.roar = roarWave;
      actor.motion.mouthOpen = roarWave;
      actor.motion.glow = kaiju ? 1 + roarWave * 3 : 0;
      actor.motion.lookYaw = Math.sin(t * 0.7 + actor.index) * 0.3;
      actor.model.update(dt, actor.motion);
    }
    const angle = Math.sin(t * 0.15) * 0.25;
    this.camera.position.set(-3.2 + Math.sin(angle) * 4, 2.8, 13.5 + Math.cos(angle) * 0.5);
    this.camera.lookAt(this.temp.set(1.6, 1.8, 2.4));
    this.world.update(this.time, this.temp.set(1.5, 0, 2), 0.1, 14);
  }

  play() {
    this.sound.unlock();
    this.sound.click();
    if (this.phase !== "title") return;
    this.clearTitleActors();
    this.startPlaying();
  }

  startPlaying() {
    this.player.calm = 2;
    this.player.model.group.visible = true;
    this.egg.model.group.visible = !this.egg.opened;
    this.follow.override = null;
    this.follow.snap(this.player.position, this.stage.camera, this.zoom());
    this.particles.burst("sparkle", this.player.position, 24, 3);
    this.music.play(this.stageTheme());
    this.music.duck(1);
    this.sound.roar(0.6 + this.stageIndex);
    this.setPhase("playing");
  }

  async playAgain() {
    this.sound.unlock();
    this.sound.click();
    this.perks = startingPerks(this.save);
    if (this.endless) await this.loadStage(4, true);
    else await this.loadStage(0);
    this.startPlaying();
  }

  async playEndless() {
    this.sound.unlock();
    this.sound.click();
    if (this.phase !== "title") return;
    this.perks = startingPerks(this.save);
    await this.loadStage(4, true);
    this.startPlaying();
  }

  setPhase(phase) {
    this.phase = phase;
    this.phaseTime = 0;
    if (phase !== "caught") this.hud.setEscape(false);
    const screens = { paused: "paused", captured: "captured", cards: "cards", victory: "victory" };
    this.hud.showScreen(screens[phase] ?? "playing");
  }

  // ---------- main loop ----------

  // render = false lets debug stepping simulate many frames without drawing each one.
  frame(dt, render = true) {
    this.dt = dt;
    this.time += dt;
    this.phaseTime += dt;
    const input = this.input.sample();
    if (this.portrait?.matches) this.pause();
    this.updateMusic();
    if (input.pause && (this.phase === "playing" || this.phase === "paused")) {
      if (this.phase === "paused") this.resume();
      else this.pause();
    }
    switch (this.phase) {
      case "title":
        this.updateTitle(dt);
        break;
      case "playing":
        this.updatePlaying(dt, input);
        break;
      case "intro":
        this.updateIntro(dt);
        break;
      case "caught":
        this.updateCaught(dt, input);
        break;
      case "captured":
        this.updateCaptured(dt);
        break;
      case "evolving":
        this.updateEvolving(dt);
        break;
      case "cards":
        this.updateCards(dt);
        break;
      case "victory":
        this.updateVictory(dt);
        break;
      case "lab":
        this.labScene.update(dt, this.camera.aspect);
        break;
      default:
        break;
    }
    if (this.phase === "lab") {
      if (render) this.graphics.render(this.labScene.scene, this.labScene.camera);
      return;
    }
    if (this.phase === "book") return;
    if (this.phase !== "loading" && this.phase !== "paused" && this.scene) {
      this.particles.update(dt);
      this.flowers.update(dt);
      this.egg.update(dt);
      if (this.phase !== "title") {
        this.follow.update(dt, this.player.position, this.player.velocity, this.stage.camera, this.zoom());
        this.world.update(this.time, this.player.position, 0.6 * this.player.scale, 9 * this.player.scale * (this.stage.camera.height / 6.4));
        this.updateHud();
      }
    }
    if (this.scene && render && this.phase !== "loading") {
      if (this.phase === "playing" && !this.debug) this.graphics.adapt(dt);
      this.graphics.render(this.scene, this.camera);
    }
  }

  // Growth within the stage (1 at the start), independent of the stage's base size.
  get growthScale() {
    return this.player.scale / (this.stage.baseScale ?? 1);
  }

  zoom() {
    return 0.82 + 0.18 * this.growthScale;
  }

  stageTheme() {
    if (this.bossMode) return "boss";
    return ["garden", "jungle", "swamp", "volcano", "city"][this.stageIndex];
  }

  // Chase drums come in as the catcher gets close.
  updateMusic() {
    if (this.phase !== "playing" || !this.catcher?.active) {
      this.music.setIntensity(0);
      return;
    }
    const distance = this.player.position.distanceTo(this.catcher.aimPoint);
    this.music.setIntensity(Math.max(0, 1 - distance / (12 * this.player.scale)));
  }

  // ---------- playing ----------

  updatePlaying(dt, input) {
    this.stageTime += dt;
    if (this.nextWaveAt && this.stageTime >= this.nextWaveAt) this.spawnNextWave();
    const stage = this.stage;
    // Camera looks north (+Z): screen right is world -X.
    this.move.x = -input.x;
    this.move.z = input.y;
    const beam = this.updateMega(dt, input);
    const canBreathe = !this.mega.active;
    const wants = { fire: input.fire && canBreathe, water: input.water && canBreathe };
    const aimHeading = wants.fire || wants.water ? this.findAim(input) : null;
    const active = this.breath.update(dt, wants, this.stageIndex >= 1, this.player, stage.breath);
    this.sound.setLoop("fire", active === "fire");
    this.sound.setLoop("water", active === "water");
    this.player.motion.glow = beam.glow;
    this.player.motion.glowFront = beam.glowFront;
    const boost = this.buddies.speedBoost * (this.mega.active ? 0.15 : 1);
    this.player.update(dt, this.temp.set(this.move.x * boost, 0, this.move.z * boost), aimHeading, Boolean(active) || this.mega.active, stage, this.world);
    this.movedDistance += Math.hypot(this.player.velocity.x, this.player.velocity.z) * dt;

    if (active) this.applyBreath(dt, active);
    if (this.perks.magnet > 0) this.critters.attract(this.player.mouth, this.perks.magnet * this.player.scale, 3 * this.player.scale, dt);
    this.critters.update(dt, stage, this.world, this.player, false);
    this.buddies.update(dt, this.player, { critters: this.critters, catcher: this.catcher, stage });
    this.eat();
    if (!this.egg.opened && this.player.position.distanceTo(this.egg.position) < this.egg.radius + stage.player.bodyRadius * this.player.scale) {
      this.egg.open();
      this.eggPrize();
    }
    const smashed = this.smash.update(dt, this.player, stage.player.bodyRadius * this.player.scale);
    if (smashed > 0) this.reward(smashed, this.player.position, 0.25);
    this.growPlayer(dt);

    if (this.checkArrival()) return;
    const event = this.catcher.update(dt, this.player, stage, this.world);
    this.handleCatcherEvent(event);
    if (this.phase !== "playing") return;
    if (!this.bossMode && stage.nextForm && this.growth >= stage.growthTarget) this.startEvolving();
    this.updateTutorial(dt);
  }

  // Returns true when an arrival cinematic started.
  checkArrival() {
    const stage = this.stage;
    if (stage.catcher.gear === "robot") {
      if (!this.bossMode && this.growth >= stage.growthTarget) {
        this.bossMode = true;
        this.music.play("boss");
        this.catcher.arrive(this.world, this.player, stage.catcher);
        this.hud.setBoss(true);
        this.startIntro(BOSS_INTRO_TIME);
        return true;
      }
      return false;
    }
    if (!this.catcherArrived && (this.stageTime > stage.catcher.arriveAfter || this.eatenCount >= stage.catcher.arriveAfterEaten)) {
      this.catcherArrived = true;
      this.catcher.arrive(this.world, this.player, stage.catcher);
      this.startIntro(INTRO_TIME);
      return true;
    }
    return false;
  }

  handleCatcherEvent(event) {
    if (event === "caught") this.startCaught();
    else if (event === "hit") this.takeHit();
    else if (event === "armor") {
      this.follow.shake(0.8);
      this.sound.roar(5);
      this.megaMeter = Math.min(1, this.megaMeter + 0.3);
    } else if (event === "landed") {
      this.follow.shake(1);
    } else if (event === "defeated") {
      if (this.endless) this.nextWave();
      else this.startVictory();
    }
  }

  // MEGA beam (kaiju only): fills from smashing and fighting, fires on the button.
  updateMega(dt, input) {
    const kaiju = this.stage.form === "kaiju";
    if (kaiju && this.bossMode) this.megaMeter = Math.min(1, this.megaMeter + dt * 0.02);
    const ready = kaiju && this.megaMeter >= 1 && !this.mega.active;
    this.hud.setPowers({ water: this.stageIndex >= 1, mega: ready });
    if (ready && input.mega) {
      this.mega.start();
      this.megaMeter = 0;
      this.breath.active = null;
    }
    const length = this.stage.breath.range * 2.4 * this.player.scale;
    const beam = this.mega.update(dt, this.player, length);
    if (this.mega.firing) {
      this.follow.shake(0.12);
      const tuning = this.stage.catcher;
      if (this.catcher.active && this.mega.hits(this.player, length, this.catcher.aimPoint.x, this.catcher.aimPoint.z, this.catcher.hitRadius)) {
        this.catcher.damage?.((tuning.megaDamage * dt) / 1.7);
      }
      for (const item of this.smash.remaining) {
        if (this.mega.hits(this.player, length, item.x, item.z, item.radius)) this.reward(this.smash.crumble(item, this.player), this.temp.set(item.x, 0, item.z), 0.1);
      }
      for (const critter of this.critters.list) {
        if (this.mega.hits(this.player, length, critter.position.x, critter.position.z, critter.radius)) critter.stun = 3;
      }
    }
    return beam;
  }

  // Auto-aim: turn toward the best target in front when breathing.
  findAim(input) {
    const player = this.player;
    const tuning = this.stage.breath;
    const range = tuning.range * player.scale * 1.7;
    let baseHeading = player.heading;
    if (Math.hypot(input.x, input.y) > 0.4) baseHeading = Math.atan2(-input.x, input.y);
    let best = null;
    let bestScore = Infinity;
    const consider = (x, z, bonus = 0) => {
      const dx = x - player.position.x;
      const dz = z - player.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > range || distance < 0.01) return;
      const heading = Math.atan2(dx, dz);
      const off = Math.abs(Math.atan2(Math.sin(heading - baseHeading), Math.cos(heading - baseHeading)));
      if (off > tuning.aimAngle) return;
      const score = off * 2 + distance / range - bonus;
      if (score < bestScore) {
        bestScore = score;
        best = heading;
      }
    };
    if (this.catcher.active && !this.catcher.stunned) consider(this.catcher.aimPoint.x, this.catcher.aimPoint.z, 0.5);
    for (const cage of this.buddies.cages) if (!cage.freed) consider(cage.position.x, cage.position.z, 0.3);
    if (input.water) for (const flower of this.flowers.list) if (!flower.done) consider(flower.position.x, flower.position.z, 0.3);
    for (const critter of this.critters.list) if (critter.stun <= 0 && critter.eaten <= 0) consider(critter.position.x, critter.position.z);
    return best;
  }

  applyBreath(dt, kind) {
    const { player, breath, stage } = this;
    const tuning = stage.breath;
    for (const critter of this.critters.list) {
      if (!breath.reaches(player, tuning, critter.position.x, critter.position.z, critter.radius)) continue;
      if (kind === "fire") {
        if (this.critters.heat(critter, dt)) {
          this.particles.burst("star", critter.position, 6, 1.6);
          this.sound.twinkle();
        }
      } else {
        this.critters.splash(critter, player.forward, 60 * dt);
      }
    }
    const catcher = this.catcher;
    if (catcher.active && breath.reaches(player, tuning, catcher.aimPoint.x, catcher.aimPoint.z, catcher.hitRadius)) {
      const fresh = kind === "fire" ? catcher.burn(stage.catcher, dt) : catcher.soak(stage.catcher, player.forward);
      if (fresh) {
        this.follow.shake(0.35);
        if (this.tutorialStep === "fire") this.tutorialStep = "done";
      }
      if (this.bossMode && kind === "fire") this.megaMeter = Math.min(1, this.megaMeter + dt * 0.05);
    }
    if (kind === "fire" && !this.egg.opened && breath.reaches(player, tuning, this.egg.position.x, this.egg.position.z, this.egg.radius)) {
      if (this.egg.warm(dt)) this.eggPrize();
    }
    if (kind === "fire") {
      for (const cage of this.buddies.cages) {
        if (cage.freed || !breath.reaches(player, tuning, cage.position.x, cage.position.z, cage.radius)) continue;
        const freed = this.buddies.heatCage(cage, dt, this.world);
        if (freed) {
          this.save.stickers[freed] = true;
          writeSave(this.save);
          this.follow.shake(0.3);
        }
      }
      for (const item of this.smash.remaining) {
        if (!breath.reaches(player, tuning, item.x, item.z, item.radius)) continue;
        const value = this.smash.heat(item, dt, player);
        if (value > 0) this.reward(value, this.temp.set(item.x, 0, item.z), 0.25);
      }
    } else {
      for (const flower of this.flowers.list) {
        if (flower.done || !breath.reaches(player, tuning, flower.position.x, flower.position.z, flower.radius)) continue;
        if (this.flowers.water(flower, dt)) {
          this.reward(4, flower.position, 0, false);
          if (this.hearts < this.stage.hearts) {
            this.hearts += 1;
            this.hud.setHearts(this.hearts, this.stage.hearts);
          }
          this.waterHint = 0;
          this.save.waterTutorialDone = true;
        }
      }
    }
  }

  // Mystery egg surprise: usually gems, sometimes a new hat or a bonus heart.
  eggPrize() {
    const roll = this.random.next();
    const newHats = HATS.filter((hat) => !this.save.owned.hats.includes(hat.id));
    if (roll < 0.15 && newHats.length > 0) {
      const hat = newHats[Math.floor(this.random.next() * newHats.length)];
      this.save.owned.hats.push(hat.id);
      this.save.hat = hat.id;
      this.player.hatId = hat.id;
      attachHat(this.player.model, hat.id);
      this.player.chomp();
      this.particles.burst("heart", this.player.position, 12, 3);
      this.sound.twinkle();
    } else if (roll < 0.3) {
      this.hearts += 1;
      this.stage.hearts = Math.max(this.stage.hearts, this.hearts);
      this.hud.setHearts(this.hearts, this.stage.hearts);
      this.particles.burst("heart", this.egg.position, 14, 3);
    } else {
      this.reward([5, 8, 10, 15, 25][Math.floor(this.random.next() * 5)], this.egg.position, 0, false);
    }
    writeSave(this.save);
  }

  // Growth, gems, and the flying gem animation for value earned at a world point.
  reward(value, point, megaGain = 0, grows = true) {
    if (grows) this.growth += value;
    this.save.gems += value;
    writeSave(this.save);
    this.megaMeter = Math.min(1, this.megaMeter + value * megaGain * 0.25);
    this.project(point);
    // Up to six icons fly; together they add the whole reward to the counter.
    const icons = Math.min(value, 6);
    let left = value;
    let flying = icons;
    const scene = this.scene;
    this.hud.flyGems(this.screen.x, this.screen.y, icons, () => {
      if (this.scene !== scene) return; // the stage changed while the icons flew
      const share = Math.ceil(left / flying);
      left -= share;
      flying -= 1;
      this.displayGems += share;
      this.hud.setGems(Math.min(this.displayGems, this.save.gems));
      this.sound.gem();
    });
  }

  eat() {
    const critter = this.critters.tryEat(this.player, this.stage.player.mouthRadius);
    if (!critter) return;
    this.eatenCount += 1;
    this.save.stickers[critter.spec.kind] = true;
    if (critter.shiny) this.save.stickers[`${critter.spec.kind}-gold`] = true;
    this.player.chomp();
    this.sound.chomp();
    this.particles.burst(critter.shiny ? "gold" : "sparkle", this.player.mouth, critter.shiny ? 30 : 10, 2.2);
    this.follow.shake(0.08);
    this.reward(critter.value, this.player.mouth, 0.15);
    if (this.tutorialStep === "eat") this.tutorialStep = "wait-catcher";
  }

  growPlayer(dt) {
    const fraction = Math.min(1, this.growth / this.stage.growthTarget);
    const target = (this.stage.baseScale ?? 1) * (1 + (this.stage.maxGrowthScale - 1) * fraction);
    this.player.scale += (target - this.player.scale) * Math.min(1, dt * 3);
    this.particles.setScale(this.growthScale * (this.stage.camera.height / 6.4));
  }

  // ---------- arrivals ----------

  startIntro(duration) {
    this.introTime = duration;
    this.setPhase("intro");
    this.sound.boing();
    this.follow.override = { position: new THREE.Vector3(), lookAt: new THREE.Vector3(), speed: 3.5 };
    this.hud.setTarget(false);
    this.sound.setLoop("fire", false);
    this.sound.setLoop("water", false);
  }

  updateIntro(dt) {
    const catcher = this.catcher;
    const override = this.follow.override;
    const aim = catcher.aimPoint;
    // Stand behind the lizard and look past it at the catcher, so both are in view
    // and the camera always stays inside the play area.
    const dx = this.player.position.x - aim.x;
    const dz = this.player.position.z - aim.z;
    const length = Math.hypot(dx, dz) || 1;
    const size = this.stage.camera.height / 6.4;
    override.lookAt.set(aim.x * 0.7 + this.player.position.x * 0.3, 1.2 * size, aim.z * 0.7 + this.player.position.z * 0.3);
    override.position.set(this.player.position.x + (dx / length) * 4.5 * size, 4.2 * size, this.player.position.z + (dz / length) * 4.5 * size);
    this.handleCatcherEvent(catcher.update(dt, this.player, this.stage, this.world) === "landed" ? "landed" : null);
    this.critters.update(dt, this.stage, this.world, this.player, true);
    this.player.update(dt, this.temp.set(0, 0, 0), null, false, this.stage, this.world);
    // No attacks start during the intro or right after it: time to look and move.
    this.player.calm = Math.max(this.player.calm, 1.5);
    if (this.phaseTime > this.introTime) {
      this.follow.override = null;
      this.setPhase("playing");
    }
  }

  // ---------- caught, hit, captured ----------

  startCaught() {
    this.hearts -= 1;
    this.hud.setHearts(this.hearts, this.stage.hearts);
    this.hud.flash();
    this.sound.caught();
    this.sound.setLoop("fire", false);
    this.sound.setLoop("water", false);
    this.follow.shake(0.6);
    this.player.velocity.set(0, 0, 0);
    this.netDome.group.visible = true;
    this.escape = 0;
    this.catcher.cheer();
    if (this.hearts > 0) {
      this.setPhase("caught");
    } else {
      this.setPhase("captured");
      this.hud.showScreen("playing");
    }
  }

  // A robot punch: lose a heart and get knocked back, no net.
  takeHit() {
    this.hearts -= 1;
    this.hud.setHearts(this.hearts, this.stage.hearts);
    this.hud.flash();
    this.sound.hurt();
    this.follow.shake(0.9);
    if (this.hearts <= 0) {
      this.hearts = 1;
      this.startCaught();
      return;
    }
    const away = this.temp.set(this.player.position.x - this.catcher.position.x, 0, this.player.position.z - this.catcher.position.z).normalize();
    this.player.velocity.copy(away).multiplyScalar(14);
    this.player.invulnerable = 1.6;
  }

  updateCaught(dt, input) {
    if (input.taps > 0) {
      this.escape += input.taps / this.stage.escapeTaps;
      this.sound.wriggle();
      this.follow.shake(0.06);
    }
    this.escape = Math.max(0, this.escape - ESCAPE_DECAY * dt);
    this.placeNetDome(dt, Math.min(1, 0.3 + this.escape));
    this.hud.setEscape(true, Math.min(1, this.escape));
    this.catcher.update(dt, this.player, this.stage, this.world);
    this.critters.update(dt, this.stage, this.world, this.player, true);
    this.player.update(dt, this.temp.set(0, 0, 0), null, false, this.stage, this.world);
    if (this.escape >= 1) {
      this.hud.setEscape(false);
      this.netDome.update(dt, { struggle: 1, burst: true });
      this.particles.burst("sparkle", this.player.position, 26, 3.5);
      this.sound.escape();
      this.follow.shake(0.4);
      this.player.invulnerable = 2.2;
      this.catcher.dizzy(this.stage.catcher);
      this.setPhase("playing");
      this.domeHideAt = this.time + 0.7;
    }
  }

  placeNetDome(dt, struggle) {
    this.netDome.group.position.copy(this.player.position);
    this.netDome.group.scale.setScalar(this.player.scale * this.player.form.dome);
    this.netDome.update(dt, { struggle, burst: false });
  }

  updateCaptured(dt) {
    this.placeNetDome(dt, 0.2);
    this.catcher.update(dt, this.player, this.stage, this.world);
    this.player.update(dt, this.temp.set(0, 0, 0), null, false, this.stage, this.world);
    if (this.phaseTime <= CAPTURED_DELAY) return;
    if (this.endless) {
      if (this.hud.el.victory.hidden) {
        this.save.bestWave = Math.max(this.save.bestWave, this.wave);
        writeSave(this.save);
        this.hud.showVictory(this.runStartGems, this.save.gems, this.wave);
      }
    } else if (this.hud.el.captured.hidden) {
      this.hud.showScreen("captured");
    }
  }

  // Endless: a robot went down. Celebrate, regrow the city, and send a tougher one.
  nextWave() {
    this.wave += 1;
    this.reward(10 * this.wave, this.catcher.position, 0, false);
    this.particles.burst("gold", this.catcher.position, 40, 6, 2);
    this.particles.burst("confetti", this.catcher.position, 40, 6, 2);
    this.sound.escape();
    this.hearts = Math.min(this.stage.hearts, this.hearts + 1);
    this.hud.setHearts(this.hearts, this.stage.hearts);
    // The next robot comes after 3.5 s of play (counted in stage time, so pausing
    // or leaving the stage cannot fire it later).
    this.nextWaveAt = this.stageTime + 3.5;
  }

  // Endless: regrow the city and get a tougher robot ready; it drops in when the power
  // bar fills again.
  spawnNextWave() {
    this.nextWaveAt = 0;
    this.catcher.dispose();
    this.stage = { ...this.stage, catcher: { ...this.stage.catcher, armor: 3 + this.wave, speed: this.stage.catcher.speed * 1.08 } };
    this.catcher = createCatcher("robot", this.scene, this.particles, this.sound);
    this.smash.regrow();
    this.bossMode = false;
    this.growth = 0;
    this.music.play("city");
    this.hud.setBoss(false);
    this.hud.setFormIcons(this.portraits.kaiju, null);
  }

  async retry() {
    this.sound.unlock();
    this.sound.click();
    await this.loadStage(this.stageIndex);
    this.startPlaying();
  }

  // ---------- evolution and cards ----------

  startEvolving() {
    this.setPhase("evolving");
    this.hud.showScreen("cinematic");
    this.sound.setLoop("fire", false);
    this.sound.setLoop("water", false);
    this.music.duck(3);
    this.sound.evolve();
    if (this.catcher.active) this.catcher.dizzy(this.stage.catcher);
    this.evolved = false;
    this.follow.override = { position: new THREE.Vector3(), lookAt: new THREE.Vector3(), speed: 3 };
  }

  updateEvolving(dt) {
    const t = this.phaseTime;
    const player = this.player;
    const finish = this.graphics.finish.uniforms;
    const override = this.follow.override;
    const size = this.growthScale * (this.evolved ? STAGES[this.stageIndex + 1].camera.height / 6.4 : this.stage.camera.height / 6.4);
    override.lookAt.copy(player.position).setY(0.45 * size);
    override.position.copy(player.position).add(this.temp.set(0, 3.4 * size, -3.6 * size));
    if (!this.evolved) {
      // Spin faster and faster while glowing, then flash into the new form.
      player.heading += dt * (2 + t * t * 9);
      finish.uFlash.value = Math.pow(Math.min(1, t / EVOLVE_SWAP), 3);
      if (Math.random() < 0.8) this.particles.burst("sparkle", player.position, 2, 2.5);
      if (t >= EVOLVE_SWAP) this.swapForm();
    } else {
      finish.uFlash.value = Math.max(0, 1 - (t - EVOLVE_SWAP) * 2.2);
      player.motion.roar = t < EVOLVE_SWAP + 1.6 ? 1 : Math.max(0, player.motion.roar - dt * 2);
      player.motion.glow = player.motion.roar * 3;
    }
    player.update(dt, this.temp.set(0, 0, 0), null, false, this.stage, this.world);
    this.catcher.update(dt, player, this.stage, this.world);
    this.critters.update(dt, this.stage, this.world, player, true);
    if (t > EVOLVE_END) this.showCards();
  }

  swapForm() {
    this.evolved = true;
    const next = this.stage.nextForm;
    this.player.setForm(next);
    this.player.heading = Math.PI; // face the camera for the roar
    this.particles.burst("confetti", this.player.position, 40, 5);
    this.particles.burst("gold", this.player.position, 30, 4);
    this.follow.shake(0.7);
    this.sound.roar(1 + FORMS.findIndex((form) => form.id === next));
  }

  showCards() {
    this.graphics.finish.uniforms.uFlash.value = 0;
    this.player.motion.roar = 0;
    this.player.motion.glow = 0;
    this.save.stage = this.stageIndex + 1;
    this.save.bestStage = Math.max(this.save.bestStage, this.stageIndex + 1);
    this.save.tutorialDone = true;
    writeSave(this.save);
    this.setPhase("cards");
    this.hud.showCards(drawCards(this.perks, () => this.random.next()), (card) => {
      applyCard(this.perks, card);
      this.sound.escape();
      this.nextStage();
    });
    this.sound.twinkle();
  }

  updateCards(dt) {
    this.player.motion.lookYaw = Math.sin(this.phaseTime * 1.3) * 0.4;
    this.player.update(dt, this.temp.set(0, 0, 0), null, false, this.stage, this.world);
  }

  async nextStage() {
    this.follow.override = null;
    await this.loadStage(this.stageIndex + 1);
    this.startPlaying();
  }

  // ---------- victory ----------

  startVictory() {
    this.music.setIntensity(0);
    this.music.play("victory");
    this.setPhase("victory");
    this.hud.showScreen("cinematic");
    this.hud.setBoss(false);
    this.sound.setLoop("fire", false);
    this.sound.setLoop("water", false);
    this.follow.override = { position: new THREE.Vector3(), lookAt: new THREE.Vector3(), speed: 1.5 };
    this.victoryFromGems = this.save.gems;
    this.save.gems += VICTORY_BONUS;
    this.save.wins += 1;
    this.save.stage = 0;
    this.save.stickers.trophy = true;
    writeSave(this.save);
    this.victoryShown = false;
  }

  updateVictory(dt) {
    const t = this.phaseTime;
    const player = this.player;
    const size = this.growthScale * (this.stage.camera.height / 6.4);
    const override = this.follow.override;
    const angle = Math.PI + t * 0.35;
    override.lookAt.copy(player.position).setY(0.8 * size);
    override.position.set(player.position.x + Math.sin(angle) * 4.2 * size, 2.2 * size, player.position.z + Math.cos(angle) * 4.2 * size);
    player.motion.roar = Math.max(0, Math.sin(t * 2.2));
    player.motion.mouthOpen = player.motion.roar;
    player.motion.glow = 2 + player.motion.roar * 3;
    player.update(dt, this.temp.set(0, 0, 0), null, false, this.stage, this.world);
    this.catcher.update(dt, player, this.stage, this.world);
    // Fireworks over the city.
    if (Math.random() < dt * 4) {
      this.temp.set(player.position.x + (Math.random() - 0.5) * 20, 6 + Math.random() * 8, player.position.z + 6 + Math.random() * 12);
      this.particles.burst(Math.random() < 0.5 ? "confetti" : "gold", this.temp, 30, 6, 2);
      this.sound.twinkle();
    }
    if (t > 4 && !this.victoryShown) {
      this.victoryShown = true;
      this.hud.showVictory(this.victoryFromGems, this.save.gems);
      this.hud.setGems(this.save.gems);
    }
  }

  // ---------- Lizard Lab and sticker book ----------

  // Cached picture of a model, rendered once on first use.
  thumb(key, makeObject, options) {
    if (!this.thumbs.has(key)) {
      const object = makeObject();
      this.thumbs.set(key, this.thumbnailer.render(object, options));
      object.traverse((child) => child.geometry?.dispose());
    }
    return this.thumbs.get(key);
  }

  openLab() {
    this.sound.unlock();
    this.sound.click();
    if (this.phase !== "title") return;
    this.labScene ??= new LabScene(this.graphics.environment);
    this.labForm = 0;
    this.labScene.show(FORMS[this.labForm].id, this.save.skin, this.save.hat);
    this.phase = "lab";
    this.hud.showScreen("lab");
    this.openLabTab("hats");
  }

  openLabTab(tab) {
    this.sound.click();
    this.labTab = tab;
    this.labMenu.open(tab, { gems: this.save.gems, items: this.labItems(tab) });
  }

  labItems(tab) {
    const save = this.save;
    if (tab === "hats") {
      const gecko = formById("gecko");
      const bare = { id: null, cost: 0, owned: true, equipped: save.hat === null, image: this.portraits.gecko };
      return [bare, ...HATS.map((hat) => ({
        id: hat.id,
        cost: hat.cost,
        owned: save.owned.hats.includes(hat.id),
        equipped: save.hat === hat.id,
        image: this.thumb(`hat-${hat.id}`, () => createHat(hat.id), { yaw: 0.5, lift: 0.6, fill: 0.7 }),
      }))].map((item) => ({ ...item, form: gecko }));
    }
    if (tab === "skins") {
      return SKIN_LIST.map((skin) => ({
        id: skin.id,
        cost: skin.cost,
        owned: save.owned.skins.includes(skin.id),
        equipped: save.skin === skin.id,
        image: this.thumb(`skin-${skin.id}`, () => new LizardModel(formById("gecko"), SKINS[skin.id]).group),
      }));
    }
    if (tab === "upgrades") {
      return UPGRADES.map((upgrade) => {
        const level = save.upgrades[upgrade.id] ?? 0;
        return { id: upgrade.id, icon: upgrade.icon, level, maxLevel: upgrade.costs.length, cost: upgrade.costs[level] ?? 0, owned: level >= upgrade.costs.length };
      });
    }
    return ["cat", "dog", "horse"].map((kind) => ({
      id: kind,
      owned: true,
      locked: !save.stickers[kind],
      equipped: save.buddy === kind,
      image: this.thumb(`buddy-${kind}`, () => createBuddyModel(kind).group, { yaw: 0.6 }),
    }));
  }

  pickLabItem(tab, item, card) {
    // One choice at a time: ignore taps until the grid redraws with the new state.
    if (this.labBusy) return;
    const save = this.save;
    const buy = (cost) => {
      if (save.gems < cost) {
        this.labMenu.feedback(card, "poor");
        this.sound.boing();
        return false;
      }
      save.gems -= cost;
      this.labMenu.feedback(card, "bought");
      this.sound.escape();
      return true;
    };
    if (tab === "hats" || tab === "skins") {
      const ownedList = tab === "hats" ? save.owned.hats : save.owned.skins;
      if (item.id !== null && !ownedList.includes(item.id)) {
        if (!buy(item.cost)) return;
        ownedList.push(item.id);
      } else {
        this.sound.click();
      }
      if (tab === "hats") save.hat = item.id;
      else save.skin = item.id;
      this.labScene.show(FORMS[this.labForm].id, save.skin, save.hat);
      this.labScene.cheer();
    } else if (tab === "upgrades") {
      const upgrade = UPGRADES.find((entry) => entry.id === item.id);
      const level = save.upgrades[item.id] ?? 0;
      if (level >= upgrade.costs.length) return;
      if (!buy(upgrade.costs[level])) return;
      save.upgrades[item.id] = level + 1;
      this.labScene.cheer();
    } else {
      if (item.locked) {
        this.labMenu.feedback(card, "poor");
        this.sound.boing();
        return;
      }
      // Tapping the chosen buddy again leaves it at home.
      save.buddy = save.buddy === item.id ? null : item.id;
      this.sound.click();
      this.labScene.cheer();
    }
    writeSave(save);
    this.labChanged = true;
    this.labBusy = true;
    window.setTimeout(() => {
      this.labBusy = false;
      if (this.phase === "lab") this.labMenu.open(this.labTab, { gems: save.gems, items: this.labItems(this.labTab) });
    }, 450);
  }

  // Preview the outfit on the forms the player has reached.
  cycleLabForm(step) {
    const reached = Math.max(1, Math.min(FORMS.length, this.save.bestStage + 1, this.save.wins > 0 ? FORMS.length : 99));
    this.labForm = (this.labForm + step + reached) % reached;
    this.labScene.show(FORMS[this.labForm].id, this.save.skin, this.save.hat);
    this.labScene.cheer();
    this.sound.click();
  }

  openBook() {
    this.sound.unlock();
    this.sound.click();
    if (this.phase !== "title") return;
    const stickers = this.save.stickers;
    const list = [];
    FORMS.forEach((form, index) => list.push({ id: form.id, image: this.portraits[form.id], collected: index <= this.save.bestStage }));
    for (const kind of ["cat", "dog", "horse"]) {
      list.push({ id: kind, image: this.thumb(`buddy-${kind}`, () => createBuddyModel(kind).group, { yaw: 0.6 }), collected: Boolean(stickers[kind]) });
    }
    for (const kind of CRITTER_KINDS) {
      list.push({ id: kind, image: this.thumb(`critter-${kind}`, () => createCritterModel(kind, { glow: false }).group, { yaw: 0.7 }), collected: Boolean(stickers[kind]), gold: Boolean(stickers[`${kind}-gold`]) });
    }
    list.push({ id: "trophy", image: trophyImage(), collected: Boolean(stickers.trophy) });
    this.book.open(list);
    this.phase = "book";
    this.hud.showScreen("book");
  }

  async closeOverlay() {
    this.sound.click();
    if (!this.labChanged) {
      this.enterTitle();
      return;
    }
    // Purchases change the skin, hat, hearts, and buddy: rebuild the stage with them.
    this.labChanged = false;
    this.portraits = renderFormPortraits(this.thumbnailer, this.skin);
    this.perks = startingPerks(this.save);
    await this.loadStage(Math.min(this.save.stage, STAGES.length - 1));
    this.enterTitle();
  }

  // ---------- pause & settings ----------

  pause() {
    if (this.phase !== "playing" && this.phase !== "caught" && this.phase !== "intro") return;
    this.pausedPhase = this.phase;
    this.phase = "paused";
    writeSave(this.save);
    this.hud.showScreen("paused");
    this.input.clear();
    this.sound.setLoop("fire", false);
    this.sound.setLoop("water", false);
    this.music.stop();
  }

  resume() {
    if (this.phase !== "paused") return;
    this.sound.click();
    this.phase = this.pausedPhase;
    this.hud.showScreen("playing");
    this.music.play(this.stageTheme());
  }

  async home() {
    this.sound.click();
    this.perks = startingPerks(this.save);
    this.graphics.finish.uniforms.uFlash.value = 0;
    await this.loadStage(Math.min(this.save.stage, STAGES.length - 1));
    this.enterTitle();
  }

  toggleSound() {
    this.sound.unlock();
    this.save.muted = !this.save.muted;
    this.sound.setMuted(this.save.muted);
    this.hud.setSound(!this.save.muted);
    writeSave(this.save);
    this.sound.click();
  }

  // ---------- HUD and tutorial ----------

  updateHud() {
    if (this.domeHideAt && this.time > this.domeHideAt) {
      this.domeHideAt = 0;
      if (this.phase !== "caught" && this.phase !== "captured") this.netDome.group.visible = false;
    }
    if (this.bossMode) this.hud.setGrowth(this.catcher.health);
    else this.hud.setGrowth(this.growth / this.stage.growthTarget);
    const { breath } = this;
    this.hud.setEnergy(breath.energy.fire, breath.energy.water, breath.canStart("fire") || breath.active === "fire", breath.canStart("water") || breath.active === "water");
    this.updateCatcherArrow();
  }

  updateCatcherArrow() {
    const catcher = this.catcher;
    if (!catcher.active || this.phase !== "playing") {
      this.hud.setCatcherArrow(false);
      return;
    }
    this.temp.copy(catcher.aimPoint).setY(1);
    this.project(this.temp);
    if (this.screen.onScreen) {
      this.hud.setCatcherArrow(false);
      return;
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    const cx = width / 2;
    const cy = height / 2;
    let dx = this.screen.x - cx;
    let dy = this.screen.y - cy;
    if (this.screen.behind) {
      dx = -dx;
      dy = -dy;
    }
    const margin = Math.min(width, height) * 0.09;
    const scale = Math.min((cx - margin) / Math.max(Math.abs(dx), 1), (cy - margin) / Math.max(Math.abs(dy), 1));
    this.hud.setCatcherArrow(true, cx + dx * scale, cy + dy * scale, Math.atan2(dy, dx) + Math.PI / 2);
  }

  updateTutorial(dt) {
    if (this.waterHint > 0) {
      this.waterHint -= dt;
      this.hud.hintButton("water", this.waterHint > 0);
      const bud = this.flowers.list.find((flower) => !flower.done);
      if (bud && this.waterHint > 0) {
        this.project(bud.position);
        this.hud.setTarget(this.screen.onScreen, this.screen.x, this.screen.y);
      } else {
        this.hud.setTarget(false);
      }
    }
    const step = this.tutorialStep;
    if (step === "move") {
      this.hud.setFinger("drag");
      if (this.movedDistance > 2.5) this.tutorialStep = "eat";
    } else if (step === "eat") {
      this.hud.setFinger(null);
      const critter = this.critters.nearest(this.player.position.x, this.player.position.z, 14);
      if (critter) {
        this.project(critter.position);
        this.hud.setTarget(this.screen.onScreen, this.screen.x, this.screen.y);
      } else {
        this.hud.setTarget(false);
      }
    } else if (step === "wait-catcher") {
      this.hud.setTarget(false);
      if (this.catcher.active && !this.catcher.stunned && this.player.position.distanceTo(this.catcher.position) < 9) this.tutorialStep = "fire";
    } else if (step === "fire") {
      this.fireHintTime += dt;
      this.hud.hintButton("fire", true);
      if (this.fireHintTime > 7) this.tutorialStep = "done";
    }
    if (this.tutorialStep === "done" && step !== "done") {
      this.hud.hintButton("fire", false);
      this.hud.setFinger(null);
      this.hud.setTarget(false);
      this.save.tutorialDone = true;
      writeSave(this.save);
    }
  }

  // World point → CSS pixels. Sets this.screen.{x, y, onScreen, behind}.
  project(point) {
    const v = this.temp.copy(point).project(this.camera);
    this.screen.behind = v.z > 1;
    this.screen.x = (v.x * 0.5 + 0.5) * window.innerWidth;
    this.screen.y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    this.screen.onScreen = !this.screen.behind && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.88;
    return this.screen;
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.graphics.resize(width, height);
    this.particles?.resize(this.graphics.renderer.domElement.height, this.camera.fov);
  }

  // ---------- debug hooks (?debug=1) ----------

  snapshot() {
    return {
      phase: this.phase,
      stage: this.stage?.id,
      stageIndex: this.stageIndex,
      form: this.player?.form.id,
      growth: this.growth,
      growthTarget: this.stage?.growthTarget,
      hearts: this.hearts,
      gems: this.save.gems,
      bossMode: this.bossMode,
      bossHealth: this.bossMode ? this.catcher.health : null,
      mega: this.megaMeter,
      player: { x: this.player?.position.x, z: this.player?.position.z, scale: this.player?.scale },
      catcher: { state: this.catcher?.state, x: this.catcher?.aimPoint.x, z: this.catcher?.aimPoint.z },
      critters: this.critters?.list.length,
      cages: this.buddies?.cages.map((cage) => ({ kind: cage.kind, freed: cage.freed, x: cage.position.x, z: cage.position.z })),
      buddies: this.buddies?.buddies.map((buddy) => buddy.kind),
      flowers: this.flowers?.list.filter((flower) => !flower.done).length,
      render: { calls: this.graphics.renderer.info.render.calls, triangles: this.graphics.renderer.info.render.triangles, ...this.graphics.stats() },
      smashables: this.smash?.remaining.length,
    };
  }
}
