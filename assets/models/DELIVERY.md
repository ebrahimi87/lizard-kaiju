# CC0 asset-library handoff

Delivered **123 GLBs, 13.88 MB**, inside `assets/models/`. Catalog: `assets/models/CATALOG.md`. Code metadata: `assets/models/manifest.json`. License record: `THIRD_PARTY_LICENSES.txt`.

| Folder | Models | Main contents |
|---|---:|---|
| `assets/models/garden/` | 31 | Grass, flowers, bushes, mushrooms, pots, fences, logs, stumps, stepping stones |
| `assets/models/nature/` | 15 | Trees and rocks shared across biomes |
| `assets/models/jungle/` | 11 | Palms, bamboo, big leaves, fern |
| `assets/models/swamp/` | 6 | Lily pads, dark trees, stump, reed fallback |
| `assets/models/volcano/` | 4 | Charcoal cliffs and rocks |
| `assets/models/city/` | 25 | 6 homes, 6 commercial buildings, roads, trees, planter, lights, traffic light, dumpster |
| `assets/models/vehicles/` | 6 | SUV/jeep fallback, sedan, taxi, helicopter, two animated bosses |
| `assets/models/characters/` | 2 | Two fully animated humans; farmer includes hat |
| `assets/models/animals/` | 4 | Two cats, Shiba dog, horse; all animated |
| `assets/models/critters/` | 8 | Frog, rat/mouse, chicken, crab, fish, ladybird, bee, spider |
| `assets/models/creatures/` | 3 | Animated T-Rex, velociraptor, flying dragon |
| `assets/models/props/` | 8 | Closed/open box, animated chest, barrel, bucket, gem, crystals, metal cage |

## Visual picks

**Best:** round orange cat, Shiba, hat-wearing farmer, yellow boss robot, recolored green nature props. **Less cohesive:** textured fern. **Least friendly:** red-eyed frog and spider. Dinosaur shapes are good Plan-B bases but need brighter hero colors.

## Unfilled needs and fallbacks

- Butterfly and cricket: no suitable verified CC0 model found; use bee/ladybird and spider temporarily.
- Exact jeep: SUV. Mouse: animated rat. Reeds: leaf grass. Full dead tree: stumps/logs.
- Wooden cage: metal cage, or assemble supplied wooden fence pieces. No catcher net supplied.
- Helicopter is static; rotor motion needs code/model separation. Dragon only has flying actions.
- No lava texture. Supplied volcano rocks already use a dark tint.

## Verification

- 123 GLBs loaded in Chromium using the project GLTFLoader. No failed asset requests or browser errors.
- 172 animation clips tested at two times; all change model transforms. Mid-animation sheets were viewed.
- Every delivered GLB has finite float data, embedded images, no required decoder extension, textures ≤1024 px, and a rest-pose base at Y=0.
- Fixed six invalid crab skin-weight vertices. All files are covered by the catalog and manifest.
- All source pages explicitly state CC0. No license doubts remain for included files. CC-BY results were rejected.
- Quaternius Drive downloads failed due public quota limits. Direct native GLB mirrors retained animations, so Blender conversion was not needed.
- This is asset validation, not an iPad performance test or a full game test.

## Contact sheets

- `.artifacts/asset-sheets/garden.png`
- `.artifacts/asset-sheets/nature.png`
- `.artifacts/asset-sheets/jungle.png`
- `.artifacts/asset-sheets/swamp.png`
- `.artifacts/asset-sheets/volcano.png`
- `.artifacts/asset-sheets/city.png`
- `.artifacts/asset-sheets/vehicles.png`
- `.artifacts/asset-sheets/props.png`
- `.artifacts/asset-sheets/animals.png`
- `.artifacts/asset-sheets/critters.png`
- `.artifacts/asset-sheets/characters.png`
- `.artifacts/asset-sheets/creatures.png`
- Additional second-frame sheets: `animals-motion.png`, `critters-motion.png`, `characters-motion.png`, `vehicles-motion.png`, `creatures-motion.png`, `props-motion.png` in the same folder.
- Preview: `http://127.0.0.1:4173/tools/assets/preview.html?category=garden` (change category as needed).

## Repeat validation

```sh
node tests/helpers/static-server.mjs
# In another terminal:
node tools/assets/capture.mjs
python3 -I tools/assets/validate_library.py
```

Rebuild: `prepare_library.py` → `capture.mjs --measure` → `normalize_library.py` → `capture.mjs` → `catalog_library.py` → `validate_library.py`. All Python commands must use `python3 -I`. Downloads remain isolated outside the repo. No commits were made.
