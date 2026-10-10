# Cosmic WA Bot

A **stable, plug-and-play WhatsApp bot** built on
[`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys).

- Dual login: **QR code** *or* **pairing code**
- Drop-a-file **plugin system** with hot-reload
- Owner live control from WhatsApp (`!plugin on/off/list` — no remote shutdown)
- Polished dynamic `!menu` grouped by category
- Auto-reconnect with backoff, process-level crash guards, graceful shutdown
- Optional web keep-alive (`/health`) + token-gated QR / pairing endpoints

> Built for legitimate use. Abusive / spam / nuke / phone-scan features from
> other bots were **deliberately not ported**.

## Quick start

```bash
git clone https://github.com/cosmichackerx/cosmic-wa-bot.git
cd cosmic-wa-bot
cp .env.example .env
# edit .env — at minimum set OWNER_NUMBER to your digits (country code, no +)
npm install
npm start
```

### Login

| `AUTH_METHOD` | How it works |
|---|---|
| `qr` (default) | A QR is printed in the terminal (and at `/qr?token=…` if `WEB_TOKEN` is set). Scan it in **WhatsApp → Linked devices → Link a device**. |
| `pairing` | Set `BOT_NUMBER` (digits + country code). The bot prints a pairing code; enter it under **Linked devices → Link with phone number**. You can also hit `/pair?token=…&phone=…`. |

Credentials land in `auth/` (git-ignored). Delete that folder to re-link.

## Commands (plugins)

Every plugin is a single `.js` file in `plugins/`. The menu is generated live
from whatever is loaded — add a file, and it appears under its `category`.

### Core
| Command | Description |
|---|---|
| `!menu` / `!help` | Polished, category-grouped command list |
| `!ping` | Latency check |
| `!echo <text>` | Echo text back |
| `!systeminfo` | Host RAM / CPU / uptime (no IP) |
| *(pattern)* `hi` / `hello` / `hey` | Friendly greeting (no prefix) |

### Tools
| Command | Description |
|---|---|
| `!calc <expr>` | Scientific calculator (`sin`, `sqrt`, `log`, `pi`, …) |
| `!weather <city> [daily]` | Current weather or 5-day forecast (needs `OPENWEATHER_API_KEY`) |
| `!profile [@user\|reply\|number]` | Profile picture, about, WA status |

### AI
| Command | Description |
|---|---|
| `!groq <q>` / `!ai` | Groq LLM chat (needs `GROQ_API_KEY`). Flags: `--smart`, `--fast`, `--mixtral`, `--gemma` |
| `!pollai <prompt>` | Free image gen via Pollinations. Flags: `--anime`, `--realistic`, `--3d`, `--digital`, `--portrait`, `--landscape` |

### Admin (owner-only 🔒)
| Command | Description |
|---|---|
| `!plugin list` | Show every plugin and its on/off state |
| `!plugin on/off <name>` | Enable / disable a plugin **live** (persisted in `data/state.json`) |
| `!feature …` | Alias of `!plugin` |
| `!vcf` | Export **this group's** members as a VCF (capped at 200, owner-only) |

### Background listeners (no command; toggleable)
| Plugin | What it does |
|---|---|
| `antidelete` | Forwards "delete for everyone" messages to the owner |
| `autostatus` | Auto-views statuses (optional reaction via `AUTO_STATUS_REACT=true`) |
| `autotyping` | Optional typing/recording presence (`AUTO_TYPING=true`) |

## Owner live control

Set `OWNER_NUMBER` (digits, country code, comma-separated for several owners).
Without it, control commands refuse to run — so a public bot can't be reconfigured
by strangers.

```
!plugin list
!plugin off weather
!plugin on weather
```

> There is **no** WhatsApp command to shut down or restart the process.
> Stop the bot from your host (Ctrl+C, `systemctl`, Render dashboard, etc.).

Disabled plugins stop matching commands **and** stop their listeners. The
choice is written to `data/state.json` (git-ignored) and reloaded on the next
start. The `control` plugin itself cannot be disabled (that would lock you out).

## Adding a plugin

Drop a file into `plugins/`. Hot-reload picks it up with no restart.

```js
// plugins/greet.js
export default {
  name: 'greet',
  description: 'Greets a person by name',
  category: 'Fun',                 // shows up under this heading in !menu
  command: ['greet', 'hi-user'],   // !greet Alice
  // pattern: /^yo\b/i,            // or match without a prefix
  // adminOnly: true,              // restrict to OWNER_NUMBER
  // hidden: true,                 // hide from !menu
  async execute(ctx) {
    const who = ctx.args[0] || 'friend';
    await ctx.reply(`👋 Hey ${who}!`);
  },
  // Optional: run on EVERY message (status, deletes, etc.)
  // async listen(ctx) { … }
};
```

`ctx` gives you `sock`, `msg`, `from`, `sender`, `args`, `prefix`, `plugins`,
`bot`, `config`, `isOwner`, `reply()`, `react()`, and `logger`. Wrap your own
logic in `try/catch` — the bot already isolates plugin failures so one bad
plugin cannot crash the process.

## Environment

See [`.env.example`](./.env.example). Important keys:

| Variable | Purpose |
|---|---|
| `AUTH_METHOD` | `qr` or `pairing` |
| `BOT_NUMBER` | Required for pairing login |
| `OWNER_NUMBER` | Owner phone(s); gates admin commands |
| `PREFIX` | Command prefix (default `!`) |
| `GROQ_API_KEY` | Enables `!groq` |
| `OPENWEATHER_API_KEY` | Enables `!weather` |
| `WEB_SERVER` / `PORT` | Keep-alive HTTP server (default on, port 3000) |
| `WEB_TOKEN` | If set, unlocks `/qr` and `/pair` |
| `STATE_FILE` | Where plugin on/off state is saved |
| `HTTP_TIMEOUT_MS` | Timeout for outbound HTTP (default 20000) |

Features that need a key **disable themselves with a clear reply** when the key
is missing — they never crash the bot.

## Deploy

- **Local / VPS:** `npm start`
- **Docker:** `docker build -t cosmic-wa-bot . && docker run --env-file .env -p 3000:3000 cosmic-wa-bot`
- **Render:** `render.yaml` is included; set env vars in the dashboard. `/health` is the health check.

## Development

```bash
npm run check   # node --check on every .js file
npm test        # plugin loader + calculator unit tests
npm run dev     # node --watch
```

## What was deliberately NOT ported

From `cosmichackerx/X-Bot`, the following were inspected and **excluded by
design** (they attack, spam, or mass-enumerate other people):

`bannuke`, `chatnuke`, `stealthchatnuke`, `mentionnuke`, `spamflood`, `blast`,
`jumpblast`, `randomswarm`, `sender`, `gridscan`, `sequentialscan`,
`patternhunt`, `neighbours`, `carrierhunt`, `subdomain`.

`automation.js` was also skipped: it auto-spams hardcoded commands (`#w`,
`#d all`, `#daily`) into a fixed group JID on timers — not benign scheduling.

## License

MIT © cosmichackerx
