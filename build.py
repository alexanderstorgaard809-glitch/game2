#!/usr/bin/env python3
"""Builds index.html from src/ (a single self-contained file).

Usage:
  python3 build.py                     -> writes index.html (three.js inlined)
  python3 build.py --artifact OUT.html -> also writes a page that loads three.js from a CDN
"""
import os, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PARTS = ['core.js', 'ai.js', 'campaign.js', 'sound.js', 'render.js', 'ui.js', 'editor.js']
CDN = '<script src="https://cdn.jsdelivr.net/npm/three@0.158.0/build/three.min.js"></script>'


def read(*p):
    with open(os.path.join(ROOT, *p), encoding='utf-8') as f:
        return f.read()


def build(three_tag):
    html = read('src', 'template.html')
    game = '\n'.join(read('src', p) for p in PARTS)
    return html.replace('<!--THREE-->', three_tag).replace('<!--GAME-->', game)


def main():
    three = read('vendor', 'three.min.js').replace('</script', '<\\/script')
    with open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(build('<script>/* three.js r158 - MIT License - https://threejs.org */\n' + three + '\n</script>'))
    print('wrote index.html')
    if '--artifact' in sys.argv:
        out = sys.argv[sys.argv.index('--artifact') + 1]
        page = build(CDN)
        for tag in ['<!DOCTYPE html>', '<html lang="en">', '<head>', '</head>', '<body>', '</body>', '</html>',
                    '<meta charset="utf-8">', '<meta name="viewport" content="width=device-width,initial-scale=1">']:
            page = page.replace(tag, '')
        with open(out, 'w', encoding='utf-8') as f:
            f.write(page.strip() + '\n')
        print('wrote', out)


if __name__ == '__main__':
    main()
