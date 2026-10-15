"""Read public Drive folder listings; download selected data files only."""
import concurrent.futures
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[3] / 'lizard-kaiju-downloads'
PACKS = {
    'ultimateanimatedanimals': '1uJ3N5HfB7jKTseJUNQr3N4YaN0UuEtHk',
    'animateddinosaurs': '1u5Fhu3ziuRlGonW6bUI7uClqBGoSNeF6',
    'animatedrobot': '18MU0RtRu9G6SU6uSZ_zMQFmVkRlB4zH5',
    'ultimatedanimatedcharacter': '1sNi1AfenfPRrvRt5yfaj5QMMd6KKcUJ5',
    'ultimatemonsters': '18m4KpzpEzhC9wl7jzr6dUc0N8Jozr79C',
}


def listing(folder):
    page = urllib.request.urlopen('https://drive.google.com/drive/folders/' + folder).read().decode()
    page = page.replace('\\x22', '"').replace('\\x5b', '[').replace('\\x5d', ']').replace('\\/', '/')
    return re.findall(r'\["([\w-]+)",\["[\w-]+"\],"([^"]+)","([^"]+)"', page)


def inspect(name, folder):
    print(name, listing(folder), flush=True)
    for identifier, filename, kind in listing(folder):
        if kind.endswith('folder') and any(word in filename.lower() for word in ['gltf', 'fbx', 'blend']):
            print(name, filename, listing(identifier), flush=True)


if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(lambda pair: inspect(*pair), PACKS.items()))
