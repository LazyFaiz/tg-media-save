"""Build both distributions with Python 3 (Windows, macOS, Linux)."""
from pathlib import Path
import json
import zipfile
ROOT = Path(__file__).resolve().parent.parent
version = json.loads((ROOT / 'extension/manifest.json').read_text())['version']
content = (ROOT / 'src/content.js').read_bytes()
header = (ROOT / 'src/userscript.meta.js').read_text(encoding='utf-8').replace('__VERSION__', version)
(ROOT / 'tg-media-save.user.js').write_bytes(header.encode('utf-8') + content)
(ROOT / 'extension/content.js').write_bytes(content)
(ROOT / 'dist').mkdir(exist_ok=True)
with zipfile.ZipFile(ROOT / 'dist/tg-media-save-extension.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in sorted((ROOT / 'extension').rglob('*')):
        if file.is_file():
            archive.write(file, file.relative_to(ROOT / 'extension').as_posix())
print(f'Built tg-media-save {version}')
