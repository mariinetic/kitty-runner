"""Gera o site estatico (pasta site/) para o GitHub Pages a partir do template Flask."""
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRONT = ROOT / "frontend"
OUT = ROOT / "site"

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir()

html = (FRONT / "templates" / "index.html").read_text(encoding="utf-8")
html = re.sub(r"\{\{\s*url_for\('image_file',\s*filename='([^']+)'\)\s*\}\}", r"Images/\1", html)
html = re.sub(r"\{\{\s*url_for\('static',\s*filename='([^']+)'\)\s*\}\}", r"static/\1", html)
if "{{" in html or "{%" in html:
    raise SystemExit("Ainda restam tags Jinja no index.html")
(OUT / "index.html").write_text(html, encoding="utf-8")

shutil.copytree(FRONT / "static", OUT / "static")
shutil.copytree(FRONT / "assets" / "Images", OUT / "Images")
(OUT / ".nojekyll").write_text("")
print("Site gerado em", OUT)
