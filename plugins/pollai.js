/**
 * Free image generation via Pollinations.ai. No API key needed. Caps the
 * prompt length, caps to 2 images (not 4) to stay polite to the free API,
 * and uses a timeout so a hung request can't stall the bot.
 */
export default {
  name: 'pollai',
  description: 'Generate images with Pollinations AI',
  category: 'AI',
  command: ['pollai', 'imagine', 'img'],
  async execute(ctx) {
    try {
      const promptRaw = ctx.args.join(' ').trim();
      if (!promptRaw) {
        await ctx.reply(
          `🎨 *Pollinations AI*\n` +
            `Usage: ${ctx.prefix}pollai <prompt> [--anime|--realistic|--3d|--digital] [--portrait|--landscape]\n\n` +
            `Example: ${ctx.prefix}pollai a red sports car --realistic --landscape`,
        );
        return;
      }

      let prompt = promptRaw.slice(0, 400);
      let style = '';
      let width = 1024;
      let height = 1024;

      if (prompt.includes('--portrait')) {
        width = 768;
        height = 1024;
        prompt = prompt.replace('--portrait', '');
      } else if (prompt.includes('--landscape')) {
        width = 1024;
        height = 768;
        prompt = prompt.replace('--landscape', '');
      }

      if (prompt.includes('--anime')) {
        style = 'anime style, vibrant colors, high detail';
        prompt = prompt.replace('--anime', '');
      } else if (prompt.includes('--realistic')) {
        style = 'photorealistic, 8k, cinematic lighting';
        prompt = prompt.replace('--realistic', '');
      } else if (prompt.includes('--3d')) {
        style = '3d render, blender, crisp';
        prompt = prompt.replace('--3d', '');
      } else if (prompt.includes('--digital')) {
        style = 'digital art, concept art, sharp focus';
        prompt = prompt.replace('--digital', '');
      }

      prompt = prompt.trim();
      if (!prompt) {
        await ctx.reply('❌ Please provide a prompt.');
        return;
      }
      const finalPrompt = style ? `${prompt}, ${style}` : prompt;

      await ctx.reply(
        `🎨 Generating 2 variations…\nMode: ${style ? style.split(',')[0] : 'generic'}\nSize: ${width}x${height}`,
      );

      const count = 2;
      for (let i = 0; i < count; i++) {
        const seed = Math.floor(Math.random() * 10_000_000);
        const url =
          `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}` +
          `?width=${width}&height=${height}&seed=${seed}&nolog=true`;
        const buffer = await fetchBuffer(url, ctx.config.httpTimeoutMs);
        await ctx.sock.sendMessage(
          ctx.from,
          {
            image: buffer,
            caption: `🎨 *Pollinations* [${i + 1}/${count}]\nPrompt: "${prompt}"`,
          },
          { quoted: ctx.msg },
        );
      }
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'pollai error');
      await ctx.reply('❌ Image generation failed. The free API may be busy — try again.');
    }
  },
};

async function fetchBuffer(url, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ab = await res.arrayBuffer();
    // Cap image size at 8 MB so a runaway response can't exhaust memory.
    if (ab.byteLength > 8 * 1024 * 1024) throw new Error('image too large');
    return Buffer.from(ab);
  } finally {
    clearTimeout(t);
  }
}
