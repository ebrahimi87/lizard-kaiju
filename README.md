# Lizard Kaiju

A 3D browser game for iPad (and desktop). A tiny red gecko hunts bugs, runs from a goofy lizard catcher, and evolves five times — gecko → frilled lizard → komodo dragon → dino-lizard → giant kaiju — then beats the catcher's giant robot. Made for young players who can't read yet: every instruction is a picture, motion, or sound.

Play: open `index.html` from any static web server (GitHub Pages works as is). On iPad, use **Share → Add to Home Screen** for full-screen play.

## How to play

| Control | iPad | Keyboard |
|---|---|---|
| Move | drag anywhere on the left half | WASD / arrows |
| Fire breath (hold) | big red button | J |
| Water breath (hold, from stage 2) | blue button | K |
| MEGA beam (kaiju, when it glows) | gold button | Space |
| Wriggle out of a net | tap fast anywhere | any key |

- Touch critters to eat them; the bar at the top fills, and a full bar means **evolve**.
- A **red circle** (or red lane) on the ground means the catcher is about to strike: move!
- Fire gives the catcher hot pants; water makes him slip. Fire also opens cages (free a cat, dog, or horse buddy), cracks mystery eggs, and smashes city buildings. Water makes flower buds bloom (gems and hearts).
- After each evolution, pick one of three picture power cards.
- Between runs: the **Lizard Lab** (hat button) sells hats, colors, upgrades, and lets you take a buddy along; the **book** shows collected stickers; winning unlocks the **endless city** (purple button).

## Run and test locally

```sh
npm install                       # Playwright for tests and screenshots
npm run serve                     # http://127.0.0.1:4173
npm run validate                  # syntax + logic tests + browser tests (software WebGL; slow)
npm run playtest                  # scripted stage-1 playthrough → .artifacts/playtest/*.png
npm run tour                      # every stage: start, attack warning, fire → .artifacts/tour/*.png
```

`?debug=1` exposes `window.__LIZARD_KAIJU__` (`jump(stage)`, `step(seconds, input)`, `snapshot()`, `addGrowth(n)`). `lab.html` shows art views: `?view=lineup|hero|play`, and `?app=critters|catcher|biomes|cosmetics|audio|icon`.

## How the code fits together

```
main.js ── boots Hud, InputController, Sound ──► Game
Game (phases: title, lab, book, playing, intro, caught, captured, evolving, cards, victory)
 ├─ loadStage(i): buildWorld (sky, ground, grass, biome props) + Player + CritterSystem
 │                + createCatcher(gear) + BuddySystem + FlowerSystem + SmashSystem + MysteryEgg
 ├─ updatePlaying(dt, input)
 │    ├─ Breath.update → applyBreath (critters, catcher, cages, flowers, buildings, egg)
 │    ├─ Player.update → LizardModel.update (procedural spine, legs, head)
 │    ├─ CritterSystem.update / tryEat → reward (growth, gems, flying gem icons)
 │    ├─ catcher.update → "caught" | "hit" | "defeated" → caught / takeHit / victory
 │    └─ growth full → startEvolving → cards → next stage
 └─ render: Renderer (bloom, tone mapping, vignette) via FollowCamera
```

| Folder | What lives there |
|---|---|
| `src/config/` | All tuning: `stages.js` (speeds, timings, critters, catcher gear), `forms.js` (lizard shapes, skins), `biomes.js` (colors and light), `cards.js`, `upgrades.js`, `cosmetics.js` |
| `src/actors/` | Lizard (procedural model, hats), player movement, critters and buddies, catchers (on foot, jeep, helicopter, robot boss) |
| `src/world/` | Biome builders, ground and grass shaders, CC0 model loading, flowers, smashing, mystery egg |
| `src/fx/` | Particles, fire/water breath, MEGA beam |
| `src/ui/` | HUD (DOM), Lizard Lab shop, sticker book |
| `src/audio/` | Synthesized sound effects and music (no audio files) |
| `assets/models/` | CC0 3D models (Kenney, Quaternius, Poly Pizza) — see `CATALOG.md` |

To tune difficulty, edit `src/config/stages.js`: the catcher's `speed`/`maxSpeed`, attack timings (`windup`, `shotAim`, `chargeAim`, `dropAim`, `punchWindup`), `growthTarget`, `hearts`, and `escapeTaps`.

## Credits

Three.js (MIT). 3D models are CC0 from Kenney, Quaternius, and Poly Pizza creators — see `THIRD_PARTY_LICENSES.txt` and `assets/models/CATALOG.md`. The lizard, critters, buddies, catcher, hats, music, and sounds are original procedural code made for this game.
