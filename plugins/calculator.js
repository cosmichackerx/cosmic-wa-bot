import { evaluateExpression, formatResult } from '../src/calc.js';

export default {
  name: 'calculator',
  description: 'Scientific calculator: + - * / ^, sin, cos, sqrt, log…',
  category: 'Tools',
  command: ['calculate', 'calc', 'math'],
  async execute(ctx) {
    try {
      if (!ctx.args.length) {
        await ctx.reply(
          `🧮 *Calculator*\n` +
            `Usage: ${ctx.prefix}calc <expression>\n\n` +
            `• Basic: \`2 + 3 * 4\`, \`2^8\`\n` +
            `• Trig: \`sin(45*pi/180)\`, \`cos(0)\`\n` +
            `• Advanced: \`sqrt(144)\`, \`log(100)\`, \`ln(e)\`\n` +
            `• Constants: \`pi\`, \`e\`\n` +
            `_Use brackets ( ) for complex math._`,
        );
        return;
      }
      // Cap input length to keep evaluation cheap.
      const input = ctx.args.join(' ').slice(0, 200);
      const value = evaluateExpression(input);
      await ctx.reply(
        `🧮 *Result*\n` +
          `📝 Input: \`${input}\`\n` +
          `✅ Output: *${formatResult(value)}*`,
      );
    } catch (err) {
      await ctx.reply(`❌ ${err.message}`);
    }
  },
};
