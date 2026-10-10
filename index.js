import CosmicBot from './src/bot.js';
import logger from './src/logger.js';

const bot = new CosmicBot();

// Top-level safety net: a stray throw/rejection must not kill the bot silently.
process.on('uncaughtException', (err) => {
  logger.error({ err: err?.message, stack: err?.stack }, 'uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  logger.error({ reason: String(reason) }, 'unhandledRejection');
});

async function main() {
  await bot.init();
  await bot.start();
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    logger.info({ sig }, 'shutting down');
    await bot.shutdown();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error({ err: err.message }, 'fatal: failed to start');
  process.exit(1);
});
