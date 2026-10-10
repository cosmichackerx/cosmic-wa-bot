export default {
  name: 'hello',
  description: 'Says hi when you greet the bot (no prefix needed)',
  category: 'Core',
  pattern: /^(hi|hello|hey)\b/i,
  async execute(ctx) {
    await ctx.reply(
      `👋 Hello${ctx.pushName ? ', ' + ctx.pushName : ''}! Type ${ctx.prefix}menu to see what I can do.`,
    );
  },
};
