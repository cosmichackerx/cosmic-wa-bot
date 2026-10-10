// Simplest possible plugin: replies with latency.
export default {
  name: 'ping',
  description: 'Replies with pong and round-trip time',
  command: 'ping',
  async execute(ctx) {
    const start = Date.now();
    await ctx.reply('🏓 pong');
    ctx.logger.debug({ ms: Date.now() - start }, 'ping handled');
  },
};
