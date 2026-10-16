"""Builds ui/index.html from plugin.html + engine.js + plugin-app.js.
Non-ASCII characters (like the flat and sharp symbols) are escaped so the page is pure ASCII,
which avoids text-encoding problems inside some DAW web views."""
import pathlib, re
here = pathlib.Path(__file__).parent
html = (here/'plugin.html').read_text(encoding='utf-8')
engine = (here/'engine.js').read_text(encoding='utf-8')
app = (here/'plugin-app.js').read_text(encoding='utf-8')
js_esc = lambda s: ''.join(c if ord(c) < 128 else ('\\u%04x' % ord(c) if ord(c) < 0x10000 else ''.join('\\u%04x' % u for u in c.encode('utf-16-be') and [int.from_bytes(c.encode('utf-16-be')[i:i+2],'big') for i in (0,2)])) for c in s)
html_esc = lambda s: ''.join(c if ord(c) < 128 else '&#x%x;' % ord(c) for c in s)
html = html_esc(html).replace('/*ENGINE*/', js_esc(engine)).replace('/*APP*/', js_esc(app))
assert all(ord(c) < 128 for c in html)
(here/'index.html').write_text(html, encoding='ascii')
print('wrote', here/'index.html', len(html), 'bytes')
