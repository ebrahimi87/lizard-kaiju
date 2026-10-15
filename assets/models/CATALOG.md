# Lizard Kaiju — CC0 model catalog

123 self-contained GLB files; 13,881,928 bytes (13.88 MB). All models were loaded and visually checked in Three.js 0.180 Chromium previews.

## Loading and scale

- File paths below are relative to `assets/models/`. `manifest.json` has the same metadata for code.
- Y is up. Forward-facing actors and vehicles use +Z. Static scenery has no required forward direction. Bases sit at Y=0; X/Z are centered on the rest-pose bounds.
- Heights are measured delivered rest-pose heights, in game meters. They are chosen scale conventions, not author-certified real-world dimensions. Animated feet may lift off the ground.
- Nature pack uses scale 2; city packs use scale 6. Road tiles are 6 × 6 m. Characters, animals, vehicles, and creatures use explicit heights in the manifest.
- Clip names are shortened by removing repeated armature prefixes. Duplicate dog/horse clips are removed. `Gallop` is the dog/horse run clip; the yellow robot uses `Running` and `Walking`.
- Textures are embedded PNGs, at most 1024 px. No Draco, meshopt, or external image requests are required.
- Older Kenney nature display-color factors were converted to linear values; foliage was recolored green. Volcano stone is charcoal. Helicopter body is blue/orange. Materials are nonmetallic and rough for a toy finish.
- Clone a model material before recoloring. Clone skinned actors with `SkeletonUtils.clone`, not `Object3D.clone`.

## Recommended choices and limits

- Best buddies: `animals/cat_round.glb` (round, orange, very cute), `animals/dog_shiba.glb`, and `animals/horse.glb`. Round cat has Walk but no Run; `animals/cat.glb` has both.
- Best catcher: `characters/catcher_farmer.glb`, with a brimmed hat. Both humans have Idle, Walk, Run, Interact, and punch clips.
- Best boss: `vehicles/boss_robot.glb`, a yellow round-headed robot. `boss_mech.glb` is a bulkier green alternative with ranged attack clips.
- Nature kit is cohesive, bright, and inexpensive. The fern uses a more detailed leaf texture and is the main style outlier. Spider and frog look less friendly than the round cat.
- No suitable verified CC0 butterfly or cricket was found. Use bee/ladybird and spider as temporary bug fallbacks. Mouse uses an animated rat. SUV is the jeep fallback.
- Swamp leaf grass is a reed fallback. Use stumps/logs for dead-tree scenery. No full dead tree, dedicated wooden cage, net, or lava texture is included. Cage is metal; boxes and fence pieces are the wooden alternatives.
- Helicopter has a static rotor; the rotor is not a separate animated clip. Dragon has flying clips, not idle/walk/run on the ground.
- Ladybird has 8662 triangles: use sparingly, or instance it for crowds. It is the most expensive tiny static bug.

## Files

| Path | What it is | Source pack/model | Source license URL (CC0) | Animation clips | Triangles | Bytes | Height (m) | Notes |
|---|---|---|---|---|---:|---:|---:|---|
| `garden/grass.glb` | grass | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 132 | 11664 | 0.508 | — |
| `garden/grass_large.glb` | grass large | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 224 | 18672 | 0.508 | — |
| `garden/grass_leafs.glb` | grass leafs | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 36 | 4792 | 0.285 | — |
| `garden/grass_leafs_large.glb` | grass leafs large | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 144 | 14172 | 0.285 | — |
| `garden/flower_red_a.glb` | flower red a | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 76 | 7288 | 0.585 | — |
| `garden/flower_red_b.glb` | flower red b | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 98 | 8260 | 0.517 | — |
| `garden/flower_yellow_a.glb` | flower yellow a | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 76 | 7296 | 0.385 | — |
| `garden/flower_yellow_b.glb` | flower yellow b | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 154 | 11432 | 0.317 | — |
| `garden/flower_purple_a.glb` | flower purple a | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 76 | 7284 | 0.485 | — |
| `garden/flower_purple_b.glb` | flower purple b | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 98 | 8252 | 0.417 | — |
| `garden/plant_bush_small.glb` | plant bush small | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 16 | 3344 | 0.415 | — |
| `garden/plant_bush.glb` | plant bush | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 32 | 4528 | 0.489 | — |
| `garden/plant_bush_large.glb` | plant bush large | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 60 | 6588 | 0.486 | — |
| `garden/plant_bush_detailed.glb` | plant bush detailed | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 104 | 10308 | 0.721 | — |
| `garden/mushroom_red.glb` | mushroom red | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 48 | 6548 | 0.406 | — |
| `garden/mushroom_red_group.glb` | mushroom red group | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 144 | 15140 | 0.501 | — |
| `garden/mushroom_tan.glb` | mushroom tan | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 48 | 5976 | 0.308 | — |
| `garden/mushroom_tan_tall.glb` | mushroom tan tall | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 48 | 6672 | 0.501 | — |
| `garden/pot_small.glb` | pot small | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 72 | 7176 | 0.536 | — |
| `garden/pot_large.glb` | pot large | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 68 | 6332 | 0.400 | — |
| `garden/fence_planks.glb` | fence planks | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 96 | 7860 | 0.690 | — |
| `garden/fence_planks_double.glb` | fence planks double | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 152 | 11304 | 0.690 | — |
| `garden/fence_gate.glb` | fence gate | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 524 | 27848 | 0.690 | — |
| `garden/fence_simple.glb` | fence simple | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 64 | 5880 | 0.690 | — |
| `garden/log.glb` | log | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 200 | 14484 | 0.346 | — |
| `garden/log_large.glb` | log large | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 96 | 8120 | 0.833 | — |
| `garden/log_stack.glb` | log stack | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 184 | 11092 | 0.693 | — |
| `garden/stump_round.glb` | stump round | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 56 | 5804 | 0.413 | — |
| `garden/stump_round_detailed.glb` | stump round detailed | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 96 | 8364 | 0.413 | — |
| `garden/path_stone.glb` | path stone | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 136 | 12580 | 0.100 | — |
| `garden/path_stone_circle.glb` | path stone circle | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 164 | 13264 | 0.100 | — |
| `nature/tree_default.glb` | tree default | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 114 | 9596 | 3.416 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/tree_detailed.glb` | tree detailed | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 402 | 31620 | 2.665 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/tree_oak.glb` | tree oak | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 196 | 14828 | 2.452 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/tree_small.glb` | tree small | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 62 | 6664 | 2.220 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/tree_tall.glb` | tree tall | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 72 | 7168 | 3.375 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/rock_small_a.glb` | rock small a | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 16 | 3224 | 0.382 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/rock_small_b.glb` | rock small b | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 24 | 3708 | 0.354 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/rock_small_flat_a.glb` | rock small flat a | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 20 | 3464 | 0.130 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/rock_large_a.glb` | rock large a | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 80 | 7732 | 0.520 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/rock_large_b.glb` | rock large b | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 85 | 8748 | 0.861 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/rock_large_c.glb` | rock large c | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 72 | 7184 | 0.642 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/rock_tall_a.glb` | rock tall a | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 136 | 12244 | 1.992 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/stone_small_a.glb` | stone small a | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 16 | 2768 | 0.382 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/stone_small_flat_b.glb` | stone small flat b | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 16 | 2768 | 0.130 | Clone materials before tinting. Share geometry for repeated scenery. |
| `nature/stone_tall_a.glb` | stone tall a | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 136 | 11788 | 1.992 | Clone materials before tinting. Share geometry for repeated scenery. |
| `jungle/tree_palm.glb` | tree palm | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 186 | 13784 | 3.029 | — |
| `jungle/tree_palm_short.glb` | tree palm short | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 190 | 15800 | 2.112 | — |
| `jungle/tree_palm_tall.glb` | tree palm tall | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 190 | 15796 | 2.711 | — |
| `jungle/tree_palm_bend.glb` | tree palm bend | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 200 | 14988 | 2.760 | — |
| `jungle/tree_palm_detailed_short.glb` | tree palm detailed short | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 336 | 28412 | 2.248 | — |
| `jungle/tree_palm_detailed_tall.glb` | tree palm detailed tall | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 336 | 28408 | 2.847 | — |
| `jungle/plant_flat_short.glb` | plant flat short | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 44 | 4072 | 0.470 | — |
| `jungle/plant_flat_tall.glb` | plant flat tall | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 32 | 3616 | 0.569 | — |
| `jungle/crops_bamboo_stage_a.glb` | crops bamboo stage a | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 276 | 22260 | 1.098 | — |
| `jungle/crops_bamboo_stage_b.glb` | crops bamboo stage b | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 564 | 40308 | 1.780 | — |
| `swamp/swamp_lily_small.glb` | swamp lily small | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 52 | 5832 | 0.080 | Leaf grass is a reed fallback; lilies sit on the water surface. |
| `swamp/swamp_lily_large.glb` | swamp lily large | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 86 | 8244 | 0.196 | Leaf grass is a reed fallback; lilies sit on the water surface. |
| `swamp/swamp_tree_default_dark.glb` | swamp tree default dark | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 114 | 9608 | 3.416 | Leaf grass is a reed fallback; lilies sit on the water surface. |
| `swamp/swamp_tree_thin_dark.glb` | swamp tree thin dark | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 456 | 32692 | 2.981 | Leaf grass is a reed fallback; lilies sit on the water surface. |
| `swamp/swamp_stump_square_detailed.glb` | swamp stump square detailed | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 84 | 7704 | 0.400 | Leaf grass is a reed fallback; lilies sit on the water surface. |
| `swamp/swamp_grass_leafs.glb` | swamp grass leafs | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 36 | 4792 | 0.285 | Leaf grass is a reed fallback; lilies sit on the water surface. |
| `volcano/cliff_rock.glb` | cliff rock | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 32 | 3724 | 2.000 | Clone and tint stone materials charcoal for lava areas; no lava texture included. |
| `volcano/cliff_large_rock.glb` | cliff large rock | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 32 | 3712 | 2.000 | Clone and tint stone materials charcoal for lava areas; no lava texture included. |
| `volcano/rock_tall_c.glb` | rock tall c | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 37 | 5404 | 1.566 | Clone and tint stone materials charcoal for lava areas; no lava texture included. |
| `volcano/rock_large_d.glb` | rock large d | Kenney nature-kit | https://kenney.nl/assets/nature-kit | — | 80 | 8228 | 1.137 | Clone and tint stone materials charcoal for lava areas; no lava texture included. |
| `city/house_building_type_a.glb` | house building type a | Kenney city-kit-suburban | https://kenney.nl/assets/city-kit-suburban | — | 1174 | 110564 | 5.001 | — |
| `city/house_building_type_b.glb` | house building type b | Kenney city-kit-suburban | https://kenney.nl/assets/city-kit-suburban | — | 1748 | 158680 | 6.825 | — |
| `city/house_building_type_c.glb` | house building type c | Kenney city-kit-suburban | https://kenney.nl/assets/city-kit-suburban | — | 1196 | 111556 | 6.201 | — |
| `city/house_building_type_d.glb` | house building type d | Kenney city-kit-suburban | https://kenney.nl/assets/city-kit-suburban | — | 1757 | 159332 | 7.425 | — |
| `city/house_building_type_f.glb` | house building type f | Kenney city-kit-suburban | https://kenney.nl/assets/city-kit-suburban | — | 1616 | 150536 | 6.825 | — |
| `city/house_building_type_g.glb` | house building type g | Kenney city-kit-suburban | https://kenney.nl/assets/city-kit-suburban | — | 1067 | 105560 | 4.609 | — |
| `city/city_tree_small.glb` | city tree small | Kenney city-kit-suburban | https://kenney.nl/assets/city-kit-suburban | — | 42 | 17772 | 3.402 | — |
| `city/city_tree_large.glb` | city tree large | Kenney city-kit-suburban | https://kenney.nl/assets/city-kit-suburban | — | 42 | 17772 | 4.602 | — |
| `city/city_planter.glb` | city planter | Kenney city-kit-suburban | https://kenney.nl/assets/city-kit-suburban | — | 204 | 32344 | 1.063 | — |
| `city/city_path_stones_short.glb` | city path stones short | Kenney city-kit-suburban | https://kenney.nl/assets/city-kit-suburban | — | 24 | 16248 | 0.060 | — |
| `city/commercial_building_a.glb` | commercial building a | Kenney city-kit-commercial | https://kenney.nl/assets/city-kit-commercial | — | 1252 | 120160 | 7.758 | — |
| `city/commercial_building_b.glb` | commercial building b | Kenney city-kit-commercial | https://kenney.nl/assets/city-kit-commercial | — | 1276 | 117632 | 7.758 | — |
| `city/commercial_building_c.glb` | commercial building c | Kenney city-kit-commercial | https://kenney.nl/assets/city-kit-commercial | — | 1195 | 114012 | 5.358 | — |
| `city/commercial_building_f.glb` | commercial building f | Kenney city-kit-commercial | https://kenney.nl/assets/city-kit-commercial | — | 1794 | 160152 | 10.158 | — |
| `city/commercial_building_skyscraper_a.glb` | commercial building skyscraper a | Kenney city-kit-commercial | https://kenney.nl/assets/city-kit-commercial | — | 1292 | 122536 | 17.280 | — |
| `city/commercial_building_skyscraper_c.glb` | commercial building skyscraper c | Kenney city-kit-commercial | https://kenney.nl/assets/city-kit-commercial | — | 1704 | 160740 | 24.480 | — |
| `city/road_straight.glb` | road straight | Kenney city-kit-roads | https://kenney.nl/assets/city-kit-roads | — | 44 | 16860 | 0.120 | — |
| `city/road_bend.glb` | road bend | Kenney city-kit-roads | https://kenney.nl/assets/city-kit-roads | — | 260 | 31772 | 0.120 | — |
| `city/road_crossroad.glb` | road crossroad | Kenney city-kit-roads | https://kenney.nl/assets/city-kit-roads | — | 116 | 21696 | 0.120 | — |
| `city/road_intersection.glb` | road intersection | Kenney city-kit-roads | https://kenney.nl/assets/city-kit-roads | — | 84 | 19528 | 0.120 | — |
| `city/road_crossing.glb` | road crossing | Kenney city-kit-roads | https://kenney.nl/assets/city-kit-roads | — | 104 | 20312 | 0.120 | — |
| `city/light_curved.glb` | light curved | Kenney city-kit-roads | https://kenney.nl/assets/city-kit-roads | — | 92 | 21116 | 4.050 | — |
| `city/light_square.glb` | light square | Kenney city-kit-roads | https://kenney.nl/assets/city-kit-roads | — | 60 | 18620 | 3.600 | — |
| `city/traffic_light.glb` | traffic light | Kenney city-kit-roads | https://kenney.nl/assets/city-kit-roads | — | 212 | 31988 | 3.090 | — |
| `city/dumpster.glb` | dumpster | Kenney city-kit-roads | https://kenney.nl/assets/city-kit-roads | — | 234 | 36028 | 1.257 | — |
| `vehicles/suv.glb` | suv | Kenney car-kit | https://kenney.nl/assets/car-kit | — | 2474 | 220160 | 1.800 | Front faces +Z. SUV is the off-road jeep fallback. |
| `vehicles/sedan.glb` | sedan | Kenney car-kit | https://kenney.nl/assets/car-kit | — | 2032 | 184816 | 1.800 | Front faces +Z. SUV is the off-road jeep fallback. |
| `vehicles/taxi.glb` | taxi | Kenney car-kit | https://kenney.nl/assets/car-kit | — | 2072 | 188204 | 1.800 | Front faces +Z. SUV is the off-road jeep fallback. |
| `props/box.glb` | box | Kenney survival-kit | https://kenney.nl/assets/survival-kit | — | 124 | 21672 | 0.250 | Closed and open wooden box variants; chest has open/close clips. |
| `props/box_open.glb` | box open | Kenney survival-kit | https://kenney.nl/assets/survival-kit | — | 156 | 24672 | 0.306 | Closed and open wooden box variants; chest has open/close clips. |
| `props/chest.glb` | chest | Kenney survival-kit | https://kenney.nl/assets/survival-kit | open, close, open-close | 322 | 42808 | 0.257 | Closed and open wooden box variants; chest has open/close clips. |
| `props/barrel.glb` | barrel | Kenney survival-kit | https://kenney.nl/assets/survival-kit | — | 412 | 41868 | 0.344 | Closed and open wooden box variants; chest has open/close clips. |
| `props/bucket.glb` | bucket | Kenney survival-kit | https://kenney.nl/assets/survival-kit | — | 68 | 15432 | 0.192 | Closed and open wooden box variants; chest has open/close clips. |
| `props/gem_pink.glb` | gem pink | Quaternius — Gem Pink | https://poly.pizza/m/PJnKvWluqs | — | 44 | 13792 | 0.300 | — |
| `props/crystal_cluster.glb` | crystal cluster | Quaternius — Big Crystal | https://poly.pizza/m/pf5lzmgr2J | — | 590 | 33476 | 1.000 | — |
| `props/cage.glb` | cage | iPoly3D — Cage | https://poly.pizza/m/WcrsIHK2A3 | — | 612 | 52880 | 2.000 | Metal cage, not wooden; use box or fences for wooden cages. |
| `jungle/fern.glb` | fern | Quaternius — Fern | https://poly.pizza/m/jqcanvH7D6 | — | 288 | 692604 | 0.800 | — |
| `animals/cat.glb` | cat | Quaternius — Cat | https://poly.pizza/m/qKICY6xla2 | Death, Headbutt, Idle, Idle_Eating, Jump_Loop, Jump_Start, Run, Walk | 2448 | 235200 | 0.450 | Small pointed ears; animated quadruped. |
| `animals/cat_round.glb` | cat round | Quaternius — Cat | https://poly.pizza/m/2f54vbV0In | Bite_Front, Dance, Death, HitRecieve, Idle, Jump, No, Walk, Yes | 1772 | 108880 | 0.450 | Alternative cat with Idle and Walk; no Run clip. |
| `animals/dog_shiba.glb` | dog shiba | Quaternius — Shiba Inu | https://poly.pizza/m/y4wdQpg767 | Attack, Death, Eating, Gallop, Gallop_Jump, Idle_HitReact_Left, Idle_HitReact_Right, Jump_ToIdle, Walk, Idle_2_HeadLow, Idle_2, Idle | 1950 | 780504 | 0.650 | Cute Shiba Inu; Gallop is the run clip. |
| `animals/horse.glb` | horse | Quaternius — Horse | https://poly.pizza/m/qvTrSG9pZF | Attack_Headbutt, Attack_Kick, Death, Eating, Gallop_Jump, Gallop, Idle_HitReact_Left, Idle_HitReact_Right, Jump_toIdle, Walk, Idle_Headlow, Idle_2, Idle | 2182 | 1022380 | 1.800 | Gallop is the run clip. |
| `critters/frog.glb` | frog | Quaternius — Frog | https://poly.pizza/m/9Z2V8fpazF | Attack, Death, Idle, Jump | 4920 | 581732 | 0.300 | — |
| `critters/mouse_rat.glb` | mouse rat | Quaternius — Rat | https://poly.pizza/m/iltq5bVNaV | Attack, Death, Idle, Jump, Run, Walk | 4004 | 541700 | 0.250 | Rat used as mouse fallback. |
| `critters/chicken.glb` | chicken | Quaternius — Chicken | https://poly.pizza/m/Z3RCoCYss4 | Attack, Death, Idle, Idle_Peck, Run | 2140 | 170772 | 0.500 | — |
| `critters/crab.glb` | crab | Quaternius — Crab Enemy | https://poly.pizza/m/Gs3yfsV5lB | Bite_Front, Bite_InPlace, Dance, Death, HitRecieve, Idle, Jump, No, Walk, Yes | 3624 | 214256 | 0.300 |  Fixed six invalid skin-weight vertices by binding them to body. |
| `critters/fish.glb` | fish | Quaternius — Fish | https://poly.pizza/m/BEcU9rjiAq | Swim | 686 | 80568 | 0.250 | — |
| `critters/ladybird.glb` | ladybird | Exceptional_3D — Ladybird | https://poly.pizza/m/3tCnJC9UYA | — | 8662 | 803348 | 0.060 | Static ladybug; Exceptional_3D author. |
| `critters/bee.glb` | bee | Quaternius — Bee | https://poly.pizza/m/HvfIku26CK | — | 914 | 57400 | 0.080 | Static bee, fallback for butterfly. |
| `critters/spider.glb` | spider | Quaternius — Spider | https://poly.pizza/m/yRYJiAJyiM | Attack, Death, Idle, Jump, Walk | 2712 | 439760 | 0.150 | Animated; fallback for cricket/beetle. |
| `characters/catcher_casual.glb` | catcher casual | Quaternius — Casual Character | https://poly.pizza/m/kZ3DmIoGip | Death, Gun_Shoot, HitRecieve, HitRecieve_2, Idle, Idle_Gun, Idle_Gun_Pointing, Idle_Gun_Shoot, Idle_Neutral, Idle_Sword, Interact, Kick_Left, Kick_Right, Punch_Left, Punch_Right, Roll, Run, Run_Back, Run_Left, Run_Right, Run_Shoot, Sword_Slash, Walk, Wave | 5776 | 1386992 | 1.750 | Idle, Walk, Run, Interact, Punch_Left and Punch_Right available. |
| `characters/catcher_farmer.glb` | catcher farmer | Quaternius — Farmer | https://poly.pizza/m/7pn3R6hPvE | Death, Gun_Shoot, HitRecieve, HitRecieve_2, Idle, Idle_Gun, Idle_Gun_Pointing, Idle_Gun_Shoot, Idle_Neutral, Idle_Sword, Interact, Kick_Left, Kick_Right, Punch_Left, Punch_Right, Roll, Run, Run_Back, Run_Left, Run_Right, Run_Shoot, Sword_Slash, Walk, Wave | 5476 | 1326612 | 1.750 | Hat and overalls: strongest catcher candidate. |
| `vehicles/helicopter.glb` | helicopter | kazuma — Helicopter | https://poly.pizza/m/EQJ2MECUbx | — | 1094 | 77024 | 2.500 | Static rotor; kazuma author. Animate rotor in code if needed. |
| `vehicles/boss_mech.glb` | boss mech | Quaternius — Mech | https://poly.pizza/m/o3Ps8z8ByP | Dance, Death, Hello, HitRecieve_1, HitRecieve_2, Idle, Jump, Jump_Landing, Jump_NoHeight, Kick, No, Pickup, Run, Shoot_Big, Shoot_Small, Walk, Yes | 5846 | 663524 | 8.000 | Animated boss candidate: Shoot_Big, Run, Walk, Dance. |
| `vehicles/boss_robot.glb` | boss robot | Quaternius — Animated Robot | https://poly.pizza/m/QCm7qe9uNJ | Dance, Death, Idle, Jump, No, Punch, Running, Sitting, Standing, ThumbsUp, Walking, WalkJump, Wave, Yes | 3237 | 389068 | 8.000 | Animated alternative boss: Punch, Running, Walking, Dance. |
| `creatures/trex.glb` | trex | Quaternius — T-Rex | https://poly.pizza/m/UYtneO5FpF | Attack, Death, Idle, Jump, Run, Walk | 1820 | 327664 | 3.000 | — |
| `creatures/velociraptor.glb` | velociraptor | Quaternius — Velociraptor | https://poly.pizza/m/cnlGH2UcDd | Attack, Death, Idle, Jump, Run, Walk | 1248 | 277236 | 1.500 | — |
| `creatures/dragon.glb` | dragon | Quaternius — Dragon | https://poly.pizza/m/VBvzjFIYws | Attack, Attack2, Death, Flying, Hit | 1344 | 262196 | 3.000 | Ultimate Monsters dragon; flying animations, no ground walk. |
