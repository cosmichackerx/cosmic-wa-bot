/**
 * Auto-views (marks as read) status updates. Reaction is optional and
 * controlled by AUTO_STATUS_REACT=true. Failures are swallowed so a single
 * status can't affect the bot.
 */
export default {
  name: 'autostatus',
  description: 'Auto-view WhatsApp statuses (background)',
  category: 'Automation',
  hidden: true,
  async listen(ctx) {
    try {
      if (ctx.from !== 'status@broadcast') return;
      const key = {
        remoteJid: ctx.from,
        id: ctx.m.key.id,
        participant: ctx.m.key.participant,
      };
      await ctx.sock.readMessages([key]);

      if (process.env.AUTO_STATUS_REACT === 'true') {
        const emojis = ['💚', '🔥', '✨', '👀', '🚀'];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        try {
          await ctx.sock.sendMessage(
            ctx.from,
            { react: { text: emoji, key: ctx.m.key } },
            { statusJidList: [ctx.m.key.participant].filter(Boolean) },
          );
        } catch {
          /* reaction is best-effort */
        }
      }

      const user =
        ctx.m.pushName ||
        (ctx.m.key.participant
          ? ctx.m.key.participant.split('@')[0]
          : 'Anonymous');
      ctx.logger.debug({ user }, 'auto-viewed status');
    } catch (err) {
      ctx.logger.debug({ err: err.message }, 'autostatus skipped');
    }
  },
};
