"""Discover Poly Pizza models and keep source license evidence with each download."""
import concurrent.futures
import json
import pathlib
import re
import subprocess
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[3] / 'lizard-kaiju-downloads' / 'poly-pizza'


def page(url):
    return subprocess.check_output(['curl', '-fLsS', '-A', 'Mozilla/5.0', url]).decode()


def state(html):
    return json.loads(re.search(r'window.__SERVER_APP_STATE__ =\s*(.*?)</script>', html).group(1))


def search(term):
    html = page('https://poly.pizza/search/' + urllib.parse.quote(term))
    cards = re.findall(r'<a href="/m/([^"/]+)">(.*?)href="/u/([^"/]+)"', html)
    print(term, [(identifier, re.search(r'title="([^"]+)"', card).group(1), author) for identifier, card, author in cards], flush=True)


def download(identifier):
    url = 'https://poly.pizza/m/' + identifier
    html = page(url)
    model = state(html)['initialData']['model']
    if model['Licence'] != 'CC0 1.0':
        raise ValueError(f"Rejected {model['Title']}: {model['Licence']}")
    folder = ROOT / identifier / 'download-01'
    folder.mkdir(parents=True, exist_ok=False)
    (folder / 'source.html').write_text(html)
    (folder / 'source.json').write_text(json.dumps(model, indent=2))
    subprocess.run(['curl', '-fLsS', '-A', 'Mozilla/5.0', 'https://static.poly.pizza/' + model['ResourceID'] + '.glb', '-o', str(folder / 'model.glb')], check=True)
    print(identifier, model['Title'], model['Creator']['Username'], (folder / 'model.glb').stat().st_size, flush=True)


if __name__ == '__main__':
    action = search if sys.argv[1] == 'search' else download
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(action, sys.argv[2:]))
