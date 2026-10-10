import 'dotenv/config';
import { readFileSync } from 'node:fs';

function bool(v, dflt) {
  if (v === undefined || v === null || v === '') return dflt;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

function int(v, dflt) {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : dflt;
}

/** Digits-only list from a comma-separated env value (numbers or JIDs). */
function numberList(v) {
  return String(v || '')
    .split(',')
    .map((s) => s.trim().split('@')[0].split(':')[0].replace(/[^0-9]/g, ''))
    .filter(Boolean);
}

let version = '0.0.0';
try {
  version = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ).version;
} catch {
  /* keep default */
}

const config = {
  version,
  botName: process.env.BOT_NAME || 'Cosmic WA Bot',
  authMethod: (process.env.AUTH_METHOD || 'qr').toLowerCase(),
  botNumber: (process.env.BOT_NUMBER || '').replace(/[^0-9]/g, ''),
  prefix: process.env.PREFIX || '!',
  authDir: process.env.AUTH_DIR || 'auth',
  pluginsDir: process.env.PLUGINS_DIR || 'plugins',
  stateFile: process.env.STATE_FILE || 'data/state.json',
  hotReload: bool(process.env.HOT_RELOAD, true),
  logLevel: process.env.LOG_LEVEL || 'info',

  // Owners: OWNER_NUMBER (digits, comma-separated) plus legacy OWNERS (JIDs).
  ownerName: process.env.OWNER_NAME || '',
  owners: [...new Set([...numberList(process.env.OWNER_NUMBER), ...numberList(process.env.OWNERS)])],

  // Optional web server: /health always; /qr and /pair only with WEB_TOKEN.
  webServer: bool(process.env.WEB_SERVER, true),
  port: int(process.env.PORT, 3000),
  webToken: process.env.WEB_TOKEN || '',

  // Third-party API keys. Each feature disables itself cleanly when unset.
  groqApiKey: process.env.GROQ_API_KEY || '',
  groqModel: process.env.GROQ_MODEL || '',
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY || '',

  // Network timeout for every outbound HTTP call (ms).
  httpTimeoutMs: int(process.env.HTTP_TIMEOUT_MS, 20_000),
};

export function validateConfig() {
  const errors = [];
  if (!['qr', 'pairing'].includes(config.authMethod)) {
    errors.push(`AUTH_METHOD must be "qr" or "pairing" (got "${config.authMethod}")`);
  }
  if (config.authMethod === 'pairing' && !config.botNumber) {
    errors.push('AUTH_METHOD=pairing requires BOT_NUMBER (digits incl. country code).');
  }
  if (!config.prefix || /\s/.test(config.prefix)) {
    errors.push('PREFIX must be a non-empty string with no spaces.');
  }
  if (config.port < 1 || config.port > 65535) {
    errors.push(`PORT must be 1-65535 (got ${config.port}).`);
  }
  return errors;
}

/** Digits of a JID's user part (handles "123:4@s.whatsapp.net"). */
export function jidNumber(jid) {
  return String(jid || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

export default config;
