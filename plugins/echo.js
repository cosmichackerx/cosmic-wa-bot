export default {
  name: 'echo',
  description: 'Echo your text back',
  category: 'Core',
  command: ['echo', 'say'],
  async execute(ctx) {
    const text = ctx.args.join(' ');
    if (!text) {
      await ctx.reply(`Usage: ${ctx.prefix}echo <text>`);
      return;
    }
    // Cap length so a huge paste can't flood the chat.
    await ctx.reply(text.slice(0, 4000));
  },
};
