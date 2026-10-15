"""Fetch CC0 pack data; never execute downloaded content. Run with python3 -I."""
import concurrent.futures
import pathlib
import re
import urllib.request
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[3] / 'lizard-kaiju-downloads'


def fetch(name):
    url = 'https://kenney.nl/assets/' + name
    page = urllib.request.urlopen(url).read().decode()
    assert 'https://creativecommons.org/publicdomain/zero/1.0/' in page
    download = re.findall(r'https[^"\s]+\.zip', page)[0]
    folder = ROOT / name / 'download-01'
    folder.mkdir(parents=True, exist_ok=False)
    (folder / 'source.html').write_text(page)
    urllib.request.urlretrieve(download, folder / 'pack.zip')
    with zipfile.ZipFile(folder / 'pack.zip') as archive:
        for member in archive.infolist():
            path = (folder / member.filename).resolve()
            if not path.is_relative_to(folder.resolve()):
                raise ValueError('Unsafe archive path')
        archive.extractall(folder / 'files')
    print(name, 'ready', flush=True)


with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    list(pool.map(fetch, ['nature-kit', 'city-kit-suburban', 'city-kit-commercial', 'car-kit', 'survival-kit']))
