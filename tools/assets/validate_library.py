"""Validate delivered GLBs and browser measurements. Run with python3 -I."""
import json
import math
import pathlib
import runpy
import struct

REPO = pathlib.Path(__file__).resolve().parents[2]
read_glb = runpy.run_path(str(REPO / 'tools/assets/prepare_library.py'))['read_glb']
OUT = REPO / 'assets/models'
manifest = json.loads((OUT / 'manifest.json').read_text())
validation = json.loads((REPO / '.artifacts/asset-validation.json').read_text())
assert not validation['errors'], validation['errors']
stats = {entry['path']: entry for entry in validation['stats']}
assert set(stats) == {entry['path'] for entry in manifest}
assert {str(path.relative_to(OUT)) for path in OUT.rglob('*.glb')} == set(stats)
for entry in manifest:
    path = OUT / entry['path']
    document, binary = read_glb(path)
    assert not document.get('extensionsRequired'), path
    assert not any('uri' in image for image in document.get('images', [])), path
    assert path.stat().st_size == entry['sizeBytes'], path
    for accessor in document.get('accessors', []):
        if accessor['componentType'] != 5126:
            continue
        view = document['bufferViews'][accessor['bufferView']]
        count = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[accessor['type']]
        start = view.get('byteOffset', 0) + accessor.get('byteOffset', 0)
        stride = view.get('byteStride', count * 4)
        for index in range(accessor['count']):
            values = struct.unpack_from('<' + 'f' * count, binary, start + stride * index)
            assert all(math.isfinite(value) for value in values), path
    stat = stats[entry['path']]
    assert abs(stat['min'][1]) < 0.001, (path, stat['min'])
    assert abs(stat['size'][1] - entry['heightMeters']) < 0.001, path
    assert all(max(texture) <= 1024 for texture in stat['textures']), path
    assert [clip['name'] for clip in stat['checks']] == entry['animations'], path
    assert all(clip['moving'] and clip['duration'] > 0 for clip in stat['checks']), path
size = sum(path.stat().st_size for path in OUT.rglob('*') if path.is_file())
assert size < 25_000_000, size
print(f"PASS: {len(manifest)} GLBs; {sum(len(stat['checks']) for stat in stats.values())} moving clips; {size:,} bytes including catalog metadata")
