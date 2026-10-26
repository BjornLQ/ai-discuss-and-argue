# AI Discuss and Argue

A single-file browser app where 2–4 AI agents hold a one-minute conversation —
discussing or arguing a subject you set — shown as a chat with avatars and
speech bubbles. Each agent is driven by a real model through the viewer's own
API key, or by a local model (Ollama / LM Studio) on the viewer's machine. A
finished run can be recorded and downloaded as a video.

## What's here

| File | What it is |
|---|---|
| `ai-discuss-and-argue.jsx` | The source. Edit this. |
| `ai-discuss-and-argue.html` | The built, self-contained app. This is the file you send to users. |
| `build_one.py` | Builds the `.html` from the `.jsx`. |
| `obfuscate.cjs` | Obfuscation step used by the build. |
| `package.json` | Build dependencies (esbuild, javascript-obfuscator, react). |

## Using the app

Open `ai-discuss-and-argue.html` in a browser. On first run it asks for at
least one API key (Anthropic, OpenAI, Google Gemini or OpenRouter) or a local
model (Ollama / LM Studio). Keys are stored in that browser only and are sent
only to the provider chosen. Nothing is uploaded anywhere else.

## Building from source

Requires Node.js and Python 3.

```
npm install
python3 build_one.py ai-discuss-and-argue "AI Discuss and Argue"
```

This regenerates `ai-discuss-and-argue.html` with a bumped version number and a
fresh build timestamp (shown at the top of the app).

## Notes

- API keys live in the viewer's browser, never in these files.
- The built `.html` makes zero third-party requests except the model calls the
  viewer themselves trigger.
