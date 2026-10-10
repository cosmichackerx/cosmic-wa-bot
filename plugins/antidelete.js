/**
 * Caches recent messages and, on a "delete for everyone", forwards a copy to
 * the bot owner. Cap + TTL keep the cache from growing forever.
 */
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 500;
const cache = new Map(); // id -> message

function remember(id, msg) {
  cache.set(id, msg);
  if (cache.size > CACHE_MAX) {
    // Drop the oldest entry (Map iterates in insertion order).
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  setTimeout(() => cache.delete(id), CACHE_TTL_MS).unref?.();
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default {
  name: 'antidelete',
  description: 'Forwards deleted messages to the owner (background)',
  category: 'Automation',
  // No command — purely a listener. Hidden from the menu.
  hidden: true,
  async listen(ctx) {
    try {
      const msg = ctx.m.message;
      if (!msg) return;

      // Cache every non-protocol message.
      if (!msg.protocolMessage) {
        if (ctx.m.key?.id) remember(ctx.m.key.id, ctx.m);
        return;
      }

      // type === 0 => REVOKE (delete for everyone)
      if (msg.protocolMessage.type !== 0) return;
      const deletedId = msg.protocolMessage.key?.id;
      if (!deletedId || !cache.has(deletedId)) return;

      const original = cache.get(deletedId);
      cache.delete(deletedId);

      const ownerDigits = ctx.config.owners[0];
      if (!ownerDigits) return; // no owner configured — nowhere to send
      const ownerJid = `${ownerDigits}@s.whatsapp.net`;

      const senderJid = original.key.participant || original.key.remoteJid;
      const senderName = original.pushName || 'Unknown';
      const chatSource = String(ctx.from).endsWith('@g.us') ? 'Group' : 'Private';
      const caption =
        `🗑️ *Anti-delete*\n` +
        `┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n` +
        `👤 ${senderName}\n` +
        `📱 +${String(senderJid).split('@')[0]}\n` +
        `📍 ${chatSource}\n` +
        `🕒 ${new Date().toLocaleTimeString()}`;

      const content = original.message || {};
      const type = Object.keys(content)[0];

      if (type === 'conversation' || type === 'extendedTextMessage') {
        const text =
          content.conversation || content.extendedTextMessage?.text || '';
        await ctx.sock.sendMessage(ownerJid, {
          text: `${caption}\n\n📝 ${String(text).slice(0, 2000)}`,
        });
        return;
      }

      const mediaKind =
        type === 'imageMessage'
          ? 'image'
          : type === 'videoMessage'
            ? 'video'
            : type === 'audioMessage'
              ? 'audio'
              : type === 'stickerMessage'
                ? 'sticker'
                : null;
      if (!mediaKind) {
        await ctx.sock.sendMessage(ownerJid, {
          text: `${caption}\n\n_(unsupported media type: ${type})_`,
        });
        return;
      }

      const stream = await downloadContentFromMessage(content[type], mediaKind);
      const buffer = await streamToBuffer(stream);
      if (mediaKind === 'image') {
        await ctx.sock.sendMessage(ownerJid, { image: buffer, caption });
      } else if (mediaKind === 'video') {
        await ctx.sock.sendMessage(ownerJid, { video: buffer, caption });
      } else if (mediaKind === 'audio') {
        await ctx.sock.sendMessage(ownerJid, { text: caption + '\n(voice note below)' });
        await ctx.sock.sendMessage(ownerJid, {
          audio: buffer,
          mimetype: 'audio/mp4',
          ptt: true,
        });
      } else if (mediaKind === 'sticker') {
        await ctx.sock.sendMessage(ownerJid, { text: caption + '\n(sticker below)' });
        await ctx.sock.sendMessage(ownerJid, { sticker: buffer });
      }
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'antidelete error');
    }
  },
};
