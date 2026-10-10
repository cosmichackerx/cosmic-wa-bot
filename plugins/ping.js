export default {
  name: 'ping',
  description: 'Check latency (round-trip)',
  category: 'Core',
  command: 'ping',
  async execute(ctx) {
    const start = Date.now();
    await ctx.reply('🏓 pong');
    ctx.logger.debug({ ms: Date.now() - start }, 'ping handled');
  },
};
