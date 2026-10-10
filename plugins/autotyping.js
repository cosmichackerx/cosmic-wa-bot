/**
 * Optional human-like "typing…" / "recording…" presence while a chat is
 * active. Disabled by default — set AUTO_TYPING=true to enable. Presence
 * updates are fire-and-forget and never throw into the main loop.
 */
export default {
  name: 'autotyping',
  description: 'Show typing/recording presence (set AUTO_TYPING=true)',
  category: 'Automation',
  hidden: true,
  async listen(ctx) {
    try {
      if (process.env.AUTO_TYPING !== 'true') return;
      if (ctx.from === 'status@broadcast' || ctx.m.key.fromMe) return;
      // Skip group chats by default — presence spam is rude there.
      if (String(ctx.from).endsWith('@g.us') && process.env.AUTO_TYPING_GROUPS !== 'true') {
        return;
      }

      const strategies = ['type_only', 'record_only'];
      const strategy = strategies[Math.floor(Math.random() * strategies.length)];
      const delay = (ms) => new Promise((r) => setTimeout(r, ms));
      const ms = 1500 + Math.floor(Math.random() * 2000);

      if (strategy === 'type_only') {
        await ctx.sock.sendPresenceUpdate('composing', ctx.from);
      } else {
        await ctx.sock.sendPresenceUpdate('recording', ctx.from);
      }
      await delay(ms);
      await ctx.sock.sendPresenceUpdate('paused', ctx.from);
    } catch {
      /* presence is best-effort */
    }
  },
};
