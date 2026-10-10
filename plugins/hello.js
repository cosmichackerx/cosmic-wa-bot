// Pattern plugin: triggers without a prefix when the message matches a regex.
export default {
  name: 'hello',
  description: 'Says hi back when you greet the bot',
  pattern: /^(hi|hello|hey)\b/i,
  async execute(ctx) {
    await ctx.reply('👋 Hello! Type ' + ctx.prefix + 'help to see what I can do.');
  },
};
