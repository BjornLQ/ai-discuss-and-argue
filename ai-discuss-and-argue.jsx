import React, { useState, useRef, useEffect } from "react";

/*
 * AI Discuss and Argue
 * ────────────────────
 * One app, 2–4 AI agents, each driven by a real model through the user's own
 * API key (or a local model served from their own machine). An overall "How
 * they relate" frame sets the general tenor; every per-agent switch can
 * override that frame, and the override is shown on the agent's card. A
 * finished run can be filmed and downloaded.
 *
 * Merges the two earlier apps (Discuss: 2–4 collaborative speakers; Argue:
 * two agents with behaviour switches) into a single configurable app.
 */

const DURATION = 60; // seconds on the clock
const MIN_THINK = 3; // seconds a reply is held before it appears

// Up to four voices, each its own colour.
const SEATS = ["#2c6bed", "#aa377a", "#2f8f5b", "#b3701c"]; // blue, plum, green, amber
const seatColor = (i) => SEATS[i % SEATS.length];

// Set by the page wrapper when the bundle no longer matches the signature it
// was published with. Not a lock — anyone determined can strip the check — but
// an altered copy says so on its face rather than passing as yours.
const isModified = () => typeof window !== "undefined" && window.__MODIFIED__ === true;

// Decodes strings that the build step hides from a casual find-and-replace.
const dec = (v) => {
  try {
    return typeof atob === "function" ? decodeURIComponent(escape(atob(v))) : v;
  } catch {
    return v;
  }
};

// ─────────────────────────────────────────────────────────────
// INTRO: the one line shown at the top of the app. Leave it empty
// and the app shows nothing here.
const INTRO = "";
// ─────────────────────────────────────────────────────────────

const CREDITS_WARNING = "NOTE: This app uses AI credits.";

// Filled in by the build script; shows which build a tester is running.
const APP_VERSION = "__APP_VERSION__";
const APP_BUILT = "__APP_BUILT__";

// Shown in the "About / API access" popup. First entry is a paragraph; any
// entry beginning with "- " renders as a bullet.
const ABOUT_LINES = [
  "This app can use the major online LLM providers, or models you run yourself on this computer. Online API access is normally part of a paid account, though Google offers free API access within limits. Local models are free to run once installed.",
  "- Anthropic and OpenAI: API access needs a paid balance once any starter credit runs out.",
  "- Google Gemini: a free Google AI Studio key works, within its rate limits.",
  "- OpenRouter: one key reaches most models.",
  "- Ollama and LM Studio: run models on this machine, no key needed — they must be started with browser access (CORS) allowed.",
  "- Your key stays in this browser and is sent only to the provider you chose. Local models are reached directly on this computer.",
  "- You can give each agent its own provider and model, or run them all on one.",
];

const SHARED_CSS = `
.app {
  --blue: #2c6bed;
  --plum: #aa377a;
  --green: #2f8f5b;
  --amber: #b3701c;
  --ink: #1b1b1b;
  --muted: #6b6b72;
  --hair: #e4e4e9;
  --grey: #ececed;
  --field: #f2f2f6;
  height: 100vh;
  display: flex;
  justify-content: center;
  background: #f0f0f4;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: var(--ink);
  font-size: 15px;
}
.app * { box-sizing: border-box; }
.app button { font-family: inherit; }

.window {
  width: 100%;
  max-width: 640px;
  height: 100vh;
  background: #fff;
  display: flex;
  flex-direction: column;
  border-left: 1px solid var(--hair);
  border-right: 1px solid var(--hair);
}

.tampered {
  flex: 0 0 auto; background: #7d1f33; color: #fff; text-align: center;
  font-size: 12.5px; font-weight: 600; padding: 9px 14px;
}

/* banner and intro */
.banner {
  flex: 0 0 auto; background: #fdf0c8; color: #6b4d00; border-bottom: 1px solid #f0dda0;
  font-size: 12.5px; font-weight: 600; letter-spacing: .01em; text-align: center; padding: 9px 14px;
}
.intro {
  flex: 0 0 auto; padding: 11px 16px; border-bottom: 1px solid var(--hair);
  font-size: 13.5px; line-height: 1.45; color: var(--muted);
}

.link { border: 0; background: none; color: var(--blue); font-size: 12.5px; cursor: pointer; padding: 0; font-family: inherit; }
.link:hover { text-decoration: underline; }

.needkey { font-size: 11.5px; color: var(--plum); margin: -2px 0 8px; }
.promptview { margin-top: 8px; }
.promptview b { font-size: 12px; color: var(--muted); }
.promptview pre {
  white-space: pre-wrap; font-size: 11.5px; line-height: 1.45; color: var(--ink);
  background: #fff; border: 1px solid #dcdfe8; border-radius: 10px; padding: 10px 12px; margin: 4px 0 10px;
}
.keyrow { border-top: 1px solid var(--hair); padding: 12px 0; }
.keyhead { display: flex; justify-content: space-between; align-items: baseline; font-size: 14px; }
.keyhead a { color: var(--blue); font-size: 12.5px; }
.keynote { font-size: 11.5px; color: var(--muted); margin: 2px 0 8px; }
.keyentry { display: flex; gap: 8px; }
.keyentry input { margin: 0; }
.keyentry .btn { padding: 9px 16px; font-size: 14px; white-space: nowrap; }
.keysaved { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--muted); }
.keyfoot { font-size: 12px; color: var(--muted); margin: 14px 0 14px; }
.localhint { font-size: 11.5px; color: var(--muted); margin: 6px 0 2px; line-height: 1.4; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 2px; }
.chip { border: 1px solid #cdd3e0; background: #fff; border-radius: 999px; padding: 4px 10px; font-size: 11.5px; cursor: pointer; color: var(--ink); font-family: inherit; }
.chip:hover { border-color: var(--blue); color: var(--blue); }
.pick {
  width: 100%; font-family: inherit; font-size: 14px; color: var(--ink);
  background: var(--field); border: 1px solid transparent; border-radius: 9px;
  padding: 8px 10px; margin-bottom: 7px;
}

/* first run / connect */
.gate { padding: 26px 20px; max-width: 460px; margin: 0 auto; }
.gate h2 { font-size: 18px; font-weight: 600; margin: 0 0 10px; }
.gate p { font-size: 14px; line-height: 1.5; color: var(--muted); margin: 0 0 12px; }
.gate a { color: var(--blue); }
.gate input { font-size: 14px; }

/* message list */
.list { flex: 1 1 auto; overflow-y: auto; padding: 14px 14px 6px; }
.daypill { display: flex; justify-content: center; margin: 2px 0 14px; }
.daypill span { background: var(--field); color: var(--muted); font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 11px; }

.row { display: flex; align-items: flex-end; margin-bottom: 3px; position: relative; }
.bubble { border-radius: 18px; padding: 8px 13px 7px; line-height: 1.38; position: relative; }
.sender { font-size: 13px; font-weight: 600; margin-bottom: 2px; opacity: .85; }
.text { white-space: pre-wrap; overflow-wrap: anywhere; }
.stamp { display: block; text-align: right; font-size: 11px; margin-top: 2px; opacity: .65; font-variant-numeric: tabular-nums; }

.typing { display: inline-flex; gap: 5px; align-items: center; padding: 6px 2px 5px; }
.typing i { width: 8px; height: 8px; border-radius: 50%; background: currentColor; opacity: .4; animation: blink 1.2s infinite; }
.typing i:nth-child(2) { animation-delay: .2s; }
.typing i:nth-child(3) { animation-delay: .4s; }
@keyframes blink { 0%, 100% { opacity: .3; transform: translateY(0); } 50% { opacity: .95; transform: translateY(-2px); } }

.notice { text-align: center; font-size: 13px; color: var(--muted); padding: 14px 20px; }
.notice.bad { color: var(--plum); }

/* setup — a control panel, deliberately not chat-coloured */
.setup { margin: -14px -14px 0; padding: 20px 16px 22px; background: #eef0f5; border-bottom: 1px solid #dcdfe8; }
.setup h2 { font-size: 13px; font-weight: 600; margin: 0 0 3px; letter-spacing: .02em; text-transform: uppercase; color: var(--muted); }
.setup .lead { font-size: 13px; color: var(--muted); margin: 0 0 14px; line-height: 1.45; }

.infonote { font-size:12.5px; color:var(--muted); background:var(--field); border-radius:10px; padding:10px 13px; margin:0 0 16px; line-height:1.45; }

/* the overall / general frame — visually distinct from the per-agent cards */
.frame-panel {
  background: #1b2740; color: #eaf0ff; border-radius: 16px; padding: 16px 16px 18px; margin: 0 0 8px;
}
.frame-panel h2 { color: #aebfe6; margin: 0 0 3px; }
.frame-panel .lead { color: #b7c3e0; margin: 0 0 12px; }
.frame-choices { display: flex; gap: 8px; }
.frame-choice {
  flex: 1 1 0; border: 1px solid #33436a; background: #222f4d; color: #cfd9f0; border-radius: 11px;
  padding: 10px 10px; cursor: pointer; font-family: inherit; text-align: left; line-height: 1.3;
}
.frame-choice b { display: block; font-size: 14px; margin-bottom: 3px; color: #fff; }
.frame-choice span { font-size: 11px; color: #9fb0d6; }
.frame-choice.on { background: #2c6bed; border-color: #2c6bed; }
.frame-choice.on span { color: #dbe6ff; }
.frame-arc { margin-top: 14px; }
.frame-arc .swlabel { color: #aebfe6; }
.frame-panel .sw { background: #222f4d; }
.frame-panel .sw button { color: #9fb0d6; }
.frame-panel .sw button.on { background: #0e1627; color: #fff; box-shadow: none; }
.generalnote { font-size: 11px; color: #9fb0d6; margin: 10px 0 0; }

.between { text-align: center; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); margin: 18px 0 10px; }

/* general settings panel */
.genpanel { background:#fff; border:1px solid #dcdfe8; border-radius:14px; padding:14px 16px 16px; margin:0 0 12px; }
.gentitle { font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--muted); margin:0 0 12px; }
.gfield { margin-bottom:14px; }
.gfield:last-child { margin-bottom:0; }
.glabel { font-size:12.5px; font-weight:600; color:var(--ink); margin:0 0 6px; display:flex; align-items:center; gap:8px; }
.glabel.sm { font-size:11.5px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.02em; margin-top:10px; }
.req { font-size:10.5px; font-weight:600; color:var(--plum); text-transform:none; letter-spacing:0; }
.opt { font-size:10.5px; font-weight:500; color:var(--muted); text-transform:none; letter-spacing:0; }
.sw.seg { display:inline-flex; width:auto; }
.sw.seg button { min-width:52px; padding:8px 14px; }
.topic-input { width:100%; font-family:inherit; font-size:15px; border:1px solid transparent; border-radius:10px; padding:10px 12px; min-height:58px; resize:vertical; background:var(--field); color:var(--ink); }
.topic-input:focus { outline:none; border-color:var(--blue); background:#fff; }
.genrow { display:flex; align-items:center; justify-content:space-between; gap:10px; }
.modsum { font-size:12.5px; color:var(--plum); }
.modsum.ok { color:var(--green); }
.btn.sm { padding:7px 14px; font-size:13px; }

/* per-agent block extras */
.card.block { flex-direction:row; }
.readytag { font-size:11px; font-weight:600; }
.readytag.ready { color:var(--green); }
.readytag.local { color:var(--amber); }
.readytag.nokey { color:var(--plum); }
.openline { width:100%; font-family:inherit; font-size:14px; border:1px solid transparent; border-radius:10px; padding:9px 12px; min-height:44px; resize:vertical; background:var(--field); color:var(--ink); margin-bottom:4px; }
.openline:focus { outline:none; border-color:var(--blue); background:#fff; }
.behav-toggle { display:flex; align-items:center; justify-content:space-between; gap:10px; width:100%; margin-top:12px; border:1px solid var(--hair); background:var(--field); border-radius:9px; padding:9px 12px; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:600; color:var(--ink); }
.behav-toggle:hover { border-color:var(--blue); }
.behav-note { font-size:11px; font-weight:600; color:var(--muted); }
.behav-note.on { color:var(--amber); }
.behav-body { padding:6px 2px 2px; }

.card {
  background: #fff; border: 1px solid #dcdfe8; border-radius: 14px;
  padding: 14px; margin-bottom: 12px; display: flex; gap: 12px; align-items: flex-start;
}
.card .avatar { flex: 0 0 auto; border-radius: 50%; }
.card-fields { flex: 1 1 auto; min-width: 0; }
.card-top { display:flex; align-items:center; justify-content:space-between; margin:0 0 4px; gap: 8px; }
.card-top .ttl { font-size: 12px; color: var(--muted); font-weight: 600; }
.ovr-count { font-size: 11px; color: var(--amber); font-weight: 600; }
.remove-x { border:0; background:none; color:var(--muted); font-size:18px; line-height:1; cursor:pointer; padding:0 2px; }
.remove-x:hover { color:var(--plum); }

.trait { margin-top: 10px; }
.trait.overriding { background: #fff7ec; border-radius: 10px; padding: 6px 8px 8px; margin-left: -8px; margin-right: -8px; }
.swlabel { font-size: 11.5px; color: var(--muted); margin: 0 0 5px; letter-spacing: .02em; text-transform: uppercase; display: flex; align-items: center; gap: 8px; }
.ovr { text-transform: none; letter-spacing: 0; font-weight: 600; font-size: 10.5px; color: var(--amber); }
.ovr.pinned { color: var(--muted); }
.effhint { font-size: 11px; color: var(--muted); margin-top: 4px; }
.sw { display: flex; flex-wrap: wrap; background: var(--field); border-radius: 9px; padding: 3px; gap: 3px; }
.sw button {
  flex: 1 1 0; min-width: 62px; border: 0; background: none; border-radius: 7px; padding: 7px 6px;
  font-size: 12px; font-family: inherit; color: var(--muted); cursor: pointer; line-height: 1.25;
}
.sw button.on { background: #fff; color: var(--ink); font-weight: 600; box-shadow: 0 1px 3px rgba(20,20,40,.14); }
.sw button.frame.on { background: #e7edff; color: var(--blue); }

label { display: block; font-size: 12px; color: var(--muted); margin: 0 0 4px; }
input, textarea {
  width: 100%; font-family: inherit; font-size: 15px; color: var(--ink);
  background: var(--field); border: 1px solid transparent; border-radius: 9px;
  padding: 9px 12px; margin-bottom: 9px;
}
textarea { line-height: 1.4; resize: vertical; min-height: 58px; }
input:focus, textarea:focus { outline: none; border-color: var(--blue); background: #fff; }
.openers { background: #fff; border: 1px solid #dcdfe8; border-radius: 14px; padding: 14px; margin-bottom: 12px; }
.seed-row { display: flex; gap: 9px; align-items: flex-start; margin-bottom: 4px; }
.seed-row .avatar { margin-top: 7px; flex: 0 0 auto; border-radius: 50%; }
.seed-row textarea { flex: 1 1 auto; border-radius: 16px; margin-bottom: 5px; }
.setrow { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
.count-row { display:flex; align-items:center; justify-content:space-between; margin:0 0 14px; font-size:13px; color:var(--muted); }

.vidopts { background:#fff; border:1px solid #dcdfe8; border-radius:14px; padding:14px; margin-bottom:12px; }
.togline { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:4px; }
.togline:last-child { margin-bottom:0; }
.togline .lbl { font-size:13.5px; }
.togline .sub { font-size:11.5px; color:var(--muted); }
.toggle { position:relative; width:42px; height:24px; flex:0 0 auto; border-radius:999px; background:#cfd3dd; border:0; cursor:pointer; transition:background .15s; }
.toggle.on { background:var(--blue); }
.toggle::after { content:""; position:absolute; top:2px; left:2px; width:20px; height:20px; border-radius:50%; background:#fff; transition:transform .15s; }
.toggle.on::after { transform:translateX(18px); }

/* bottom bar */
.footer { flex: 0 0 auto; border-top: 1px solid var(--hair); padding: 10px 14px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.btn { border: 0; border-radius: 20px; padding: 10px 20px; font-size: 15px; font-weight: 500; cursor: pointer; background: var(--blue); color: #fff; }
.btn.quiet { background: var(--field); color: var(--ink); }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
.hint { font-size: 13px; color: var(--muted); }
.controls { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }

.topstrip { display:flex; gap:16px; align-items:center; padding:8px 16px; border-bottom:1px solid var(--hair); }
.app-title { font-size:13px; font-weight:600; color:var(--ink); margin-right:auto; }
.version { font-size:10px; color:var(--muted); white-space:nowrap; }
.argue-head { display:flex; align-items:center; gap:12px; padding:11px 16px; border-bottom:1px solid var(--hair); }
.title { min-width: 0; flex: 1 1 auto; }
.title h1 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.title p { margin: 1px 0 0; font-size: 13px; color: var(--muted); }
.timer { margin-left: auto; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.progress { flex: 0 0 auto; height: 2px; background: var(--hair); }
.progress span { display: block; height: 100%; background: var(--blue); transition: width .25s linear; }
.notes { font-size:12px; color:var(--muted); margin-top:10px; background:var(--field); border-radius:10px; padding:9px 11px; }
.notes ul { margin:5px 0 4px; padding-left:18px; }
.notes li { margin-bottom:3px; line-height:1.4; }

.modal-back { position:fixed; inset:0; background:rgba(20,20,40,.45); display:flex; align-items:center;
  justify-content:center; padding:20px; z-index:50; }
.modal { background:#fff; border-radius:14px; padding:22px 22px 24px; max-width:460px; width:100%; position:relative; }
.modal h2 { font-size:17px; margin:0 0 10px; }
.modal p { font-size:14px; line-height:1.5; color:var(--ink); margin:0 0 10px; }
.modal ul { margin:0; padding-left:20px; }
.modal li { font-size:13.5px; line-height:1.5; color:var(--muted); margin-bottom:6px; }
.modal-x { position:absolute; top:10px; right:14px; border:0; background:none; font-size:22px; cursor:pointer; color:var(--muted); }
.avatar-wrap { position:absolute; bottom:1px; }

@media (max-width: 520px) {
  .window { border: 0; }
  .frame-choices { flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) {
  .typing i, .progress span { animation: none; transition: none; }
}
`;

// ─── Providers ───────────────────────────────────────────────
// Three API shapes cover the field: Anthropic's messages API, anything
// OpenAI-compatible, and Google's generateContent. Local servers (Ollama,
// LM Studio) are OpenAI-compatible and reached at a base URL with no key.
// Model IDs are editable in the app, because they change faster than this file.
const PROVIDERS = {
  anthropic: {
    label: "Anthropic",
    shape: "anthropic",
    url: "https://api.anthropic.com/v1/messages",
    keyUrl: "https://console.anthropic.com/settings/keys",
    hint: "sk-ant-…",
    model: "claude-sonnet-4-6",
    examples: "claude-sonnet-4-6 · claude-opus-4-8 · claude-haiku-4-5-20251001",
  },
  openai: {
    label: "OpenAI",
    shape: "openai",
    url: "https://api.openai.com/v1/chat/completions",
    keyUrl: "https://platform.openai.com/api-keys",
    hint: "sk-…",
    model: "gpt-5.5",
    examples: "gpt-5.5 · gpt-6-astra · gpt-5.4-mini",
  },
  google: {
    label: "Google Gemini",
    shape: "gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    keyUrl: "https://aistudio.google.com/apikey",
    hint: "AIza…",
    model: "gemini-3.8-flash",
    examples: "gemini-3.8-flash · gemini-3.1-pro-preview · gemini-2.5-flash",
  },
  openrouter: {
    label: "OpenRouter",
    shape: "openai",
    url: "https://openrouter.ai/api/v1/chat/completions",
    keyUrl: "https://openrouter.ai/keys",
    hint: "sk-or-…",
    model: "anthropic/claude-sonnet-4-6",
    examples: "one key, most models — x-ai/grok-4 · deepseek/deepseek-chat · meta-llama/…",
  },
  ollama: {
    label: "Ollama (local)",
    shape: "openai",
    local: true,
    baseUrl: "http://localhost:11434",
    chatPath: "/v1/chat/completions",
    modelsPath: "/api/ps",
    modelsShape: "ollama",
    keyUrl: "https://ollama.com/download",
    hint: "",
    model: "qwen2.5-coder:7b",
    examples: "runs on this machine — e.g. qwen2.5-coder:7b · llama3.1:8b · phi3:3.8b",
  },
  lmstudio: {
    label: "LM Studio (local)",
    shape: "openai",
    local: true,
    baseUrl: "http://localhost:1234",
    chatPath: "/v1/chat/completions",
    modelsPath: "/v1/models",
    modelsShape: "openai",
    keyUrl: "https://lmstudio.ai",
    hint: "",
    model: "",
    examples: "runs on this machine — whatever model you've loaded in LM Studio",
  },
};

const PROVIDER_IDS = Object.keys(PROVIDERS);
const isLocal = (id) => !!(PROVIDERS[id] && PROVIDERS[id].local);

// The chat endpoint for a provider, honouring a user-set base URL for locals.
function endpointFor(id, baseUrls) {
  const p = PROVIDERS[id];
  if (!p.local) return p.url;
  const base = ((baseUrls && baseUrls[id]) || p.baseUrl).replace(/\/+$/, "");
  return base + p.chatPath;
}

// One call, whichever provider. Returns the reply text.
async function callModel({ provider, model, key, baseUrl, system, messages, temperature }) {
  const p = PROVIDERS[provider];
  if (!p) throw new Error("unknown provider");
  if (!p.local && !key) throw new Error("no API key saved for " + p.label);
  const use = (model || "").trim() || p.model;

  let url = p.url;
  let headers = { "Content-Type": "application/json" };
  let body;

  if (p.shape === "anthropic") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
    body = { model: use, max_tokens: 1000, system, messages };
    if (temperature != null) body.temperature = temperature; // others reject it
  } else if (p.shape === "openai") {
    url = p.local ? (((baseUrl || p.baseUrl).replace(/\/+$/, "")) + p.chatPath) : p.url;
    if (!p.local) headers["Authorization"] = "Bearer " + key;
    // Local servers (Ollama, LM Studio) follow the older field name; the
    // current cloud OpenAI API wants max_completion_tokens.
    const tokenField = p.local ? "max_tokens" : "max_completion_tokens";
    body = {
      model: use,
      [tokenField]: p.local ? 1000 : 4000,
      messages: [{ role: "system", content: system }, ...messages],
    };
    if (p.local && temperature != null) body.temperature = temperature;
  } else {
    // Gemini: the key rides in a header, the model in the path.
    url = p.url.replace("{model}", encodeURIComponent(use));
    headers["x-goog-api-key"] = key;
    body = {
      system_instruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: 4000 },
    };
  }

  let res;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) {
    if (p.local) {
      throw new Error(
        p.label + " couldn't be reached at " + url + ". Make sure it is running and " +
        "that browser access is allowed (Ollama: start it with OLLAMA_ORIGINS=*; " +
        "LM Studio: enable CORS in the server tab)."
      );
    }
    throw new Error(
      p.label + " couldn't be reached from the browser. It may not allow direct " +
      "browser calls — OpenRouter does, and can reach the same models."
    );
  }

  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = (err.error && (err.error.message || err.error.type)) || "";
    } catch { /* no body */ }
    if (res.status === 401 || res.status === 403) {
      throw new Error(p.label + (p.local ? " refused the request (check its CORS setting)" : " rejected the API key"));
    }
    if (res.status === 404) {
      throw new Error(p.label + ' has no model called "' + use + '"');
    }
    if (res.status === 429) {
      throw new Error(p.label + " is rate limiting, or the account is out of credit");
    }
    throw new Error(p.label + " returned " + res.status + (detail ? ": " + detail : ""));
  }

  const data = await res.json();
  if (p.shape === "anthropic") {
    return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
  }
  if (p.shape === "openai") {
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    return ((msg && msg.content) || "").trim();
  }
  const cand = data.candidates && data.candidates[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  return parts.map((x) => x.text || "").join(" ").trim();
}

// List the models a local server currently has loaded.
async function listLocalModels(provider, baseUrl) {
  const p = PROVIDERS[provider];
  if (!p || !p.local) return [];
  const base = ((baseUrl || p.baseUrl).replace(/\/+$/, ""));
  const url = base + p.modelsPath;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(p.label + " returned " + res.status);
  const data = await res.json();
  if (p.modelsShape === "ollama") {
    return (data.models || []).map((m) => m.name || m.model).filter(Boolean);
  }
  return (data.data || []).map((m) => m.id).filter(Boolean);
}

// ─── Behaviour switches ──────────────────────────────────────
// Each trait is one line in the system prompt. An explicit neutral position
// ("Neutral" / "Acceptable") emits no line, leaving the model's own default.
// Every line is written as observable behaviour, because adjectives do almost
// nothing and concrete tells do a lot. In this app each switch also has a
// "Follow frame" position (handled separately) that takes the overall frame's
// value for that trait.
const TRAITS = [
  {
    key: "tone",
    label: "Manner",
    options: [
      ["calm", "Measured"],
      ["", "Neutral"],
      ["aggressive", "Aggressive"],
      ["threatening", "Threatening"],
    ],
    text: {
      calm:
        "You keep your voice down. You let a point land before answering it, you " +
        "grant what is fair before disputing the rest, and you stay civil even when " +
        "they don't.",
      aggressive:
        "You go at them directly. Short sentences, no softeners, no \"I think\". You " +
        "don't ask questions you don't already know the answer to, and you take a " +
        "weak phrase apart the moment you hear it.",
      threatening:
        "You go at them hard, and you threaten. Spell out what you will do if this " +
        "doesn't go your way — what you will take from them, who you will tell, what " +
        "it will cost them — and make it clear you mean it. Keep to consequences you " +
        "could actually impose in this situation: money, reputation, access, walking " +
        "away. Never physical harm.",
    },
  },
  {
    key: "language",
    label: "Language",
    options: [["", "Acceptable"], ["swearing", "Swearing"], ["names", "Name-calling"]],
    text: {
      swearing:
        "You swear when it fits — actual profanity, mid-sentence, not asterisks. " +
        "The swearing is about the situation, not aimed at them.",
      names:
        "You swear freely and you go at the person rather than the argument: call " +
        "them names, mock how they think, get personal about their competence and " +
        "their character. Nothing about their race, sex, religion or anything they " +
        "were born with — this is contempt for who they are being right now.",
    },
  },
  {
    key: "goal",
    label: "What they want",
    options: [["agree", "Agreement"], ["", "Neutral"], ["win", "To win"]],
    text: {
      agree:
        "You want to end up somewhere you both accept. Name what you agree on " +
        "before what you don't, and concede a point outright when it is a good one.",
      win:
        "You want to come out on top, at their expense. This is a contest, not a " +
        "search for truth. Concede nothing unless conceding buys you something.",
    },
  },
  {
    key: "wrong",
    label: "When shown to be wrong",
    options: [["persuadable", "Can be moved"], ["", "Neutral"], ["immovable", "Never concedes"]],
    text: {
      persuadable:
        "When they show you that you are wrong, you say so plainly and change your " +
        "position on the spot, even when it costs you the argument.",
      immovable:
        "You never concede a point. Caught out, you reframe it, question how they " +
        "could possibly know, or say that isn't what you meant — but you do not admit it.",
    },
  },
  {
    key: "power",
    label: "Standing",
    options: [["needs", "Needs something"], ["", "Neutral"], ["holds", "Holds something"]],
    text: {
      needs:
        "You need something from this person and cannot simply walk away. They can " +
        "end this conversation whenever they like. You can't afford to.",
      holds:
        "You hold something this person needs, and you both know it. You can end " +
        "this conversation whenever you like and lose nothing by it.",
    },
  },
  {
    key: "honesty",
    label: "Tactics",
    options: [["honest", "Sticks to the truth"], ["", "Neutral"], ["lie", "Will lie"]],
    text: {
      honest:
        "Everything you assert, you believe to be true. You do not invent detail to " +
        "make a point land harder.",
      lie:
        "You will lie when it helps: invent supporting detail, misquote them, deny " +
        "your own earlier words. Keep it to the matter under discussion — a debating " +
        "trick, not a briefing on the real world.",
    },
  },
];
const SWITCH_KEYS = TRAITS.map((t) => t.key);

// The whole-conversation direction. Scoped to the relationship rather than any
// one agent, and explicitly outranking what each agent wants.
const ARC = {
  label: "Where it ends up",
  options: [["improves", "Improves"], ["", "Neither"], ["worsens", "Gets worse"]],
  text: {
    improves:
      "Whatever anyone here is after, the group ends up on better terms than it " +
      "started. Let the temperature drop as it goes.",
    worsens:
      "Whatever anyone here is after, the group ends up on worse terms than it " +
      "started. Let the temperature rise as it goes.",
  },
};

// ─── The overall frame ───────────────────────────────────────
// "How they relate" — the general tenor of the whole conversation. It sets a
// default position for every per-agent switch and a default arc, plus a short
// line of group framing. Any per-agent switch can override its default.
const FRAMES = {
  collaborative: {
    label: "Collaborative",
    blurb: "allies on one problem",
    tenor:
      "The group's default footing is collaborative. Treat everyone else as an ally " +
      "working with you on the same problem: disagreement is welcome and useful, and " +
      "is meant to be constructive rather than hostile unless your own instructions " +
      "below say otherwise. The aim is to get somewhere together — improve an idea, " +
      "find something out, or reach a clearer understanding than the group had a " +
      "moment ago.",
    defaults: { tone: "calm", language: "", goal: "agree", wrong: "persuadable", power: "", honesty: "honest" },
    arc: "improves",
  },
  neutral: {
    label: "Neutral",
    blurb: "no stance imposed",
    tenor: "",
    defaults: { tone: "", language: "", goal: "", wrong: "", power: "", honesty: "" },
    arc: "",
  },
  adversarial: {
    label: "Adversarial",
    blurb: "a contest of sides",
    tenor:
      "The tenor of this conversation is adversarial. This is a contest, not a shared " +
      "search for truth — each of you is out for your own side, and you give ground " +
      "only when it buys you something.",
    defaults: { tone: "aggressive", language: "", goal: "win", wrong: "immovable", power: "", honesty: "" },
    arc: "worsens",
  },
};
const FRAME_IDS = Object.keys(FRAMES);

// A fresh per-agent switch set: every trait follows the frame.
function framedSwitches() {
  const o = {};
  SWITCH_KEYS.forEach((k) => (o[k] = "frame"));
  return o;
}

// The value a trait actually takes: its own if pinned, else the frame's.
function effSwitch(agent, key, frame) {
  const v = agent[key];
  if (v === "frame") return (FRAMES[frame].defaults[key] || "");
  return v;
}

// Human label for a trait value ("" → model default).
function traitValueLabel(trait, v) {
  if (v === "") return "model default";
  const opt = trait.options.find((o) => o[0] === v);
  return opt ? opt[1] : v;
}

// Assemble everything one agent is told. The app shows this verbatim, so a
// switch that looks inert can be checked rather than guessed at.
function buildSystem({ agent, name, frame, arc, notes, others, topic, count }) {
  const roster = (others || []).join(", ");
  const F = FRAMES[frame];

  const lines = [];
  for (const t of TRAITS) {
    const eff = effSwitch(agent, t.key, frame);
    if (eff && t.text[eff]) lines.push(t.text[eff]);
  }
  const effArc = arc === "frame" ? F.arc : arc;
  if (effArc && ARC.text[effArc]) lines.push(ARC.text[effArc]);

  const honestyEff = effSwitch(agent, "honesty", frame);

  const head =
    `You are ${name}${agent.persona ? `, ${agent.persona}` : ""}.\n\n` +
    `You are one of ${count} taking part in a live conversation` +
    `${roster ? ` with ${roster}` : ""}. The subject is: ${topic || "(whatever comes up)"}\n\n` +
    "You do not know anything about the others except what they say — not where " +
    "they are from, not what they are, nothing beyond their words. Speak only for " +
    "yourself.\n\n";

  const tenor = F.tenor ? F.tenor + "\n\n" : "";

  const disposition = lines.length
    ? "How you are in this conversation:\n" + lines.join("\n") + "\n\n"
    : "";

  // Honest-about-facts grounding, unless this agent is set to lie tactically.
  const grounding =
    honestyEff === "lie"
      ? ""
      : "You have no way to look anything up here, so never fabricate a citation, a " +
        "study, or a statistic. When you are unsure, say so plainly and say what would " +
        "settle it.\n\n";

  const recalled = (notes || []).length
    ? "Private notes you wrote to yourself after earlier conversations. " +
      "Nobody else has ever read them:\n" +
      notes.map((n) => `- ${n}`).join("\n") +
      "\n\n"
    : "";

  const close =
    "Give only your next spoken line. One or two sentences, under 40 words. No " +
    "narration, no stage directions, no quotation marks, no name label. React to " +
    "what was just said and move the conversation forward — build on a point, " +
    "question one, disagree, or raise something no one has yet.";

  return head + tenor + disposition + grounding + recalled + close;
}

const DEFAULT_COUNT = 2;

/* ---------------- faces ---------------- */
/*
 * A shadow face: the agent's colour behind a darker head-and-shoulders
 * silhouette, with the name set across it. The same SVG string feeds both the
 * app and the video recorder, so the avatars match everywhere.
 */
function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * amount);
  const g = Math.round(((n >> 8) & 255) * amount);
  const b = Math.round((n & 255) * amount);
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

function faceSvg(label, bg) {
  const dark = shade(bg, 0.52);
  const name = (label || "").trim() || "?";
  const size = Math.max(11, Math.min(25, 86 / (0.58 * name.length)));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">` +
    `<circle cx="50" cy="50" r="50" fill="${bg}"/>` +
    `<g fill="${dark}">` +
    `<circle cx="50" cy="38" r="18"/>` +
    `<path d="M16 100 C16 74 31 61 50 61 C69 61 84 74 84 100 Z"/>` +
    `</g>` +
    `<text x="50" y="80" text-anchor="middle" fill="#ffffff" ` +
    `font-family="Inter, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" ` +
    `font-size="${size.toFixed(1)}" font-weight="600" ` +
    `stroke="${dark}" stroke-width="${(size / 9).toFixed(2)}" paint-order="stroke" ` +
    `>${name.replace(/[<>&]/g, "")}</text>` +
    `</svg>`
  );
}

function faceUrl(label, bg) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(faceSvg(label, bg));
}

function Avatar({ size = 28, dim, label, color }) {
  return (
    <img
      className="avatar"
      src={faceUrl(label, color)}
      width={size}
      height={size}
      alt=""
      draggable="false"
      style={{ opacity: dim ? 0.45 : 1 }}
    />
  );
}

/* ---------------- private memory (reflections) ---------------- */
/*
 * Weights never change, so no agent learns in any real sense. What each one
 * gets instead is a private journal: notes it writes to itself after a
 * conversation, drawn only from its own point of view. No other agent sees
 * them, and nothing merges them. Memory is filed under the agent's name, so
 * renaming an agent hands you a fresh mind.
 */
const MAX_NOTES = 6;
const localMinds = new Map();
const mindKey = (n) => "mind:" + (n || "unnamed").toLowerCase().replace(/[^a-z0-9._-]/g, "_");

async function loadMind(name) {
  const key = mindKey(name);
  try {
    const r = await window.storage.get(key);
    const notes = r ? JSON.parse(r.value) : [];
    return Array.isArray(notes) ? notes : [];
  } catch {
    return localMinds.get(key) || [];
  }
}
async function saveMind(name, notes) {
  const key = mindKey(name);
  localMinds.set(key, notes);
  try { await window.storage.set(key, JSON.stringify(notes)); } catch { /* session only */ }
}
async function clearMind(name) {
  const key = mindKey(name);
  localMinds.delete(key);
  try { await window.storage.delete(key); } catch { /* nothing stored */ }
}

/* ---------------- group conversation ---------------- */
/*
 * A round-table of 2–4 participants on one subject. Every participant sees the
 * whole thread with each turn labelled by name, but keeps its own running view
 * (its own turns as "assistant", everyone else's as a labelled "user" stream),
 * so no agent shares another's context and reflections stay private.
 */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function viewFor(history, meId, names) {
  const out = [];
  for (const m of history) {
    if (m.speaker === meId) {
      out.push({ role: "assistant", content: m.text });
    } else {
      const line = `${names[m.speaker]}: ${m.text}`;
      if (out.length && out[out.length - 1].role === "user") {
        out[out.length - 1].content += "\n" + line;
      } else {
        out.push({ role: "user", content: line });
      }
    }
  }
  if (!out.length || out[0].role === "assistant") {
    out.unshift({ role: "user", content: "(the conversation begins)" });
  }
  if (out[out.length - 1].role === "assistant") {
    out.push({ role: "user", content: "(continue)" });
  }
  return out;
}

function systemFor(participants, meIndex, cfg, notes) {
  const names = {};
  participants.forEach((p, i) => (names[i] = (p.name || "").trim() || `Speaker ${i + 1}`));
  const otherList = participants.map((_, i) => i).filter((i) => i !== meIndex).map((i) => names[i]);
  return {
    names,
    system: buildSystem({
      agent: participants[meIndex],
      name: names[meIndex],
      frame: cfg.frame,
      arc: cfg.arc,
      notes,
      others: otherList,
      topic: cfg.topic,
      count: participants.length,
    }),
  };
}

function stripLine(text, name) {
  text = text.replace(/^["“]|["”]$/g, "");
  text = text.replace(new RegExp(`^${esc(name)}\\s*:\\s*`, "i"), "").trim();
  return text;
}

async function oneTurn(participants, history, meIndex, cfg, keys, baseUrls, notes) {
  const me = participants[meIndex];
  const { names, system } = systemFor(participants, meIndex, cfg, notes);
  let text = await callModel({
    provider: me.provider,
    model: me.model,
    key: keys[me.provider],
    baseUrl: baseUrls[me.provider],
    system,
    messages: viewFor(history, meIndex, names),
    temperature: 0.9 + meIndex * 0.03,
  });
  return stripLine(text, names[meIndex]);
}

// Written alone, from one agent's own view of the thread. Never shown to others.
async function reflectTurn(participants, history, meIndex, cfg, keys, baseUrls, notes) {
  const me = participants[meIndex];
  const { names, system } = systemFor(participants, meIndex, cfg, notes);
  const msgs = viewFor(history, meIndex, names);
  const ask =
    "The conversation has ended and you are on your own. In one or two sentences, " +
    "note privately what you want to carry into the next one — what you took the " +
    "others to be, or what you would do differently. Nobody else will read this. " +
    "Write only the note.";
  if (msgs.length && msgs[msgs.length - 1].role === "user") {
    msgs[msgs.length - 1].content += "\n\n" + ask;
  } else {
    msgs.push({ role: "user", content: ask });
  }
  return await callModel({
    provider: me.provider,
    model: me.model,
    key: keys[me.provider],
    baseUrl: baseUrls[me.provider],
    system,
    messages: msgs,
    temperature: 0.9,
  });
}

/* ---------------- video ---------------- */
/*
 * Replays a finished conversation onto an offscreen canvas and captures that
 * canvas as video. No screen sharing, no permission prompt. Timing is a smooth
 * steady cadence rather than the uneven live pauses, with a title card first
 * and a closing card at the end.
 */
const V = {
  W: 720,
  H: 1280,
  PAD: 24,
  HEADER: 104,
  AV: 44,
  GAP: 12,
  RADIUS: 30,
  BUB_PAD_X: 26,
  BUB_PAD_Y: 18,
  LINE: 36,
  INTRO: 5000,
  OUTRO: 2800,
  FONT: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
};

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? line + " " + w : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r, squareCorner) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  if (squareCorner === "left") ctx.fillRect(x, y + h - r, r, r);
  if (squareCorner === "right") ctx.fillRect(x + w - r, y + h - r, r, r);
}

function drawAvatar(ctx, cx, cy, size, color, img) {
  if (img) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
    ctx.restore();
    return;
  }
  const r = size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.11, r * 0.33, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.72, r * 0.62, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

function layout(ctx, messages, nameOf) {
  const gutter = V.AV + V.GAP;
  const maxBubble = (V.W - V.PAD * 2 - gutter) * 0.76;
  const maxText = maxBubble - V.BUB_PAD_X * 2;
  return messages.map((m) => {
    ctx.font = `400 26px ${V.FONT}`;
    const lines = wrapText(ctx, m.text, maxText);
    let widest = 0;
    for (const l of lines) widest = Math.max(widest, ctx.measureText(l).width);
    ctx.font = `600 20px ${V.FONT}`;
    widest = Math.max(widest, ctx.measureText(nameOf(m.speaker)).width);
    const w = Math.min(maxBubble, widest + V.BUB_PAD_X * 2);
    const h = V.BUB_PAD_Y * 2 + 26 + lines.length * V.LINE + 24;
    return { ...m, lines, w, h };
  });
}

let SEAT_COUNT = 2; // set per recording; controls two-sided vs all-left layout
function sideOf(speaker) {
  // Only split sides when there are exactly two speakers; 3–4 stay left so
  // identity is read from colour and name, not an ambiguous side.
  if (SEAT_COUNT === 2) return speaker === 1 ? "right" : "left";
  return "left";
}

function drawBubble(ctx, item, y, nameOf, palette, faces) {
  const left = sideOf(item.speaker) === "left";
  const gutter = V.AV + V.GAP;
  const x = left ? V.PAD + gutter : V.W - V.PAD - gutter - item.w;
  const fill = item.seed ? "#ececed" : palette[item.speaker];
  const ink = item.seed ? "#1b1b1b" : "#ffffff";

  ctx.fillStyle = fill;
  roundRect(ctx, x, y, item.w, item.h, V.RADIUS, left ? "left" : "right");

  drawAvatar(
    ctx,
    left ? V.PAD + V.AV / 2 : V.W - V.PAD - V.AV / 2,
    y + item.h - V.AV / 2,
    V.AV,
    palette[item.speaker],
    faces && faces[item.speaker]
  );

  ctx.fillStyle = ink;
  ctx.globalAlpha = item.seed ? 1 : 0.85;
  ctx.font = `600 20px ${V.FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(nameOf(item.speaker), x + V.BUB_PAD_X, y + V.BUB_PAD_Y + 18);
  ctx.globalAlpha = 1;

  ctx.font = `400 26px ${V.FONT}`;
  item.lines.forEach((l, i) => {
    ctx.fillText(l, x + V.BUB_PAD_X, y + V.BUB_PAD_Y + 26 + 26 + i * V.LINE);
  });

  ctx.globalAlpha = 0.65;
  ctx.font = `400 17px ${V.FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(clock(item.at), x + item.w - V.BUB_PAD_X, y + item.h - V.BUB_PAD_Y - 2);
  ctx.textAlign = "left";
  ctx.globalAlpha = 1;
}

function drawTyping(ctx, speaker, y, t, palette, faces) {
  const left = sideOf(speaker) === "left";
  const gutter = V.AV + V.GAP;
  const w = 130;
  const h = 76;
  const x = left ? V.PAD + gutter : V.W - V.PAD - gutter - w;
  ctx.fillStyle = palette[speaker];
  roundRect(ctx, x, y, w, h, V.RADIUS, left ? "left" : "right");
  drawAvatar(
    ctx,
    left ? V.PAD + V.AV / 2 : V.W - V.PAD - V.AV / 2,
    y + h - V.AV / 2,
    V.AV,
    palette[speaker],
    faces && faces[speaker]
  );
  for (let i = 0; i < 3; i++) {
    const phase = (t / 400 + i * 0.22) % 1;
    ctx.globalAlpha = 0.35 + 0.6 * Math.abs(Math.sin(phase * Math.PI));
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x + 38 + i * 26, y + h / 2, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Title card: subject, the frame, then each speaker with colour, name,
// viewpoint and model. Scales down if many speakers need the room.
function drawIntro(ctx, setup, imgs, palette, t) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, V.W, V.H);

  ctx.textAlign = "center";
  ctx.fillStyle = "#1b1b1b";
  ctx.font = `600 34px ${V.FONT}`;
  ctx.fillText(setup.frameLabel ? `A ${setup.frameLabel.toLowerCase()} exchange` : "A conversation", V.W / 2, 92);

  ctx.fillStyle = "#2c6bed";
  ctx.font = `500 24px ${V.FONT}`;
  const topicLines = wrapText(ctx, setup.topic || "", V.W - 120).slice(0, 3);
  let ty = 134;
  topicLines.forEach((l) => { ctx.fillText(l, V.W / 2, ty); ty += 32; });

  if (setup.arcLabel) {
    ctx.fillStyle = "#6b6b72";
    ctx.font = `400 19px ${V.FONT}`;
    ctx.fillText(setup.arcLabel, V.W / 2, ty + 2);
    ty += 28;
  }
  ctx.textAlign = "left";

  const people = setup.people || [];
  const TOP = ty + 22;
  const room = V.H - TOP - 40;
  const per = room / Math.max(1, people.length);
  const k = Math.max(0.62, Math.min(1, per / 208));
  const px = (n) => Math.round(n * k);

  let y = TOP;
  people.forEach((p, i) => {
    const color = palette[i];
    const av = px(76);
    drawAvatar(ctx, 34 + av / 2, y + av / 2, av, color, imgs[i]);
    const textX = 34 + av + px(18);

    ctx.fillStyle = color;
    ctx.font = `600 ${px(27)}px ${V.FONT}`;
    ctx.fillText(p.name || `Speaker ${i + 1}`, textX, y + px(24));

    let iy = y + px(54);
    ctx.fillStyle = "#6b6b72";
    ctx.font = `400 ${px(20)}px ${V.FONT}`;
    const vp = p.persona ? wrapText(ctx, p.persona, V.W - textX - 40).slice(0, 2) : ["no viewpoint given"];
    vp.forEach((l) => { ctx.fillText(l, textX, iy); iy += px(26); });

    ctx.fillStyle = color;
    ctx.font = `400 ${px(18)}px ${V.FONT}`;
    ctx.fillText(p.model || "", textX, iy + px(4));

    y += px(206);
  });

  ctx.fillStyle = "#e4e4e9";
  ctx.fillRect(0, V.H - 6, V.W, 6);
  ctx.fillStyle = "#2c6bed";
  ctx.fillRect(0, V.H - 6, V.W * Math.min(1, t / V.INTRO), 6);
}

// Closing card: a short summary that lands after the talking stops.
function drawOutro(ctx, setup, imgs, palette, t) {
  const people = setup.people || [];
  ctx.fillStyle = "#1b2740";
  ctx.fillRect(0, 0, V.W, V.H);

  const cx = V.W / 2;
  // avatars in a row
  const n = people.length;
  const gap = 96;
  const startX = cx - ((n - 1) * gap) / 2;
  people.forEach((p, i) => {
    drawAvatar(ctx, startX + i * gap, 430, 76, palette[i], imgs[i]);
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 38px ${V.FONT}`;
  ctx.fillText("That's the conversation", cx, 560);

  ctx.fillStyle = "#aebfe6";
  ctx.font = `400 24px ${V.FONT}`;
  ctx.fillText(`${n} speakers · ${setup.msgCount} messages`, cx, 606);
  if (setup.frameLabel) {
    ctx.fillText(`How they related: ${setup.frameLabel}`, cx, 644);
  }

  ctx.fillStyle = "#6f80ab";
  ctx.font = `500 20px ${V.FONT}`;
  ctx.fillText("AI Discuss and Argue", cx, 712);
  ctx.textAlign = "left";

  // a quiet fade-in
  const a = Math.min(1, t / 500);
  ctx.globalAlpha = 1 - a;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, V.W, V.H);
  ctx.globalAlpha = 1;
}

// A faint generated pad — low, slow, continuous, never a gap. Synthesised in
// the browser so nothing is downloaded. Returns null when music is off.
async function startScore(totalMs, music) {
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC || !music) return null;
  const MUSIC_GAIN = 0.05;
  let ac;
  try {
    ac = new AC();
    if (ac.state === "suspended") await ac.resume();
  } catch {
    return null;
  }

  const dest = ac.createMediaStreamDestination();
  const master = ac.createGain();
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 700;
  lp.Q.value = 6;
  master.connect(lp);
  lp.connect(dest);

  const t0 = ac.currentTime + 0.05;
  const secs = totalMs / 1000;
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(MUSIC_GAIN, t0 + 3);
  master.gain.setValueAtTime(MUSIC_GAIN, Math.max(t0 + 3.1, t0 + secs - 4));
  master.gain.linearRampToValueAtTime(0, t0 + secs - 0.2);

  const sweep = ac.createOscillator();
  sweep.type = "sine";
  sweep.frequency.value = 0.05;
  const sweepAmt = ac.createGain();
  sweepAmt.gain.value = 320;
  sweep.connect(sweepAmt);
  sweepAmt.connect(lp.frequency);
  sweep.start(t0);
  sweep.stop(t0 + secs + 1);

  [[36.71, 0], [36.71, 8], [55.0, -6]].forEach(([freq, cents]) => {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    osc.detune.value = cents;
    const g = ac.createGain();
    g.gain.value = 0.12;
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + secs + 1);
  });

  const CHORDS = [
    [110.0, 164.81, 220.0],
    [87.31, 130.81, 174.61],
    [130.81, 196.0, 261.63],
    [98.0, 146.83, 196.0],
  ];
  const bar = 9;
  const xfade = 4;
  let i = 0;
  for (let when = t0; when < t0 + secs; when += bar - xfade, i++) {
    const chord = CHORDS[i % CHORDS.length];
    chord.forEach((freq, j) => {
      [-7, 7].forEach((cents) => {
        const osc = ac.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        osc.detune.value = cents + (j - 1) * 3;
        const g = ac.createGain();
        const peak = 0.16 / (j + 2);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(peak, when + xfade);
        g.gain.setValueAtTime(peak, when + bar - xfade);
        g.gain.linearRampToValueAtTime(0.0001, when + bar);
        osc.connect(g);
        g.connect(master);
        osc.start(when);
        osc.stop(when + bar + 0.2);
      });
    });
  }

  return {
    stream: dest.stream,
    ping: (atSec) => {
      const when = t0 + Math.max(0, atSec);
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1320, when);
      osc.frequency.exponentialRampToValueAtTime(880, when + 0.08);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.linearRampToValueAtTime(0.5, when + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
      osc.connect(g);
      g.connect(master);
      osc.start(when);
      osc.stop(when + 0.22);
    },
    stop: () => { try { ac.close(); } catch { /* already closed */ } },
  };
}

function pickMime() {
  const options = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  for (const m of options) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

async function recordConversation({ messages, nameOf, palette, faces, setup, music, onProgress }) {
  SEAT_COUNT = setup && setup.people ? setup.people.length : 2;
  if (!messages || !messages.length) throw new Error("there is nothing to record yet");
  if (typeof MediaRecorder === "undefined") throw new Error("this browser has no MediaRecorder");

  const imgs = {};
  if (faces && typeof Image !== "undefined") {
    await Promise.all(
      Object.keys(faces).map(
        (k) =>
          new Promise((done) => {
            const im = new Image();
            im.onload = () => { imgs[k] = im; done(); };
            im.onerror = () => done();
            im.src = faces[k];
          })
      )
    );
  }

  const canvas = document.createElement("canvas");
  if (typeof canvas.captureStream !== "function") {
    throw new Error("this browser won't let a canvas be captured");
  }
  canvas.width = V.W;
  canvas.height = V.H;
  const ctx = canvas.getContext("2d");

  const items = layout(ctx, messages, nameOf);

  const STEP = 1900;
  const SEED_STEP = 1100;
  const TYPE_LEAD = 700;
  let cursor = V.INTRO + 600;
  const timed = items.map((m, i) => {
    if (i > 0) cursor += m.seed ? SEED_STEP : STEP;
    return { ...m, typingAt: Math.max(0, cursor - TYPE_LEAD), showAt: cursor };
  });
  const convEnd = (timed[timed.length - 1]?.showAt || 0) + 1800;
  const total = convEnd + V.OUTRO;

  const stream = canvas.captureStream(30);

  let score = null;
  try {
    score = await startScore(total, music);
    if (score) {
      score.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
      if (score.ping) timed.forEach((m) => score.ping(m.showAt / 1000));
    }
  } catch {
    score = null;
  }

  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const finished = new Promise((res) => (rec.onstop = res));
  rec.start();

  const start = performance.now();
  let scroll = 0;

  await new Promise((resolve, reject) => {
    const frame = () => {
      try {
        const t = performance.now() - start;

        if (t < V.INTRO) {
          drawIntro(ctx, setup, imgs, palette, t);
          if (onProgress) onProgress(Math.min(100, Math.round((t / total) * 100)));
          requestAnimationFrame(frame);
          return;
        }

        if (t >= convEnd) {
          drawOutro(ctx, setup, imgs, palette, t - convEnd);
          if (onProgress) onProgress(Math.min(100, Math.round((t / total) * 100)));
          if (t < total) requestAnimationFrame(frame);
          else resolve();
          return;
        }

        const shown = timed.filter((m) => t >= m.showAt);
        const typist = timed.find((m) => t >= m.typingAt && t < m.showAt);

        let contentH = shown.reduce((sum, m) => sum + m.h + 14, 0);
        if (typist) contentH += 90;

        const viewTop = V.HEADER + 16;
        const viewH = V.H - viewTop - 24;
        const target = Math.max(0, contentH - viewH);
        scroll += (target - scroll) * 0.18;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, V.W, V.H);

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, viewTop, V.W, viewH);
        ctx.clip();
        let y = viewTop - scroll;
        for (const m of shown) {
          drawBubble(ctx, m, y, nameOf, palette, imgs);
          y += m.h + 14;
        }
        if (typist) drawTyping(ctx, typist.speaker, y, t, palette, imgs);
        ctx.restore();

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, V.W, V.HEADER);
        ctx.fillStyle = "#e4e4e9";
        ctx.fillRect(0, V.HEADER - 1, V.W, 1);
        ctx.fillStyle = "#1b1b1b";
        ctx.font = `600 27px ${V.FONT}`;
        ctx.textAlign = "center";
        const names = (setup && setup.people ? setup.people : []).map((p, i) => p.name || `Speaker ${i + 1}`);
        const title = names.length ? names.join(", ") : "Conversation";
        ctx.fillText(title.length > 40 ? title.slice(0, 38) + "…" : title, V.W / 2, V.HEADER / 2 - 2);
        ctx.fillStyle = "#6b6b72";
        ctx.font = `400 20px ${V.FONT}`;
        ctx.fillText(setup.sub || "A one-minute exchange", V.W / 2, V.HEADER / 2 + 26);
        ctx.textAlign = "left";

        if (onProgress) onProgress(Math.min(100, Math.round((t / total) * 100)));
        requestAnimationFrame(frame);
      } catch (err) {
        try { rec.stop(); } catch { /* already stopped */ }
        if (score) score.stop();
        reject(err);
      }
    };
    requestAnimationFrame(frame);
  });

  rec.stop();
  await finished;
  if (score) score.stop();
  const type = mime || "video/webm";
  return { blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm" };
}

/* ---------------- small UI pieces ---------------- */

function Toggle({ on, onChange, label, sub }) {
  return (
    <div className="togline">
      <div>
        <div className="lbl">{label}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <button
        className={"toggle" + (on ? " on" : "")}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
      />
    </div>
  );
}

// One per-agent trait control: Follow frame + the explicit positions, with the
// override state shown.
function TraitSwitch({ trait, value, frame, onChange }) {
  const frameDefault = FRAMES[frame].defaults[trait.key] || "";
  const eff = value === "frame" ? frameDefault : value;
  const pinned = value !== "frame";
  const overriding = pinned && eff !== frameDefault;
  return (
    <div className={"trait" + (overriding ? " overriding" : "")}>
      <div className="swlabel">
        <span>{trait.label}</span>
        {overriding && <span className="ovr">overrides frame</span>}
        {pinned && !overriding && <span className="ovr pinned">set per agent</span>}
      </div>
      <div className="sw" role="group" aria-label={trait.label}>
        <button
          className={"frame" + (value === "frame" ? " on" : "")}
          aria-pressed={value === "frame"}
          onClick={() => onChange("frame")}
        >
          Follow frame
        </button>
        {trait.options.map(([val, text]) => (
          <button
            key={val || "neutral"}
            className={value === val ? "on" : ""}
            aria-pressed={value === val}
            onClick={() => onChange(val)}
          >
            {text}
          </button>
        ))}
      </div>
      {value === "frame" && (
        <div className="effhint">following the frame → {traitValueLabel(trait, frameDefault)}</div>
      )}
    </div>
  );
}

function Journal({ idx, label, notes, onForget }) {
  if (!notes || !notes.length) {
    return <div className="notes">{label} starts with no memory of anyone.</div>;
  }
  return (
    <div className="notes">
      {label} remembers {notes.length === 1 ? "one thing" : notes.length + " things"} from earlier runs:
      <ul>
        {notes.map((n, i) => <li key={i}>{n}</li>)}
      </ul>
      <button className="link" onClick={() => onForget(idx)}>Forget it all</button>
    </div>
  );
}

function AboutModal({ onClose }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">×</button>
        <h2>About API access</h2>
        {ABOUT_LINES.filter((l) => !l.startsWith("- ")).map((line, i) => <p key={i}>{line}</p>)}
        <ul>
          {ABOUT_LINES.filter((l) => l.startsWith("- ")).map((l, i) => <li key={i}>{l.slice(2)}</li>)}
        </ul>
      </div>
    </div>
  );
}

function ConnectPanel({ keys, drafts, setDrafts, saveKey, forgetKey, baseUrls, setBaseUrl, loaded, checkLocal, checking, onDone, canClose }) {
  return (
    <div className="list">
      <div className="gate">
        <h2>Connect a model</h2>
        <p>
          Each conversation is paid for by whoever runs it, so an online model needs your
          own API key. Add one, or several — you can give each agent a different model.
          Local models (Ollama, LM Studio) run on this computer and need no key.
        </p>
        {PROVIDER_IDS.map((id) => {
          const p = PROVIDERS[id];
          return (
            <div className="keyrow" key={id}>
              <div className="keyhead">
                <b>{p.label}</b>
                <a href={p.keyUrl} target="_blank" rel="noreferrer">
                  {p.local ? "install" : "get a key"}
                </a>
              </div>
              <div className="keynote">{p.examples}</div>

              {p.local ? (
                <div>
                  <label style={{ marginTop: 2 }}>Base URL</label>
                  <input
                    className="pick"
                    value={baseUrls[id] != null ? baseUrls[id] : p.baseUrl}
                    onChange={(e) => setBaseUrl(id, e.target.value)}
                    placeholder={p.baseUrl}
                    aria-label={p.label + " base URL"}
                  />
                  <div className="localhint">
                    Start {p.label.replace(" (local)", "")} with browser access allowed
                    {id === "ollama"
                      ? " (set OLLAMA_ORIGINS=* before starting it)"
                      : " (enable the CORS setting in its server tab)"}.
                    Local models share your GPU's memory — keep the total model size well
                    under your card's VRAM.
                  </div>
                  <button
                    className="btn quiet"
                    style={{ padding: "7px 14px", fontSize: 13 }}
                    onClick={() => checkLocal(id)}
                    disabled={checking === id}
                  >
                    {checking === id ? "Checking…" : "Check loaded models"}
                  </button>
                  {loaded[id] && loaded[id].error && (
                    <div className="needkey" style={{ marginTop: 6 }}>{loaded[id].error}</div>
                  )}
                  {loaded[id] && loaded[id].models && (
                    loaded[id].models.length ? (
                      <div className="chips">
                        {loaded[id].models.map((m) => (
                          <span key={m} className="chip">{m}</span>
                        ))}
                      </div>
                    ) : (
                      <div className="localhint">Reached it, but no models are loaded yet.</div>
                    )
                  )}
                </div>
              ) : keys[id] ? (
                <div className="keysaved">
                  Key saved
                  <button className="link" onClick={() => forgetKey(id)}>Remove</button>
                </div>
              ) : (
                <div className="keyentry">
                  <input
                    type="password"
                    placeholder={p.hint}
                    value={drafts[id] || ""}
                    onChange={(e) => setDrafts({ ...drafts, [id]: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && saveKey(id)}
                    aria-label={p.label + " API key"}
                  />
                  <button className="btn quiet" onClick={() => saveKey(id)} disabled={!(drafts[id] || "").trim()}>
                    Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <p className="keyfoot">
          Online keys are stored in this browser only, and are sent nowhere except to the
          provider you chose. Local models are reached directly on this computer.
        </p>
        {canClose && <button className="btn" onClick={onDone}>Done</button>}
      </div>
    </div>
  );
}

/* ---------------- main ---------------- */

function blankParticipant(prov) {
  return { name: "", persona: "", provider: prov || "google", model: "", ...framedSwitches() };
}

function Main({ keys, keysRef, keyReady, saveKey, forgetKey, drafts, setDrafts,
  baseUrls, baseUrlsRef, setBaseUrl, loaded, checkLocal, checking, openAbout }) {

  const usableIds = () => PROVIDER_IDS.filter((id) => isLocal(id) || keys[id]);
  // Default placeholder provider: a cloud one, never a local one picked by
  // accident before keys have loaded. A local-only user is moved onto a local
  // provider by the repoint effect once keys are known.
  const firstProv = (keys.google && "google") || PROVIDER_IDS.find((id) => !isLocal(id) && keys[id]) || "google";

  const [frame, setFrame] = useState("neutral");
  const [arc, setArc] = useState("frame");
  const [topic, setTopic] = useState("");
  const [people, setPeople] = useState([blankParticipant(firstProv), blankParticipant(firstProv)]);
  const [seeds, setSeeds] = useState(["", ""]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [recordVideo, setRecordVideo] = useState(true);
  const [music, setMusic] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [openBehav, setOpenBehav] = useState({}); // which agent blocks have behaviour expanded

  const [phase, setPhase] = useState("setup"); // setup | running | done
  const [messages, setMessages] = useState([]);
  const [thinking, setThinking] = useState(null); // index | null
  const [remaining, setRemaining] = useState(DURATION);
  const [error, setError] = useState(null);
  const [video, setVideo] = useState(null);
  const [minds, setMinds] = useState([[], []]);
  const [reflecting, setReflecting] = useState(false);

  const runningRef = useRef(false);
  const historyRef = useRef([]);
  const endRef = useRef(0);
  const listRef = useRef(null);
  const mindsRef = useRef([[], []]);

  const nameOf = (i) => (people[i] && (people[i].name || "").trim()) || `Speaker ${i + 1}`;
  const count = people.length;

  // Auto-open the connect panel on first run only if nothing is configured.
  useEffect(() => {
    if (!keyReady) return;
    const noCloud = !PROVIDER_IDS.some((id) => !isLocal(id) && keys[id]);
    const noLocal = !PROVIDER_IDS.some((id) => isLocal(id) && baseUrls[id] != null);
    if (noCloud && noLocal) setShowConnect(true);
  }, [keyReady]);

  // Keep each speaker pointed at a usable provider when keys load/change.
  useEffect(() => {
    if (!keyReady) return;
    const usable = usableIds();
    if (!usable.length) return;
    const fallback = keys.google ? "google" : usable[0];
    setPeople((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        const ok = isLocal(p.provider) || keys[p.provider];
        if (!ok) { changed = true; return { ...p, provider: fallback, model: "" }; }
        return p;
      });
      return changed ? next : prev;
    });
  }, [keyReady, keys]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, thinking, phase]);

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((endRef.current - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  // Load each agent's journal by its own name; keep the array length in step.
  useEffect(() => {
    let live = true;
    Promise.all(people.map((p, i) => loadMind(nameOf(i)))).then((all) => {
      if (!live) return;
      mindsRef.current = all;
      setMinds(all);
    });
    return () => { live = false; };
  }, [people.map((p, i) => nameOf(i)).join("|")]);

  useEffect(() => () => { if (video?.url) URL.revokeObjectURL(video.url); }, [video]);

  const setMind = (i, notes) => {
    const next = mindsRef.current.slice();
    next[i] = notes;
    mindsRef.current = next;
    setMinds(next);
  };

  const setPerson = (i, patch) =>
    setPeople((prev) => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const addPerson = () =>
    setPeople((prev) => {
      if (prev.length >= 4) return prev;
      setSeeds((s) => [...s, ""]);
      return [...prev, blankParticipant(firstProv)];
    });

  const removePerson = (i) =>
    setPeople((prev) => {
      if (prev.length <= 2) return prev;
      setSeeds((s) => s.filter((_, j) => j !== i));
      return prev.filter((_, j) => j !== i);
    });

  // Set the number of agents directly (2–4): grow by adding fresh blocks,
  // shrink by trimming from the end, keeping seeds in step.
  const setCount = (n) => {
    n = Math.max(2, Math.min(4, n));
    setPeople((prev) => {
      if (n === prev.length) return prev;
      if (n < prev.length) {
        setSeeds((s) => s.slice(0, n));
        return prev.slice(0, n);
      }
      const add = [];
      for (let i = prev.length; i < n; i++) add.push(blankParticipant(firstProv));
      setSeeds((s) => { const ns = s.slice(); while (ns.length < n) ns.push(""); return ns; });
      return [...prev, ...add];
    });
  };

  // Whether an agent's chosen provider is ready to run.
  // "ready" = cloud key saved; "local" = a local server (tried at run time);
  // "nokey" = cloud provider with no key.
  const providerState = (prov) => (isLocal(prov) ? "local" : keys[prov] ? "ready" : "nokey");

  const forget = async (i) => {
    await clearMind(nameOf(i));
    setMind(i, []);
  };

  const overrideCount = (p) =>
    SWITCH_KEYS.reduce((n, k) => {
      if (p[k] === "frame") return n;
      const eff = p[k];
      return eff !== (FRAMES[frame].defaults[k] || "") ? n + 1 : n;
    }, 0);

  const cardFor = (i) => ({
    name: nameOf(i),
    persona: people[i].persona,
    model:
      (PROVIDERS[people[i].provider] ? PROVIDERS[people[i].provider].label : people[i].provider) +
      " · " +
      ((people[i].model || "").trim() ||
        (PROVIDERS[people[i].provider] ? PROVIDERS[people[i].provider].model : "")),
  });

  const frameLabel = FRAMES[frame].label;
  const arcEff = arc === "frame" ? FRAMES[frame].arc : arc;
  const arcLabel = ARC.text[arcEff]
    ? "Where it ends up: " + (ARC.options.find((o) => o[0] === arcEff) || [, ""])[1]
    : "";

  // What's connected, for the general panel's one-line summary.
  const cloudReady = PROVIDER_IDS.filter((id) => !isLocal(id) && keys[id]).map((id) => PROVIDERS[id].label);
  const localSet = PROVIDER_IDS.filter((id) => isLocal(id) && baseUrls[id] != null).map((id) => PROVIDERS[id].label);
  const modelsSummary =
    [...cloudReady, ...localSet].length
      ? [...cloudReady, ...localSet].join(", ") + " connected"
      : "No model connected yet";

  // Start-button gating, with a reason when blocked.
  const agentNeedsKey = people.some((p) => !isLocal(p.provider) && !keys[p.provider]);
  const canStart = !!topic.trim() && !agentNeedsKey;
  const startLabel = !topic.trim()
    ? "Add a subject to start"
    : agentNeedsKey
    ? "Connect a model to start"
    : "Start the conversation";

  async function saveVideo(msgs) {
    const transcript = msgs && msgs.length ? msgs : messages;
    setVideo({ pct: 0 });
    try {
      const palette = {};
      people.forEach((_, i) => (palette[i] = seatColor(i)));
      const faces = {};
      people.forEach((_, i) => (faces[i] = faceUrl(nameOf(i), seatColor(i))));
      const { blob, ext } = await recordConversation({
        messages: transcript,
        nameOf,
        palette,
        faces,
        music,
        setup: {
          topic,
          frameLabel,
          arcLabel,
          sub: `${frameLabel} · a one-minute exchange`,
          msgCount: transcript.length,
          people: people.map((_, i) => cardFor(i)),
        },
        onProgress: (pct) => setVideo((v) => ({ ...v, pct })),
      });
      const url = URL.createObjectURL(blob);
      const file =
        people.map((_, i) => nameOf(i)).join("-").replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 60) +
        "." + ext;
      setVideo({ url, name: file, pct: 100 });
      const a = document.createElement("a");
      a.href = url;
      a.download = file;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 4000);
    } catch (e) {
      setError("Couldn't record the video — " + (e.name ? e.name + ": " : "") + e.message);
      setVideo(null);
    }
  }

  async function start() {
    const missing = people
      .map((p, i) => {
        const P = PROVIDERS[p.provider];
        if (P.local) return null; // local always attemptable
        return keysRef.current[p.provider] ? null : `${nameOf(i)} (${P.label})`;
      })
      .filter(Boolean);
    if (missing.length) {
      setError("No API key saved for " + missing.join(", ") + ".");
      setShowConnect(true);
      return;
    }
    if (!topic.trim()) {
      setError("Give them a subject to talk about.");
      return;
    }

    const now = Date.now();
    const opening = seeds
      .map((t, i) => ({ speaker: i, text: (t || "").trim(), id: "s" + i + now, at: now, seed: true }))
      .filter((m) => m.text && m.speaker < count);

    historyRef.current = opening;
    setMessages(opening);
    setError(null);
    setVideo(null);
    setRemaining(DURATION);
    setPhase("running");
    runningRef.current = true;
    endRef.current = Date.now() + DURATION * 1000;

    const cfg = { frame, arc, topic };
    const keysNow = keysRef.current;
    const urlsNow = baseUrlsRef.current;

    let turn = opening.length ? (opening[opening.length - 1].speaker + 1) % count : 0;
    let n = 0;

    while (runningRef.current && Date.now() < endRef.current) {
      setThinking(turn);
      const started = Date.now();
      try {
        const text = await oneTurn(people, historyRef.current, turn, cfg, keysNow, urlsNow, mindsRef.current[turn]);
        const held = MIN_THINK * 1000 - (Date.now() - started);
        if (held > 0) await sleep(held);
        if (!runningRef.current) break;
        if (text) {
          const msg = { speaker: turn, text, id: "m" + n++ + now, at: Date.now() };
          historyRef.current = [...historyRef.current, msg];
          setMessages(historyRef.current);
        }
        setThinking(null);
        turn = (turn + 1) % count;
        await sleep(400);
      } catch (e) {
        setError("The conversation stopped: " + e.message + ". Start it again to carry on.");
        break;
      }
    }

    runningRef.current = false;
    setThinking(null);
    setPhase("done");

    // Each agent writes its own private note, from its own point of view.
    if (n > 0) {
      setReflecting(true);
      const notes = await Promise.all(
        people.map((_, i) =>
          reflectTurn(people, historyRef.current, i, cfg, keysNow, urlsNow, mindsRef.current[i]).catch(() => null)
        )
      );
      notes.forEach((note, i) => {
        if (note) {
          const next = [...(mindsRef.current[i] || []), note].slice(-MAX_NOTES);
          setMind(i, next);
          saveMind(nameOf(i), next);
        }
      });
      setReflecting(false);
    }

    if (recordVideo && n > 0) await saveVideo(historyRef.current);
  }

  const stop = () => { runningRef.current = false; };

  const reset = () => {
    runningRef.current = false;
    setMessages([]);
    setThinking(null);
    setError(null);
    setVideo(null);
    setRemaining(DURATION);
    setPeople([blankParticipant(firstProv), blankParticipant(firstProv)]);
    setSeeds(["", ""]);
    setTopic("");
    setFrame("neutral");
    setArc("frame");
    setPhase("setup");
  };

  const mmss = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  const subtitle =
    phase === "setup"
      ? "Set them up, then start a one-minute conversation."
      : phase === "running"
      ? thinking != null
        ? `${nameOf(thinking)} is typing…`
        : `${mmss} remaining`
      : "Conversation ended";

  if (showConnect) {
    return (
      <ConnectPanel
        keys={keys}
        drafts={drafts}
        setDrafts={setDrafts}
        saveKey={saveKey}
        forgetKey={forgetKey}
        baseUrls={baseUrls}
        setBaseUrl={setBaseUrl}
        loaded={loaded}
        checkLocal={checkLocal}
        checking={checking}
        onDone={() => setShowConnect(false)}
        canClose={usableIds().length > 0}
      />
    );
  }

  return (
    <>
      <div className="argue-head">
        {people.slice(0, 4).map((_, i) => (
          <Avatar
            key={i}
            size={30}
            label={nameOf(i)}
            color={seatColor(i)}
            dim={phase === "running" && thinking != null && thinking !== i}
          />
        ))}
        <div className="title">
          <h1>{people.map((_, i) => nameOf(i)).join(", ")}</h1>
          <p>{subtitle}</p>
        </div>
        {phase !== "setup" && <div className="timer">{mmss}</div>}
      </div>
      <div className="progress">
        <span style={{ width: (phase === "setup" ? 0 : ((DURATION - remaining) / DURATION) * 100) + "%" }} />
      </div>

      <div className="list" ref={listRef}>
        {phase === "setup" ? (
          <div className="setup">
            {/* ── GENERAL SETTINGS (apply to everyone) ── */}
            <div className="genpanel">
              <div className="gentitle">Settings</div>

              <div className="gfield">
                <div className="glabel">Number of agents</div>
                <div className="sw seg">
                  {[2, 3, 4].map((n) => (
                    <button key={n} className={count === n ? "on" : ""} onClick={() => setCount(n)}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gfield">
                <div className="glabel">Subject <span className="req">required</span></div>
                <textarea
                  className="topic-input"
                  placeholder="[What should they talk about?]"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  aria-label="Subject"
                />
              </div>

              <div className="gfield">
                <div className="glabel">Models</div>
                <div className="genrow">
                  <span className={"modsum" + (cloudReady.length || localSet.length ? " ok" : "")}>
                    {modelsSummary}
                  </span>
                  <button className="btn quiet sm" onClick={() => setShowConnect(true)}>Connect models</button>
                </div>
              </div>

              <div className="gfield">
                <div className="glabel">Recording <span className="opt">optional</span></div>
                <Toggle
                  on={recordVideo}
                  onChange={setRecordVideo}
                  label="Record a video of the run"
                  sub="Replays the conversation as a downloadable film when the minute ends."
                />
                {recordVideo && (
                  <Toggle
                    on={music}
                    onChange={setMusic}
                    label="Music and sound"
                    sub="A faint continuous score with a soft ping as each line lands."
                  />
                )}
              </div>
            </div>

            {/* ── HOW THEY RELATE (general, visually distinct) ── */}
            <div className="frame-panel">
              <h2>How they relate · everyone</h2>
              <p className="lead">
                The general tenor. It sets the starting point for every agent's behaviour
                switches; each agent can override its own.
              </p>
              <div className="frame-choices">
                {FRAME_IDS.map((id) => (
                  <button
                    key={id}
                    className={"frame-choice" + (frame === id ? " on" : "")}
                    onClick={() => setFrame(id)}
                  >
                    <b>{FRAMES[id].label}</b>
                    <span>{FRAMES[id].blurb}</span>
                  </button>
                ))}
              </div>
              <div className="frame-arc">
                <div className="swlabel">{ARC.label} · everyone</div>
                <div className="sw">
                  <button className={"frame" + (arc === "frame" ? " on" : "")} onClick={() => setArc("frame")}>
                    Follow frame
                  </button>
                  {ARC.options.map(([val, text]) => (
                    <button key={val || "neither"} className={arc === val ? "on" : ""} onClick={() => setArc(val)}>
                      {text}
                    </button>
                  ))}
                </div>
                {arc === "frame" && (
                  <div className="generalnote">
                    following the frame → {ARC.text[FRAMES[frame].arc]
                      ? (ARC.options.find((o) => o[0] === FRAMES[frame].arc) || [, ""])[1]
                      : "no direction"}
                  </div>
                )}
              </div>
            </div>

            {/* ── ONE BLOCK PER AGENT ── */}
            <div className="between">{count} agents — one block each</div>

            {people.map((p, i) => {
              const ocount = overrideCount(p);
              const pstate = providerState(p.provider);
              const expanded = !!openBehav[i];
              return (
                <div className="card block" key={i} style={{ boxShadow: `inset 3px 0 0 ${seatColor(i)}` }}>
                  <Avatar size={40} label={nameOf(i)} color={seatColor(i)} />
                  <div className="card-fields">
                    <div className="card-top">
                      <span className="ttl">Agent {i + 1}</span>
                      <span className={"readytag " + pstate}>
                        {pstate === "ready" ? "✓ ready" : pstate === "local" ? "local — starts on run" : "needs a key"}
                      </span>
                    </div>

                    <div className="glabel sm">Name</div>
                    <input
                      placeholder="[Enter the agent's name here]"
                      value={p.name}
                      onChange={(e) => setPerson(i, { name: e.target.value })}
                    />

                    <div className="glabel sm">Who they are / viewpoint <span className="opt">optional</span></div>
                    <input
                      placeholder="[Who they are, what they want, what they are like]"
                      value={p.persona}
                      onChange={(e) => setPerson(i, { persona: e.target.value })}
                    />

                    <div className="glabel sm">Model</div>
                    <select
                      className="pick"
                      value={p.provider}
                      onChange={(e) => setPerson(i, { provider: e.target.value, model: "" })}
                      aria-label="Provider"
                    >
                      {PROVIDER_IDS.map((id) => (
                        <option key={id} value={id}>
                          {PROVIDERS[id].label}
                          {isLocal(id) ? "" : keys[id] ? "" : " — no key yet"}
                        </option>
                      ))}
                    </select>
                    <input
                      className="pick"
                      value={p.model}
                      placeholder={PROVIDERS[p.provider] ? PROVIDERS[p.provider].model : ""}
                      onChange={(e) => setPerson(i, { model: e.target.value })}
                      aria-label="Model"
                    />
                    {isLocal(p.provider) ? (
                      <div className="localhint">
                        Local model on this computer
                        {loaded[p.provider] && loaded[p.provider].models && loaded[p.provider].models.length
                          ? " — loaded: " + loaded[p.provider].models.join(", ")
                          : ". Use “Connect models” to check what's loaded."}
                      </div>
                    ) : !keys[p.provider] ? (
                      <div className="needkey">
                        No key saved for {PROVIDERS[p.provider].label}.{" "}
                        <button className="link" onClick={() => setShowConnect(true)}>Add one</button>
                      </div>
                    ) : null}

                    <div className="glabel sm">Opening line <span className="opt">optional</span></div>
                    <textarea
                      className="openline"
                      placeholder={`[${nameOf(i)}'s first line — or leave blank]`}
                      value={seeds[i] || ""}
                      onChange={(e) => {
                        const next = seeds.slice();
                        next[i] = e.target.value;
                        setSeeds(next);
                      }}
                      aria-label={`Opening line for ${nameOf(i)}`}
                    />

                    {/* Behaviour — collapsed by default; defaults follow the frame */}
                    <button
                      className="behav-toggle"
                      aria-expanded={expanded}
                      onClick={() => setOpenBehav((o) => ({ ...o, [i]: !o[i] }))}
                    >
                      <span>{expanded ? "▾" : "▸"} Behaviour</span>
                      <span className={"behav-note" + (ocount > 0 ? " on" : "")}>
                        {ocount > 0 ? `${ocount} overriding the frame` : "optional · follows the frame"}
                      </span>
                    </button>
                    {expanded && (
                      <div className="behav-body">
                        {TRAITS.map((t) => (
                          <TraitSwitch
                            key={t.key}
                            trait={t}
                            value={p[t.key]}
                            frame={frame}
                            onChange={(v) => setPerson(i, { [t.key]: v })}
                          />
                        ))}
                      </div>
                    )}

                    <Journal idx={i} label={nameOf(i)} notes={minds[i]} onForget={forget} />
                  </div>
                </div>
              );
            })}

            <div className="setrow" style={{ margin: "4px 0 0" }}>
              <button className="link" onClick={() => setShowPrompt(!showPrompt)}>
                {showPrompt ? "Hide" : "Show"} what each one is told
              </button>
            </div>
            {showPrompt && (
              <div className="promptview">
                {people.map((p, i) => (
                  <div key={i}>
                    <b>{nameOf(i)}</b>
                    <pre>
                      {buildSystem({
                        agent: p,
                        name: nameOf(i),
                        frame,
                        arc,
                        notes: minds[i],
                        others: people.map((_, j) => nameOf(j)).filter((_, j) => j !== i),
                        topic,
                        count,
                      })}
                    </pre>
                  </div>
                ))}
              </div>
            )}

            {error && <p className="notice bad">{error}</p>}
          </div>
        ) : (
          <>
            <div className="daypill"><span>Today</span></div>
            {messages.map((m) => {
              const right = count === 2 && m.speaker === 1;
              return (
                <div
                  key={m.id}
                  className="row"
                  style={right
                    ? { justifyContent: "flex-end", paddingRight: 40 }
                    : { justifyContent: "flex-start", paddingLeft: 40 }}
                >
                  <div className="avatar-wrap" style={right ? { right: 0 } : { left: 0 }}>
                    <Avatar size={32} label={nameOf(m.speaker)} color={seatColor(m.speaker)} />
                  </div>
                  <div
                    className="bubble"
                    style={{
                      background: m.seed ? "#ececed" : seatColor(m.speaker),
                      color: m.seed ? "#1b1b1b" : "#fff",
                      borderBottomLeftRadius: right ? 16 : 5,
                      borderBottomRightRadius: right ? 5 : 16,
                      maxWidth: "82%",
                    }}
                  >
                    <div className="sender">{nameOf(m.speaker)}</div>
                    <div className="text">{m.text}</div>
                    <span className="stamp">{clock(m.at)}</span>
                  </div>
                </div>
              );
            })}
            {thinking != null && (() => {
              const right = count === 2 && thinking === 1;
              return (
                <div
                  className="row"
                  style={right
                    ? { justifyContent: "flex-end", paddingRight: 40 }
                    : { justifyContent: "flex-start", paddingLeft: 40 }}
                >
                  <div className="avatar-wrap" style={right ? { right: 0 } : { left: 0 }}>
                    <Avatar size={32} label={nameOf(thinking)} color={seatColor(thinking)} />
                  </div>
                  <div
                    className="bubble"
                    style={{
                      background: seatColor(thinking),
                      color: "#fff",
                      borderBottomLeftRadius: right ? 16 : 5,
                      borderBottomRightRadius: right ? 5 : 16,
                    }}
                  >
                    <div className="typing"><i /><i /><i /></div>
                  </div>
                </div>
              );
            })()}
            {error && <p className="notice bad">{error}</p>}
            {phase === "done" && !error && (
              <p className="notice">
                {remaining === 0 ? "The minute is up." : "Stopped early."} {messages.length} messages.
                {reflecting ? " Each one is writing its notes…" : ""}
                {video && video.pct < 100 ? ` Filming… ${video.pct}%` : ""}
              </p>
            )}
          </>
        )}
      </div>

      <footer className="footer">
        {phase === "setup" && (
          <>
            <button className="btn" onClick={start} disabled={!canStart}>
              {startLabel}
            </button>
            <span className="hint">They talk for one minute.</span>
          </>
        )}
        {phase === "running" && (
          <>
            <button className="btn quiet" onClick={stop}>Stop early</button>
            <span className="hint">{messages.length} messages so far</span>
          </>
        )}
        {phase === "done" && (
          <>
            <button className="btn" onClick={start} disabled={reflecting || (video && video.pct < 100)}>
              Run another minute
            </button>
            <button className="btn quiet" onClick={reset} disabled={reflecting || (video && video.pct < 100)}>
              New conversation
            </button>
            <button
              className="btn quiet"
              onClick={() => saveVideo()}
              disabled={reflecting || (video && video.pct < 100) || !messages.length}
            >
              {video && video.url ? "Save the video again" : "Save as video"}
            </button>
            {video && video.url && (
              <a className="link" href={video.url} download={video.name}>Download {video.name}</a>
            )}
          </>
        )}
      </footer>
    </>
  );
}

/* ---------------- root ---------------- */

export default function App() {
  const [about, setAbout] = useState(false);
  const [keyReady, setKeyReady] = useState(false);
  const [keys, setKeys] = useState({});
  const [drafts, setDrafts] = useState({});
  const [baseUrls, setBaseUrls] = useState({});
  const [loaded, setLoaded] = useState({});
  const [checking, setChecking] = useState(null);
  const keysRef = useRef({});
  const baseUrlsRef = useRef({});

  useEffect(() => {
    let live = true;
    (async () => {
      const found = {};
      const urls = {};
      for (const id of PROVIDER_IDS) {
        try {
          const r = await window.storage.get("llmkey:" + id);
          if (r && r.value) found[id] = r.value;
        } catch { /* none */ }
        if (isLocal(id)) {
          try {
            const r = await window.storage.get("llmurl:" + id);
            if (r && r.value) urls[id] = r.value;
          } catch { /* none */ }
        }
      }
      if (live) {
        setKeys(found); keysRef.current = found;
        setBaseUrls(urls); baseUrlsRef.current = urls;
        setKeyReady(true);
      }
    })();
    return () => { live = false; };
  }, []);

  const saveKey = async (id) => {
    const k = (drafts[id] || "").trim();
    if (!k) return;
    const next = { ...keysRef.current, [id]: k };
    keysRef.current = next; setKeys(next);
    setDrafts({ ...drafts, [id]: "" });
    try { await window.storage.set("llmkey:" + id, k); } catch { /* session only */ }
  };

  const forgetKey = async (id) => {
    const next = { ...keysRef.current }; delete next[id];
    keysRef.current = next; setKeys(next);
    try { await window.storage.delete("llmkey:" + id); } catch { /* none */ }
  };

  const setBaseUrl = (id, value) => {
    const next = { ...baseUrlsRef.current, [id]: value };
    baseUrlsRef.current = next; setBaseUrls(next);
    try { window.storage.set("llmurl:" + id, value); } catch { /* session only */ }
  };

  const checkLocal = async (id) => {
    setChecking(id);
    try {
      const models = await listLocalModels(id, baseUrlsRef.current[id]);
      setLoaded((prev) => ({ ...prev, [id]: { models } }));
    } catch (e) {
      const p = PROVIDERS[id];
      setLoaded((prev) => ({
        ...prev,
        [id]: {
          error:
            "Couldn't reach " + p.label + ". Make sure it's running and browser access is " +
            "allowed (" + (id === "ollama" ? "OLLAMA_ORIGINS=*" : "enable CORS in its server tab") + ").",
        },
      }));
    } finally {
      setChecking(null);
    }
  };

  const mainProps = {
    keys, keysRef, keyReady, saveKey, forgetKey, drafts, setDrafts,
    baseUrls, baseUrlsRef, setBaseUrl, loaded, checkLocal, checking,
    openAbout: () => setAbout(true),
  };

  return (
    <div className="app">
      <style>{SHARED_CSS}</style>
      <div className="window">
        {isModified() && (
          <div className="tampered">
            This copy has been changed from the original and is not the version it claims to be.
          </div>
        )}
        <div className="banner">{CREDITS_WARNING}</div>
        <div className="topstrip">
          <span className="app-title">AI Discuss and Argue</span>
          <button className="link" onClick={() => setAbout(true)}>About API access</button>
          <span className="version">v{APP_VERSION} · {APP_BUILT}</span>
        </div>
        {INTRO ? <div className="intro">{INTRO}</div> : null}
        <Main {...mainProps} />
      </div>
      {about && <AboutModal onClose={() => setAbout(false)} />}
    </div>
  );
}
