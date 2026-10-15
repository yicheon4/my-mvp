"""Package the built mobile MVP into a directly openable single HTML file."""
from pathlib import Path
import base64, mimetypes, re
root = Path(__file__).resolve().parents[1]
build = root / 'dist/client'
html = (build / 'index.html').read_text()
cache = {}
def data_url(path):
    path = path.resolve()
    if path not in cache:
        mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
        cache[path] = 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()
    return cache[path]
def asset(url, base=build):
    if url.startswith(('data:', 'http:', 'https:', '#')): return url
    path = build / url.lstrip('/') if url.startswith('/') else base / url
    if not path.is_file(): raise FileNotFoundError(path)
    return data_url(path)
def css_tag(match):
    path = build / match.group(1).lstrip('/')
    source = re.sub(r',url\([^)]*\.woff\)format\("woff"\)', '', path.read_text())
    css = re.sub(r'url\([\"\']?([^\)\"\']+)[\"\']?\)', lambda m: 'url("' + asset(m.group(1), path.parent) + '")', source)
    return '<style>' + css.replace('</style', '<\\/style') + '</style>'
script_match = re.search(r'<script\b[^>]*src="([^"]+\.js)"[^>]*></script>', html)
js = (build / script_match.group(1).lstrip('/')).read_text()
# Vite/Rolldown emits backtick string literals as well as single/double quotes.
js = re.sub(r'([\"\'`])(/(?:art|assets)/[^\"\'`]+)\1', lambda m: m.group(1) + asset(m.group(2)) + m.group(1), js)
assert not re.search(r'[\"\'`]/(?:art|assets)/', js), 'Unembedded asset reference'
assert not re.search(r'\bimport\s*\(|\bexport\s*\{', js), 'Bundle needs module processing'
html = html[:script_match.start()] + html[script_match.end():]
html = re.sub(r'<link\b[^>]*href="([^"]+\.css)"[^>]*>', css_tag, html)
# This built bundle has no module imports. A classic script after #root avoids
# file-origin module loading restrictions and guarantees the mount node exists.
js = re.sub(r'</script', r'<\\/script', js, flags=re.I)
html = html.replace('</body>', '<script>\n' + js + '\n</script>\n</body>')
out = root / 'dist/submission/index.html'  # Git에 올리지 않는 제출용 파일
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html)
(root / 'qa/export-script.js').write_text(js)
print(f'Saved {out} ({out.stat().st_size / 1024 / 1024:.1f} MiB); embedded {len(cache)} assets')
print('Embedded images:', ', '.join(p.name for p in cache if p.suffix in ('.png','.svg')))
