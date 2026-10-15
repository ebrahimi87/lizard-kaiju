"""Write the catalog, CC0 license section, and handoff report from the manifest."""
import collections
import json
import pathlib

REPO = pathlib.Path(__file__).resolve().parents[2]
OUT = REPO / 'assets/models'
manifest = json.loads((OUT / 'manifest.json').read_text())
validation = json.loads((REPO / '.artifacts/asset-validation.json').read_text())
counts = collections.Counter(entry['path'].split('/')[0] for entry in manifest)
total = sum(entry['sizeBytes'] for entry in manifest)
lines = [
    '# Lizard Kaiju — CC0 model catalog',
    '',
    f'{len(manifest)} self-contained GLB files; {total:,} bytes ({total / 1_000_000:.2f} MB). All models were loaded and visually checked in Three.js 0.180 Chromium previews.',
    '',
    '## Loading and scale',
    '',
    '- File paths below are relative to `assets/models/`. `manifest.json` has the same metadata for code.',
    '- Y is up. Forward-facing actors and vehicles use +Z. Static scenery has no required forward direction. Bases sit at Y=0; X/Z are centered on the rest-pose bounds.',
    '- Heights are measured delivered rest-pose heights, in game meters. They are chosen scale conventions, not author-certified real-world dimensions. Animated feet may lift off the ground.',
    '- Nature pack uses scale 2; city packs use scale 6. Road tiles are 6 × 6 m. Characters, animals, vehicles, and creatures use explicit heights in the manifest.',
    '- Clip names are shortened by removing repeated armature prefixes. Duplicate dog/horse clips are removed. `Gallop` is the dog/horse run clip; the yellow robot uses `Running` and `Walking`.',
    '- Textures are embedded PNGs, at most 1024 px. No Draco, meshopt, or external image requests are required.',
    '- Older Kenney nature display-color factors were converted to linear values; foliage was recolored green. Volcano stone is charcoal. Helicopter body is blue/orange. Materials are nonmetallic and rough for a toy finish.',
    '- Clone a model material before recoloring. Clone skinned actors with `SkeletonUtils.clone`, not `Object3D.clone`.',
    '',
    '## Recommended choices and limits',
    '',
    '- Best buddies: `animals/cat_round.glb` (round, orange, very cute), `animals/dog_shiba.glb`, and `animals/horse.glb`. Round cat has Walk but no Run; `animals/cat.glb` has both.',
    '- Best catcher: `characters/catcher_farmer.glb`, with a brimmed hat. Both humans have Idle, Walk, Run, Interact, and punch clips.',
    '- Best boss: `vehicles/boss_robot.glb`, a yellow round-headed robot. `boss_mech.glb` is a bulkier green alternative with ranged attack clips.',
    '- Nature kit is cohesive, bright, and inexpensive. The fern uses a more detailed leaf texture and is the main style outlier. Spider and frog look less friendly than the round cat.',
    '- No suitable verified CC0 butterfly or cricket was found. Use bee/ladybird and spider as temporary bug fallbacks. Mouse uses an animated rat. SUV is the jeep fallback.',
    '- Swamp leaf grass is a reed fallback. Use stumps/logs for dead-tree scenery. No full dead tree, dedicated wooden cage, net, or lava texture is included. Cage is metal; boxes and fence pieces are the wooden alternatives.',
    '- Helicopter has a static rotor; the rotor is not a separate animated clip. Dragon has flying clips, not idle/walk/run on the ground.',
    '- Ladybird has 8662 triangles: use sparingly, or instance it for crowds. It is the most expensive tiny static bug.',
    '',
    '## Files',
    '',
    '| Path | What it is | Source pack/model | Source license URL (CC0) | Animation clips | Triangles | Bytes | Height (m) | Notes |',
    '|---|---|---|---|---|---:|---:|---:|---|',
]
for entry in manifest:
    clips = ', '.join(entry['animations']) or '—'
    note = entry['notes'] or '—'
    lines.append(f"| `{entry['path']}` | {entry['name']} | {entry['pack']} | {entry['licenseUrl']} | {clips} | {entry['triangles']} | {entry['sizeBytes']} | {entry['heightMeters']:.3f} | {note} |")
(OUT / 'CATALOG.md').write_text('\n'.join(lines) + '\n')

sources = sorted({(entry['pack'], entry['licenseUrl']) for entry in manifest})
section = [
    '\nCC0 3D MODEL ASSETS — Lizard Kaiju',
    'All entries below are CC0 1.0 Universal / public domain.',
    'License text: https://creativecommons.org/publicdomain/zero/1.0/',
    'Source-page licenses checked on 2026-10-14. Kenney pack pages state Creative Commons CC0; each Poly Pizza model page states Public Domain (CC0).',
    'Kenney pack author: Kenney (https://kenney.nl/). Other authors are identified in each entry below.',
    'Models were selected, embedded, rescaled, recolored, and clip names shortened. Crab skin weights were repaired. No source download scripts were executed.',
    '',
]
section += [f'{pack}\n  Source and license evidence: {url}\n  License: CC0 1.0 Universal' for pack, url in sources]
section += [
    '',
    'Related original Quaternius pack pages (CC0; Google Drive data downloads were quota-limited, so the individual Poly Pizza mirrors above were used):',
    'https://quaternius.com/packs/ultimateanimatedanimals.html',
    'https://quaternius.com/packs/ultimatedanimatedcharacter.html',
    'https://quaternius.com/packs/animateddinosaurs.html',
    'https://quaternius.com/packs/animatedrobot.html',
    'https://quaternius.com/packs/ultimatemonsters.html',
]
license_path = REPO / 'THIRD_PARTY_LICENSES.txt'
if not license_path.exists():
    license_path.write_text('THREE.JS — MIT\nSource: https://github.com/mrdoob/three.js\n\n' + (REPO / 'vendor/three.LICENSE.txt').read_text())
if 'CC0 3D MODEL ASSETS — Lizard Kaiju' not in license_path.read_text():
    with license_path.open('a') as stream:
        stream.write('\n'.join(section) + '\n')

report = [
    '# CC0 asset-library handoff',
    '',
    f'Delivered **{len(manifest)} GLBs, {total / 1_000_000:.2f} MB**, inside `assets/models/`. Catalog: `assets/models/CATALOG.md`. Code metadata: `assets/models/manifest.json`. License record: `THIRD_PARTY_LICENSES.txt`.',
    '',
    '| Folder | Models | Main contents |',
    '|---|---:|---|',
]
contents = {
    'garden': 'Grass, flowers, bushes, mushrooms, pots, fences, logs, stumps, stepping stones',
    'nature': 'Trees and rocks shared across biomes',
    'jungle': 'Palms, bamboo, big leaves, fern',
    'swamp': 'Lily pads, dark trees, stump, reed fallback',
    'volcano': 'Charcoal cliffs and rocks',
    'city': '6 homes, 6 commercial buildings, roads, trees, planter, lights, traffic light, dumpster',
    'vehicles': 'SUV/jeep fallback, sedan, taxi, helicopter, two animated bosses',
    'characters': 'Two fully animated humans; farmer includes hat',
    'animals': 'Two cats, Shiba dog, horse; all animated',
    'critters': 'Frog, rat/mouse, chicken, crab, fish, ladybird, bee, spider',
    'creatures': 'Animated T-Rex, velociraptor, flying dragon',
    'props': 'Closed/open box, animated chest, barrel, bucket, gem, crystals, metal cage',
}
report += [f'| `assets/models/{category}/` | {counts[category]} | {description} |' for category, description in contents.items()]
report += [
    '',
    '## Visual picks',
    '',
    '**Best:** round orange cat, Shiba, hat-wearing farmer, yellow boss robot, recolored green nature props. **Less cohesive:** textured fern. **Least friendly:** red-eyed frog and spider. Dinosaur shapes are good Plan-B bases but need brighter hero colors.',
    '',
    '## Unfilled needs and fallbacks',
    '',
    '- Butterfly and cricket: no suitable verified CC0 model found; use bee/ladybird and spider temporarily.',
    '- Exact jeep: SUV. Mouse: animated rat. Reeds: leaf grass. Full dead tree: stumps/logs.',
    '- Wooden cage: metal cage, or assemble supplied wooden fence pieces. No catcher net supplied.',
    '- Helicopter is static; rotor motion needs code/model separation. Dragon only has flying actions.',
    '- No lava texture. Supplied volcano rocks already use a dark tint.',
    '',
    '## Verification',
    '',
    f"- {len(manifest)} GLBs loaded in Chromium using the project GLTFLoader. No failed asset requests or browser errors.",
    f"- {sum(len(stat['checks']) for stat in validation['stats'])} animation clips tested at two times; all change model transforms. Mid-animation sheets were viewed.",
    '- Every delivered GLB has finite float data, embedded images, no required decoder extension, textures ≤1024 px, and a rest-pose base at Y=0.',
    '- Fixed six invalid crab skin-weight vertices. All files are covered by the catalog and manifest.',
    '- All source pages explicitly state CC0. No license doubts remain for included files. CC-BY results were rejected.',
    '- Quaternius Drive downloads failed due public quota limits. Direct native GLB mirrors retained animations, so Blender conversion was not needed.',
    '- This is asset validation, not an iPad performance test or a full game test.',
    '',
    '## Contact sheets',
    '',
]
report += [f'- `.artifacts/asset-sheets/{category}.png`' for category in counts]
report += [
    '- Additional second-frame sheets: `animals-motion.png`, `critters-motion.png`, `characters-motion.png`, `vehicles-motion.png`, `creatures-motion.png`, `props-motion.png` in the same folder.',
    '- Preview: `http://127.0.0.1:4173/tools/assets/preview.html?category=garden` (change category as needed).',
    '',
    '## Repeat validation',
    '',
    '```sh',
    'node tests/helpers/static-server.mjs',
    '# In another terminal:',
    'node tools/assets/capture.mjs',
    'python3 -I tools/assets/validate_library.py',
    '```',
    '',
    'Rebuild: `prepare_library.py` → `capture.mjs --measure` → `normalize_library.py` → `capture.mjs` → `catalog_library.py` → `validate_library.py`. All Python commands must use `python3 -I`. Downloads remain isolated outside the repo. No commits were made.',
]
(OUT / 'DELIVERY.md').write_text('\n'.join(report) + '\n')
print('Catalog, licenses, and delivery report written')
