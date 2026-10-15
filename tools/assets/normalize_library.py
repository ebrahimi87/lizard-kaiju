"""Add a base-centered scale wrapper without changing animation or skin data.
Run once after prepare_library.py and capture.mjs --measure.
"""
import json
import math
import pathlib
import runpy

REPO = pathlib.Path(__file__).resolve().parents[2]
helpers = runpy.run_path(str(REPO / 'tools/assets/prepare_library.py'))
read_glb = helpers['read_glb']
write_glb = helpers['write_glb']
OUT = REPO / 'assets/models'
manifest = json.loads((OUT / 'manifest.json').read_text())
stats = {entry['path']: entry for entry in json.loads((REPO / '.artifacts/asset-raw-stats.json').read_text())['stats']}
for entry in manifest:
    stat = stats[entry['path']]
    height = stat['size'][1]
    scale = entry['targetHeight'] / height if entry['targetHeight'] else (6 if entry['path'].startswith('city/') else 2 if entry['pack'] == 'Kenney nature-kit' else 1)
    minimum, maximum = stat['min'], stat['max']
    center_x = (minimum[0] + maximum[0]) / 2
    center_z = (minimum[2] + maximum[2]) / 2
    angle = entry['rotationY']
    rotated_x = math.cos(angle) * center_x + math.sin(angle) * center_z
    rotated_z = -math.sin(angle) * center_x + math.cos(angle) * center_z
    path = OUT / entry['path']
    document, binary = read_glb(path)
    assert not any(node.get('name') == 'AssetBase' for node in document['nodes']), 'Already normalized; prepare again first'
    scene = document['scenes'][document.get('scene', 0)]
    wrapper = {'name': 'AssetBase', 'children': scene['nodes'], 'translation': [-rotated_x * scale, -minimum[1] * scale, -rotated_z * scale], 'scale': [scale] * 3, 'rotation': [0, math.sin(angle / 2), 0, math.cos(angle / 2)]}
    scene['nodes'] = [len(document['nodes'])]
    document['nodes'].append(wrapper)
    write_glb(path, document, binary)
    entry['heightMeters'] = round(height * scale, 5)
    entry['sizeBytes'] = path.stat().st_size
    entry['normalizationScale'] = scale
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(len(manifest), 'normalized models')
