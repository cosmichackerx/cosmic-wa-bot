// Echoes back whatever the user typed after the command.
export default {
  name: 'echo',
  description: 'Echoes your text back: !echo hello',
  command: ['echo', 'say'],
  async execute(ctx) {
    const text = ctx.args.join(' ');
    if (!text) {
      await ctx.reply(`Usage: ${ctx.prefix}echo <text>`);
      return;
    }
    await ctx.reply(text);
  },
};
