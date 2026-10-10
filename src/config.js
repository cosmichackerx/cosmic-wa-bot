import 'dotenv/config';

function bool(v, dflt) {
  if (v === undefined || v === null || v === '') return dflt;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

const config = {
  authMethod: (process.env.AUTH_METHOD || 'qr').toLowerCase(),
  botNumber: (process.env.BOT_NUMBER || '').replace(/[^0-9]/g, ''),
  prefix: process.env.PREFIX || '!',
  authDir: process.env.AUTH_DIR || 'auth',
  pluginsDir: process.env.PLUGINS_DIR || 'plugins',
  hotReload: bool(process.env.HOT_RELOAD, true),
  logLevel: process.env.LOG_LEVEL || 'info',
  owners: (process.env.OWNERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

export function validateConfig() {
  const errors = [];
  if (!['qr', 'pairing'].includes(config.authMethod)) {
    errors.push(`AUTH_METHOD must be "qr" or "pairing" (got "${config.authMethod}")`);
  }
  if (config.authMethod === 'pairing' && !config.botNumber) {
    errors.push('AUTH_METHOD=pairing requires BOT_NUMBER (digits incl. country code).');
  }
  return errors;
}

export default config;
