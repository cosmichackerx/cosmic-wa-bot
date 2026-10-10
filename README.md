# Cosmic WA Bot

A stable, plug-and-play WhatsApp bot built on
[Baileys](https://github.com/WhiskeySockets/Baileys). It supports **both** login
methods (QR code and pairing code), survives disconnects with automatic
reconnection, and lets you add features by **dropping a file into a folder** — no
code edits required.

> Built for reliability: an unhandled error in a plugin is caught and logged, and
> the bot reconnects on its own. No code can promise a literal zero-failure rate
> (networks drop, WhatsApp changes), so this focuses on **auto-recovery** —
> nothing routine takes the process down.

## Features

- ✅ **Dual login** — QR code in the terminal *or* an 8-digit pairing code.
- 🔌 **Plug-and-play plugins** — every `.js` file in `plugins/` becomes a command.
  Optional **hot-reload**: add or edit a plugin while the bot runs.
- ♻️ **Auto-reconnect** — exponential backoff with jitter; re-links only on a real
  `loggedOut`, so transient drops recover silently.
- 🛡️ **Crash-resistant** — message handling is wrapped in `try/catch`, plus
  top-level `uncaughtException` / `unhandledRejection` guards.
- 🤫 **Quiet by default** — Baileys' noisy logs are silenced; you control the app
  log level.
- ⚙️ **Config via `.env`** — nothing secret is committed; `auth/` is git-ignored.
- 🧪 **Tested** — unit tests for the loader (mocked socket) and a syntax check
  across every file; CI on Node 18/20/22.

## Requirements

- Node.js **>= 18**
- A WhatsApp account to link (phone with WhatsApp installed)

## Quick start

```bash
git clone https://github.com/cosmichackerx/cosmic-wa-bot.git
cd cosmic-wa-bot
npm install
cp .env.example .env     # edit as needed
npm start
```

## Login methods

Set `AUTH_METHOD` in `.env`.

### 1. QR code (default)

```env
AUTH_METHOD=qr
```

Run `npm start`. A QR code is printed in the terminal. On your phone open
**WhatsApp → Linked devices → Link a device** and scan it.

### 2. Pairing code

```env
AUTH_METHOD=pairing
BOT_NUMBER=923001234567   # your number, country code first, digits only
```

Run `npm start`. The bot prints an 8-digit code like `ABCD-EFGH`. On your phone
open **WhatsApp → Linked devices → Link with phone number** and enter it.

Either way, the session is saved in `auth/` (git-ignored). You only link once;
later restarts reuse the saved session.

## Writing a plugin (the plug-and-play part)

Create a new file in `plugins/`, e.g. `plugins/time.js`:

```js
export default {
  name: 'time',                       // unique id (defaults to filename)
  description: 'Shows the current time',
  command: 'time',                    // a string or an array of strings
  // pattern: /^what time/i,          // optional: trigger without a prefix
  // adminOnly: true,                 // optional: restrict to OWNERS
  async execute(ctx) {
    await ctx.reply('🕒 ' + new Date().toString());
  },
};
```

Save it. With `HOT_RELOAD=true` it registers instantly; otherwise restart. That's
it — the loader auto-discovers every `.js` file on startup.

### The `ctx` object passed to `execute`

| Field | Description |
| --- | --- |
| `ctx.sock` | The live Baileys socket. |
| `ctx.msg` | The raw incoming message. |
| `ctx.from` | Chat JID the message came from. |
| `ctx.sender` | JID of the actual sender (useful in groups). |
| `ctx.text` | Full message text. |
| `ctx.args` | Words after the command, e.g. `!echo a b` → `['a','b']`. |
| `ctx.command` | The command name that matched. |
| `ctx.prefix` | The configured command prefix. |
| `ctx.plugins` | The live plugin manager (used by `help`). |
| `ctx.reply(text|content)` | Replies, quoting the user's message. |
| `ctx.logger` | Shared pino logger. |

### Bundled example plugins

| Command | What it does |
| --- | --- |
| `!ping` | Replies `pong`. |
| `!echo <text>` / `!say` | Echoes your text back. |
| `!help` / `!menu` | Lists every loaded plugin. |
| `hi` / `hello` / `hey` | Pattern plugin — greets back without a prefix. |

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `AUTH_METHOD` | `qr` | `qr` or `pairing`. |
| `BOT_NUMBER` | — | Required for pairing; country code first, digits only. |
| `PREFIX` | `!` | Command prefix. |
| `AUTH_DIR` | `auth` | Where credentials are stored (git-ignored). |
| `PLUGINS_DIR` | `plugins` | Folder the loader scans. |
| `HOT_RELOAD` | `true` | Reload plugins on file add/change. |
| `LOG_LEVEL` | `info` | `fatal`…`trace` or `silent`. |
| `OWNERS` | — | Comma-separated JIDs allowed to run `adminOnly` plugins (empty = everyone). |

## Scripts

```bash
npm start      # run the bot
npm run dev    # run with --watch (restart on source change)
npm run check  # node --check across every .js file
npm test       # unit tests (node:test)
```

## Deployment

- **Docker:** `docker build -t cosmic-wa-bot . && docker run -it -v $(pwd)/auth:/app/auth cosmic-wa-bot`
  (the volume keeps your session). Do the first link interactively.
- **Render:** `render.yaml` defines a worker with a persistent disk for `auth/`.

## Troubleshooting

- **Keeps asking to scan / `loggedOut`:** the session was invalidated. Delete the
  `auth/` folder and link again.
- **Pairing code never appears:** make sure `BOT_NUMBER` is set, digits only, with
  the country code, and `AUTH_METHOD=pairing`.
- **`Connection closed` loops:** usually transient; the bot backs off and retries.
  If it persists, update Baileys (`npm update @whiskeysockets/baileys`).
- **Plugin didn't load:** check the startup log for a `failed to load plugin`
  line — it names the file and the error.
- **Nothing happens on a command:** confirm your `PREFIX` and that the plugin's
  `command` matches what you typed.

## Security

- `auth/`, `.env`, `node_modules/`, and credential/session files are git-ignored.
- Never commit your `auth/` folder or `.env` — they grant access to your account.

## License

[MIT](LICENSE) © cosmichackerx
