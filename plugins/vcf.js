/**
 * Export the CURRENT GROUP's members as a VCF contact card.
 *
 * Safeguards (vs. X-Bot's unrestricted version):
 *   • Owner-only by default (adminOnly: true).
 *   • Group chats only — refuses DMs.
 *   • Caps at 200 contacts so it can't be used as a bulk harvester.
 *   • Only exports members of the chat the owner is currently in.
 *
 * Intended for an admin exporting their own group's roster.
 */
const MAX_CONTACTS = 200;

export default {
  name: 'vcf',
  description: 'Export this group\'s members as a VCF (owner-only, max 200)',
  category: 'Admin',
  command: 'vcf',
  adminOnly: true,
  async execute(ctx) {
    try {
      if (!ctx.isGroup) {
        await ctx.reply('❌ This command only works in a group chat.');
        return;
      }
      await ctx.reply('🔄 Building VCF…');

      const meta = await ctx.sock.groupMetadata(ctx.from);
      const groupName = String(meta.subject || 'Group')
        .replace(/[^a-zA-Z0-9 _-]/g, '')
        .slice(0, 40) || 'Group';
      const participants = meta.participants || [];

      if (participants.length > MAX_CONTACTS) {
        await ctx.reply(
          `❌ This group has ${participants.length} members. ` +
            `For safety the export is capped at ${MAX_CONTACTS}. ` +
            `Split the group or export elsewhere.`,
        );
        return;
      }

      let vcard = '';
      for (const p of participants) {
        const number = String(p.id || '').split('@')[0].replace(/[^0-9]/g, '');
        if (!number) continue;
        vcard +=
          'BEGIN:VCARD\n' +
          'VERSION:3.0\n' +
          `FN:+${number} - ${groupName}\n` +
          `TEL;type=CELL;type=VOICE;waid=${number}:+${number}\n` +
          'END:VCARD\n';
      }

      const buffer = Buffer.from(vcard, 'utf8');
      await ctx.sock.sendMessage(
        ctx.from,
        {
          document: buffer,
          mimetype: 'text/vcard',
          fileName: `${groupName}_Contacts.vcf`,
          caption:
            `✅ Exported ${participants.length} contacts from *${groupName}*.\n` +
            `_Owner-only. For your own group management — not for bulk harvesting._`,
        },
        { quoted: ctx.msg },
      );
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'vcf error');
      await ctx.reply('❌ Could not export contacts: ' + err.message);
    }
  },
};
