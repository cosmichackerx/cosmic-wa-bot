# Changelog

## v0.2.1 — 2026-10-10

### Removed
- WhatsApp-side `!shutdown` / `!off` / `!restart` commands. Process lifecycle
  is host-only (SIGINT/SIGTERM, process manager). Owner live control now
  covers only `!plugin` / `!feature` on/off/list (still persisted).

## v0.2.0 — 2026-10-10

### Added
- Ported legitimate features from `cosmichackerx/X-Bot`, rewritten as ESM
  plugins against this bot's API:
  `menu`, `calculator`, `weather`, `groq`, `pollai`, `profile`, `systeminfo`,
  `antidelete`, `autostatus`, `autotyping`, `vcf`.
- Owner live control plugin (`control`): `!plugin on/off/list`, `!feature …`.
  Runtime enable/disable is persisted in `data/state.json` (git-ignored) and
  survives restarts. (WhatsApp shutdown/restart commands were removed in
  v0.2.1.)
- Polished dynamic `!menu` / `!help` grouped by each plugin's `category`.
- Optional Express keep-alive server (`/`, `/health`) with token-gated
  `/qr` and `/pair` endpoints (adapted from X-Bot's `lib/server.js`).
- Pure calculator core (`src/calc.js`) with unit tests.
- Config knobs: `OWNER_NUMBER`, `BOT_NAME`, `GROQ_API_KEY`,
  `OPENWEATHER_API_KEY`, `WEB_SERVER`, `WEB_TOKEN`, `STATE_FILE`,
  `HTTP_TIMEOUT_MS`, `AUTO_TYPING`, `AUTO_STATUS_REACT`.

### Hardened
- Plugin loader now supports `listen()` background handlers, categories,
  `hidden`, and runtime enable/disable with persistence.
- Every plugin and the message handler wrapped so one failure can't kill the
  process. Network calls (weather / groq / pollai) use AbortController
  timeouts. Missing API keys disable the feature with a clear reply.
- Baileys socket uses `makeCacheableSignalKeyStore`, `syncFullHistory: false`,
  exponential reconnect with jitter, and refuses to reconnect after a real
  logout.
- `vcf` is owner-only and capped at 200 contacts.
- `.env` / `auth/` / `data/` / `node_modules/` stay git-ignored.

### Excluded (by design)
- All nuke / spam / blast / mass-sender / phone-scan plugins from X-Bot.
- `automation.js` (auto-spams a hardcoded group).

## v0.1.0 — 2026-10-10

- Initial release: Baileys 6.7.24, QR + pairing login, hot-reload plugin
  loader, ping / echo / help / hello, Dockerfile, Render config, CI.
