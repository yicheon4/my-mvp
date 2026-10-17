"""Create a flat, browser-uploadable static release; preserve original image bytes."""
from pathlib import Path
import re,base64,hashlib,shutil
root=Path(__file__).resolve().parents[1]
build=root/'dist/client'
out=root/'dist/github-upload'
release=root.parent  # my-mvp 저장소 최상단 = Vercel이 그대로 배포하는 폴더
out.mkdir(parents=True,exist_ok=True)
images={}
for p in build.rglob('*'):
 if p.is_file() and p.suffix in ('.png','.svg','.webp') and 'persona-v9' not in p.relative_to(build).parts:
  name=hashlib.sha256(str(p.relative_to(build)).encode()).hexdigest()[:8]+'-'+p.name
  images['/'+str(p.relative_to(build))]=name
  shutil.copy2(p,out/name)
def rewrite_image(m):
 quote,url=m.group(1),m.group(2)
 return quote+'/'+images[url]+quote
html=(build/'index.html').read_text()
js_path=build/re.search(r'src="([^"]+\.js)"',html)[1].lstrip('/')
css_path=build/re.search(r'href="([^"]+\.css)"',html)[1].lstrip('/')
js=re.sub(r'([\"\'`])(/(?:art|assets)/[^\"\'`]+)\1',rewrite_image,js_path.read_text())
css=re.sub(r',url\([^)]*\.woff\)format\("woff"\)', '', css_path.read_text())
def css_url(m):
 url=m[1]
 if url.startswith('data:'):return m[0]
 p=build/url.lstrip('/') if url.startswith('/') else css_path.parent/url
 if p.suffix=='.woff2':
  return 'url("data:font/woff2;base64,'+base64.b64encode(p.read_bytes()).decode()+'")'
 return 'url("/'+images['/'+str(p.relative_to(build))]+'")'
css=re.sub(r'url\([\"\']?([^\)\"\']+)[\"\']?\)',css_url,css)
(out/'app.js').write_text(js)
(out/'app.css').write_text(css)
html=re.sub(r'src="[^"]+\.js"','src="/app.js"',html)
html=re.sub(r'href="[^"]+\.css"','href="/app.css"',html)
html=html.replace('</head>','<meta name="persona-world-release" content="2026-10-17-v9-presets">\n</head>')
(out/'index.html').write_text(html)
assert all(p.stat().st_size<25*1024*1024 for p in out.iterdir())
print('Prepared',len(list(out.iterdir())),'files; largest',round(max(p.stat().st_size for p in out.iterdir())/1024/1024,1),'MiB')
for p in out.iterdir(): shutil.copy2(p,release/p.name)
# Folders whose files are addressed at runtime by relative paths (e.g. /persona-v9/ + manifest src) keep their structure.
for folder in ('persona-v9',):
 if (build/folder).is_dir():
  shutil.rmtree(release/folder,ignore_errors=True)
  shutil.copytree(build/folder,release/folder)
  print('Copied folder',folder)
