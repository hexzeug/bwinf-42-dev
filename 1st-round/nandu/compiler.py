# This short script is used to create the standalone minified html file.
# It is not part of the solution to BWINF.

from base64 import b64encode
from minify_html import minify

html = None
css = None
js = None
torch = None
torch_active = None

with open('1st-round/nandu/index.html') as f: html = f.read()
with open('1st-round/nandu/style.css') as f: css = f.read()
with open('1st-round/nandu/main.js') as f: js = f.read()
with open('1st-round/nandu/assets/torch.svg', 'rb') as f: torch = b64encode(f.read()).decode()
with open('1st-round/nandu/assets/torch_active.svg', 'rb') as f: torch_active = b64encode(f.read()).decode()

css = css.replace('assets/torch.svg', f"data:image/svg+xml;base64,{torch}")
css = css.replace('assets/torch_active.svg', f"data:image/svg+xml;base64,{torch_active}")
css = minify(css, minify_css=True)

html = html.replace('<link rel="stylesheet" href="style.css" />', f"<style>{css}</style>")
html = html.replace('<script src="main.js">', f"<script>{js}")

html = minify(html, minify_js=True, do_not_minify_doctype=True, ensure_spec_compliant_unquoted_attribute_values=True, keep_spaces_between_attributes=True)

with open('1st-round/nandu/bin/index.min.html', 'w') as f: f.write(html)