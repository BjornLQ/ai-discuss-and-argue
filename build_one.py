#!/usr/bin/env python3
"""
Build one app from its .jsx into a single self-contained .html.

Pipeline:
  1. copy <app>.jsx -> src/One.jsx, append a mount entry
  2. base64-hide CREDITS_WARNING and INTRO so they aren't casually find/replaced
  3. inject version (from <app>.version.json, auto-incremented) + CET timestamp
  4. esbuild: bundle React + app into one minified IIFE
  5. javascript-obfuscator over the bundle
  6. compute FNV-1a (32-bit) over the obfuscated script body -> __SIG__
  7. wrap in HTML with the window.storage localStorage shim + tamper check

Usage: python3 build_one.py <app-basename>   (e.g. ai-discuss-and-argue)
"""
import base64, json, os, re, subprocess, sys, datetime
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
app = sys.argv[1] if len(sys.argv) > 1 else "ai-discuss-and-argue"
title = sys.argv[2] if len(sys.argv) > 2 else "AI Discuss and Argue"

jsx_path = os.path.join(HERE, app + ".jsx")
src_dir = os.path.join(HERE, "src")
os.makedirs(src_dir, exist_ok=True)

src = open(jsx_path, encoding="utf-8").read()

# --- 2. base64-hide the two user-visible banner/intro strings ---
def b64(s): return base64.b64encode(s.encode("utf-8")).decode("ascii")

m = re.search(r'const CREDITS_WARNING = "(.*?)";', src)
if m:
    src = src.replace(m.group(0), 'const CREDITS_WARNING = dec("%s");' % b64(m.group(1)))
m = re.search(r'const INTRO = "(.*?)";', src, re.S)
if m:
    src = src.replace(m.group(0), 'const INTRO = dec("%s");' % b64(m.group(1)))

# --- 3. version + timestamp (CET) ---
vfile = os.path.join(HERE, app + ".version.json")
if os.path.exists(vfile):
    ver = json.load(open(vfile))
    # bump patch
    parts = ver["version"].split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    ver["version"] = ".".join(parts)
else:
    ver = {"version": "1.0.0"}
json.dump(ver, open(vfile, "w"), indent=2)

now = datetime.datetime.now(ZoneInfo("Europe/Stockholm"))
built = now.strftime("%Y-%m-%d %H:%M %Z")
src = src.replace("__APP_VERSION__", ver["version"]).replace("__APP_BUILT__", built)

open(os.path.join(src_dir, "One.jsx"), "w", encoding="utf-8").write(src)

# entry that mounts the default export
entry = os.path.join(src_dir, "entry.jsx")
open(entry, "w", encoding="utf-8").write(
    'import React from "react";\n'
    'import { createRoot } from "react-dom/client";\n'
    'import App from "./One.jsx";\n'
    'var el = document.getElementById("root");\n'
    'el.innerHTML = "";\n'
    'createRoot(el).render(React.createElement(App));\n'
)

# --- 4. esbuild bundle ---
bundle = os.path.join(HERE, "bundle.js")
subprocess.run([
    os.path.join(HERE, "node_modules", ".bin", "esbuild"),
    entry, "--bundle", "--minify", "--format=iife",
    "--jsx=automatic",
    "--define:process.env.NODE_ENV=\"production\"",
    "--outfile=" + bundle,
], check=True, cwd=HERE)

# --- 5. obfuscate ---
obf = os.path.join(HERE, "bundle.obf.js")
subprocess.run(["node", os.path.join(HERE, "obfuscate.cjs"), bundle, obf], check=True, cwd=HERE)

app_js = open(obf, encoding="utf-8").read()

# The bundle can contain the literal "</script>" (React tests innerHTML with it).
# Left inline, it would prematurely close our <script id="app"> tag. Break the
# token so the HTML parser never sees a closing tag; inside a JS string "<\/script"
# is identical to "</script", so semantics are unchanged. Done before hashing so
# the embedded text and the page's textContent (and thus the signature) agree.
app_js = re.sub(r'</script', r'<\\/script', app_js, flags=re.IGNORECASE)

# --- 6. FNV-1a over the exact script body (CR-normalised), as the page computes it ---
def fnv1a(text):
    # Match JS exactly: hash over UTF-16 code units, as String.charCodeAt returns.
    units = text.encode("utf-16-le")
    h = 2166136261
    for i in range(0, len(units), 2):
        code = units[i] | (units[i + 1] << 8)
        h ^= code
        h = (h * 16777619) & 0xffffffff
    return format(h, "08x")

# The page hashes textContent of the <script id="app"> element, i.e. exactly
# what sits between the tags — including the newline after ">" and the newline
# plus indentation before "</script>". Build that inner string once and hash it,
# then emit the same string, so the two always agree.
body = app_js.replace("\r", "")
inner = "\n" + body + "\n    "
sig = fnv1a(inner)

# --- 7. wrap HTML ---
html = f'''<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>{title}</title>
    <style>
      html, body, #root {{ height: 100%; margin: 0; }}
      body {{ background: #f0f0f4; }}
      #boot {{ font: 15px system-ui, sans-serif; color: #6b6b72; padding: 40px; text-align: center; }}
    </style>
    <script>
      window.storage = {{
        async get(key){{ var v=localStorage.getItem(key); if(v===null) throw new Error("no such key"); return {{key:key,value:v}}; }},
        async set(key,value){{ localStorage.setItem(key,value); return {{key:key,value:value}}; }},
        async delete(key){{ localStorage.removeItem(key); return {{key:key,deleted:true}}; }},
        async list(prefix){{ prefix=prefix||""; return {{keys:Object.keys(localStorage).filter(function(k){{return k.indexOf(prefix)===0;}})}}; }}
      }};
      window.__SIG__ = "{sig}";
    </script>
  </head>
  <body>
    <div id="root"><div id="boot">Loading&#8230;</div></div>
    <script id="app">{inner}</script>
    <script>
      (function(){{ try{{
        var text=document.getElementById("app").textContent.replace(/\\r/g,"");
        var h=2166136261; for(var i=0;i<text.length;i++){{ h^=text.charCodeAt(i); h=Math.imul(h,16777619)>>>0; }}
        window.__MODIFIED__ = ("00000000"+h.toString(16)).slice(-8) !== window.__SIG__;
      }} catch(e){{ window.__MODIFIED__=false; }} }})();
    </script>
  </body>
</html>
'''

out = os.path.join(HERE, app + ".html")
open(out, "w", encoding="utf-8").write(html)
print("VERSION", ver["version"], "BUILT", built)
print("SIG", sig)
print("OUT", out, os.path.getsize(out), "bytes")
