/**
 * Groq AI chat. Key comes from GROQ_API_KEY. When unset the feature is
 * disabled with a clear reply — never a crash. Models can be selected with
 * --fast / --smart / --mixtral / --gemma, with automatic fallback.
 */
const MODELS = {
  default: 'llama-3.1-8b-instant',
  fast: 'llama-3.1-8b-instant',
  smart: 'llama-3.3-70b-versatile',
  mixtral: 'mixtral-8x7b-32768',
  gemma: 'gemma2-9b-it',
};

export default {
  name: 'groq',
  description: 'Chat with Groq AI (set GROQ_API_KEY to enable)',
  category: 'AI',
  command: ['groq', 'ai', 'ask'],
  async execute(ctx) {
    try {
      const key = ctx.config.groqApiKey;
      if (!key) {
        await ctx.reply(
          '🤖 Groq AI is disabled. Set `GROQ_API_KEY` in your .env to enable it.',
        );
        return;
      }
      if (!ctx.args[0]) {
        let menu = `⚡ *Groq AI*\nUsage: ${ctx.prefix}groq <question>\n`;
        menu += `Optional model: ${ctx.prefix}groq --smart <question>\n\n*Models:*\n`;
        for (const k of Object.keys(MODELS)) {
          if (k !== 'default') menu += `• \`--${k}\` → ${MODELS[k]}\n`;
        }
        await ctx.reply(menu);
        return;
      }

      let words = ctx.args.slice();
      let selected = 'default';
      const flagIdx = words.findIndex((w) => w.startsWith('--'));
      if (flagIdx !== -1) {
        const flag = words[flagIdx].slice(2).toLowerCase();
        if (MODELS[flag]) {
          selected = flag;
          words.splice(flagIdx, 1);
        }
      }
      // Prefer an explicitly configured default model when no flag was given.
      const preferred =
        selected === 'default' && ctx.config.groqModel
          ? ctx.config.groqModel
          : MODELS[selected];

      const prompt = words.join(' ').trim().slice(0, 4000);
      if (!prompt) {
        await ctx.reply('❌ Please provide a question after the model flag.');
        return;
      }

      await ctx.reply(`⚡ Thinking… (\`${preferred}\`)`);

      const attemptList = [preferred, ...Object.values(MODELS).filter((m) => m !== preferred)];
      let answer = null;
      let used = preferred;

      for (const model of attemptList) {
        try {
          answer = await chat(key, model, prompt, ctx.config.httpTimeoutMs);
          used = model;
          break;
        } catch (err) {
          if (err.status === 401) {
            await ctx.reply('❌ Invalid Groq API key. Check GROQ_API_KEY.');
            return;
          }
          ctx.logger.warn({ model, err: err.message }, 'groq model failed');
        }
      }

      if (!answer) {
        await ctx.reply('❌ All Groq models are busy or unavailable. Try again later.');
        return;
      }
      const header =
        used === preferred
          ? `🤖 *Groq (${selected})*`
          : `🤖 *Groq (fallback: ${used})*`;
      // Cap reply length so a runaway model can't flood the chat.
      await ctx.reply(`${header}\n\n${answer.slice(0, 3500)}`);
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'groq error');
      await ctx.reply('❌ Groq request failed.');
    }
  },
};

async function chat(key, model, prompt, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1024,
        stream: false,
      }),
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) throw new Error('empty response');
    return text;
  } finally {
    clearTimeout(t);
  }
}
