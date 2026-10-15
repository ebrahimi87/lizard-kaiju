"""Select CC0 models, embed external images, and write a loadable manifest.
Run: python3 -I tools/assets/prepare_library.py
Then run capture.mjs with --measure and normalize_library.py.
"""
import json
import math
import pathlib
import re
import struct

REPO = pathlib.Path(__file__).resolve().parents[2]
DOWNLOADS = pathlib.Path(__file__).resolve().parents[3] / 'lizard-kaiju-downloads'
OUT = REPO / 'assets/models'
entries = []


def read_glb(path):
    data = path.read_bytes()
    assert data[:4] == b'glTF'
    chunks = []
    offset = 12
    while offset < len(data):
        size, kind = struct.unpack_from('<II', data, offset)
        chunks.append((kind, data[offset + 8:offset + 8 + size]))
        offset += 8 + size
    document = json.loads(chunks[0][1])
    binary = next((content for kind, content in chunks if kind == 0x004E4942), b'')
    return document, binary


def write_glb(path, document, binary):
    binary += b'\0' * (-len(binary) % 4)
    document['buffers'] = [{'byteLength': len(binary)}]
    text = json.dumps(document, separators=(',', ':')).encode()
    text += b' ' * (-len(text) % 4)
    data = struct.pack('<III', 0x46546C67, 2, 28 + len(text) + len(binary))
    data += struct.pack('<II', len(text), 0x4E4F534A) + text
    data += struct.pack('<II', len(binary), 0x004E4942) + binary
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)


def add(source, category, name, pack, license_url, height=None, notes='', rotation=0):
    document, binary = read_glb(source)
    if name == 'crab':
        # The mirror has six unweighted vertices with NaN skin weights.
        # Attach those vertices to the body bone, not an undefined transform.
        binary = bytearray(binary)
        for primitive in document['meshes'][0]['primitives']:
            accessor = document['accessors'][primitive['attributes']['WEIGHTS_0']]
            view = document['bufferViews'][accessor['bufferView']]
            offset = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
            joints = document['accessors'][primitive['attributes']['JOINTS_0']]
            joint_view = document['bufferViews'][joints['bufferView']]
            joint_offset = joint_view.get('byteOffset', 0) + joints.get('byteOffset', 0)
            for vertex in range(accessor['count']):
                weights = struct.unpack_from('<4f', binary, offset + vertex * 16)
                if not all(math.isfinite(weight) for weight in weights):
                    struct.pack_into('<4f', binary, offset + vertex * 16, 1, 0, 0, 0)
                    struct.pack_into('<4H', binary, joint_offset + vertex * 8, 0, 0, 0, 0)
        binary = bytes(binary)
        notes += ' Fixed six invalid skin-weight vertices by binding them to body.'
    for image in document.get('images', []):
        if 'uri' not in image:
            continue
        image_path = (source.parent / image.pop('uri')).resolve()
        assert image_path.is_relative_to(DOWNLOADS)
        content = image_path.read_bytes()
        binary += b'\0' * (-len(binary) % 4)
        image['bufferView'] = len(document.setdefault('bufferViews', []))
        image['mimeType'] = 'image/png' if content[:8] == b'\x89PNG\r\n\x1a\n' else 'image/jpeg'
        document['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(content)})
        binary += content
    seen = set()
    animations = []
    for animation in document.get('animations', []):
        clip = animation['name'].split('|')[-1]
        clip = re.sub(r'^(TRex|Velociraptor|Robot|Frog|Rat|Dragon|Spider)_', '', clip)
        if clip not in seen:
            seen.add(clip)
            animation['name'] = clip
            animations.append(animation)
    if animations:
        document['animations'] = animations
    for material in document.get('materials', []):
        pbr = material.setdefault('pbrMetallicRoughness', {})
        pbr['metallicFactor'] = 0
        pbr['roughnessFactor'] = 0.85
        if pack == 'Kenney nature-kit' and 'baseColorFactor' in pbr:
            color = pbr['baseColorFactor'][:3]
            if material['name'] in ('grass', 'leafsGreen'):
                color = [0.34, 0.76, 0.16]
            elif material['name'] == 'leafsDark':
                color = [0.20, 0.51, 0.29]
            if category == 'volcano':
                color = [0.25, 0.22, 0.29] if material['name'] == 'grass' else [0.32, 0.28, 0.35]
            # Kenney's older exporter stored display colors as linear factors.
            # Use linear color values, as required by glTF, for richer color.
            pbr['baseColorFactor'] = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in color] + [1]
        if name == 'helicopter':
            if material['name'] == 'Material.001':
                pbr['baseColorFactor'] = [0.035, 0.32, 0.62, 1]
            elif material['name'] == 'Material.003':
                pbr['baseColorFactor'] = [0.82, 0.24, 0.025, 1]
    relative = f'{category}/{name}.glb'
    write_glb(OUT / relative, document, binary)
    triangles = sum(document['accessors'][primitive['indices']]['count'] // 3 if 'indices' in primitive else document['accessors'][primitive['attributes']['POSITION']]['count'] // 3 for mesh in document.get('meshes', []) for primitive in mesh['primitives'])
    entries.append({'path': relative, 'name': name.replace('_', ' '), 'pack': pack, 'licenseUrl': license_url, 'sourceFile': str(source), 'animations': [a['name'] for a in animations], 'triangles': triangles, 'targetHeight': height, 'rotationY': rotation, 'notes': notes})


def kenney(pack, category, names, height=None, prefix='', notes=''):
    for name in names.split():
        source = next((DOWNLOADS / pack).rglob(name + '.glb'))
        output = prefix + re.sub(r'([a-z])([A-Z])', r'\1_\2', name).lower().replace('-', '_')
        add(source, category, output, 'Kenney ' + pack, 'https://kenney.nl/assets/' + pack, height, notes)


def poly(identifier, category, name, height=None, notes='', rotation=0):
    folder = DOWNLOADS / 'poly-pizza' / identifier / 'download-01'
    metadata = json.loads((folder / 'source.json').read_text())
    assert metadata['Licence'] == 'CC0 1.0'
    pack = metadata['Creator']['Username'] + ' — ' + metadata['Title']
    add(folder / 'model.glb', category, name, pack, 'https://poly.pizza/m/' + identifier, height, notes, rotation)


if __name__ == '__main__':
    kenney('nature-kit', 'garden', 'grass grass_large grass_leafs grass_leafsLarge flower_redA flower_redB flower_yellowA flower_yellowB flower_purpleA flower_purpleB plant_bushSmall plant_bush plant_bushLarge plant_bushDetailed mushroom_red mushroom_redGroup mushroom_tan mushroom_tanTall pot_small pot_large fence_planks fence_planksDouble fence_gate fence_simple log log_large log_stack stump_round stump_roundDetailed path_stone path_stoneCircle')
    kenney('nature-kit', 'nature', 'tree_default tree_detailed tree_oak tree_small tree_tall rock_smallA rock_smallB rock_smallFlatA rock_largeA rock_largeB rock_largeC rock_tallA stone_smallA stone_smallFlatB stone_tallA', notes='Clone materials before tinting. Share geometry for repeated scenery.')
    kenney('nature-kit', 'jungle', 'tree_palm tree_palmShort tree_palmTall tree_palmBend tree_palmDetailedShort tree_palmDetailedTall plant_flatShort plant_flatTall crops_bambooStageA crops_bambooStageB')
    kenney('nature-kit', 'swamp', 'lily_small lily_large tree_default_dark tree_thin_dark stump_squareDetailed grass_leafs', prefix='swamp_', notes='Leaf grass is a reed fallback; lilies sit on the water surface.')
    kenney('nature-kit', 'volcano', 'cliff_rock cliff_large_rock rock_tallC rock_largeD', notes='Clone and tint stone materials charcoal for lava areas; no lava texture included.')
    kenney('city-kit-suburban', 'city', 'building-type-a building-type-b building-type-c building-type-d building-type-f building-type-g', prefix='house_')
    kenney('city-kit-suburban', 'city', 'tree-small tree-large planter path-stones-short', prefix='city_')
    kenney('city-kit-commercial', 'city', 'building-a building-b building-c building-f building-skyscraper-a building-skyscraper-c', prefix='commercial_')
    kenney('city-kit-roads', 'city', 'road-straight road-bend road-crossroad road-intersection road-crossing light-curved light-square traffic-light dumpster')
    kenney('car-kit', 'vehicles', 'suv sedan taxi', height=1.8, notes='Front faces +Z. SUV is the off-road jeep fallback.')
    kenney('survival-kit', 'props', 'box box-open chest barrel bucket', notes='Closed and open wooden box variants; chest has open/close clips.')
    poly('PJnKvWluqs', 'props', 'gem_pink', 0.3)
    poly('pf5lzmgr2J', 'props', 'crystal_cluster', 1)
    poly('WcrsIHK2A3', 'props', 'cage', 2, 'Metal cage, not wooden; use box or fences for wooden cages.')
    poly('jqcanvH7D6', 'jungle', 'fern', 0.8)
    poly('qKICY6xla2', 'animals', 'cat', 0.45, 'Small pointed ears; animated quadruped.')
    poly('2f54vbV0In', 'animals', 'cat_round', 0.45, 'Alternative cat with Idle and Walk; no Run clip.')
    poly('y4wdQpg767', 'animals', 'dog_shiba', 0.65, 'Cute Shiba Inu; Gallop is the run clip.')
    poly('qvTrSG9pZF', 'animals', 'horse', 1.8, 'Gallop is the run clip.')
    poly('9Z2V8fpazF', 'critters', 'frog', 0.3)
    poly('iltq5bVNaV', 'critters', 'mouse_rat', 0.25, 'Rat used as mouse fallback.')
    poly('Z3RCoCYss4', 'critters', 'chicken', 0.5)
    poly('Gs3yfsV5lB', 'critters', 'crab', 0.3)
    poly('BEcU9rjiAq', 'critters', 'fish', 0.25)
    poly('3tCnJC9UYA', 'critters', 'ladybird', 0.06, 'Static ladybug; Exceptional_3D author.')
    poly('HvfIku26CK', 'critters', 'bee', 0.08, 'Static bee, fallback for butterfly.')
    poly('yRYJiAJyiM', 'critters', 'spider', 0.15, 'Animated; fallback for cricket/beetle.')
    poly('kZ3DmIoGip', 'characters', 'catcher_casual', 1.75, 'Idle, Walk, Run, Interact, Punch_Left and Punch_Right available.')
    poly('7pn3R6hPvE', 'characters', 'catcher_farmer', 1.75, 'Hat and overalls: strongest catcher candidate.')
    poly('EQJ2MECUbx', 'vehicles', 'helicopter', 2.5, 'Static rotor; kazuma author. Animate rotor in code if needed.')
    poly('o3Ps8z8ByP', 'vehicles', 'boss_mech', 8, 'Animated boss candidate: Shoot_Big, Run, Walk, Dance.')
    poly('QCm7qe9uNJ', 'vehicles', 'boss_robot', 8, 'Animated alternative boss: Punch, Running, Walking, Dance.')
    poly('UYtneO5FpF', 'creatures', 'trex', 3)
    poly('cnlGH2UcDd', 'creatures', 'velociraptor', 1.5)
    poly('VBvzjFIYws', 'creatures', 'dragon', 3, 'Ultimate Monsters dragon; flying animations, no ground walk.')
    (OUT / 'manifest.json').write_text(json.dumps(entries, indent=2) + '\n')
    print(len(entries), 'models', sum((OUT / entry['path']).stat().st_size for entry in entries), 'bytes')
