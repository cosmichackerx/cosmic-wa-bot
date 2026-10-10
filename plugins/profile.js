/**
 * Profile lookup for a mention, reply, number, or self. Uses Baileys'
 * profilePictureUrl / fetchStatus / onWhatsApp. Failures (privacy) degrade
 * gracefully instead of crashing.
 */
export default {
  name: 'profile',
  description: 'Show profile picture, about & WA status (mention/reply/number)',
  category: 'Tools',
  command: ['profile', 'whois'],
  async execute(ctx) {
    try {
      let targetJid;
      const mentioned =
        ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const replied =
        ctx.msg.message?.extendedTextMessage?.contextInfo?.participant;

      if (mentioned.length) {
        targetJid = mentioned[0];
      } else if (replied) {
        targetJid = replied;
      } else if (ctx.args.length) {
        const number = ctx.args.join('').replace(/[^0-9]/g, '');
        if (!number || number.length < 7 || number.length > 15) {
          await ctx.reply('❌ Provide a valid phone number (with country code).');
          return;
        }
        targetJid = `${number}@s.whatsapp.net`;
      } else {
        targetJid = ctx.sender;
      }

      let ppUrl = null;
      try {
        ppUrl = await ctx.sock.profilePictureUrl(targetJid, 'image');
      } catch {
        /* privacy / no PP */
      }

      let status = '🔒 Private / unknown';
      try {
        const s = await ctx.sock.fetchStatus(targetJid);
        if (s?.status) status = String(s.status).slice(0, 200);
      } catch {
        /* privacy */
      }

      let onWa = 'Unknown';
      try {
        const contact = await ctx.sock.onWhatsApp(targetJid);
        if (contact?.[0]) onWa = contact[0].exists ? 'Yes' : 'No';
      } catch {
        /* ignore */
      }

      const caption =
        `👤 *Profile*\n\n` +
        `🏷️ Number: +${targetJid.split('@')[0]}\n` +
        `📝 About: ${status}\n` +
        `✅ On WhatsApp: ${onWa}`;

      if (ppUrl) {
        await ctx.sock.sendMessage(
          ctx.from,
          { image: { url: ppUrl }, caption },
          { quoted: ctx.msg },
        );
      } else {
        await ctx.reply(caption + '\n🖼️ No profile picture (or private).');
      }
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'profile error');
      await ctx.reply('❌ Could not fetch that profile.');
    }
  },
};
