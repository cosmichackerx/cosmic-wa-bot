import pino from 'pino';
import config from './config.js';

// A single shared, lightweight logger. Baileys itself is kept near-silent in
// bot.js; the app and plugins log through this at the configured level.
const logger = pino({ level: config.logLevel });

export default logger;
