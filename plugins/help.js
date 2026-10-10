// Lists every loaded plugin. Demonstrates reading the live plugin registry.
export default {
  name: 'help',
  description: 'Lists all loaded commands',
  command: ['help', 'menu'],
  async execute(ctx) {
    const lines = ctx.plugins
      .list()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => {
        const trigger = p.commands.length
          ? p.commands.map((c) => `${ctx.prefix}${c}`).join(', ')
          : p.pattern
            ? String(p.pattern)
            : '(no trigger)';
        return `• *${p.name}* — ${p.description || 'no description'}\n   ${trigger}`;
      });
    const header = `*Cosmic WA Bot*\nPrefix: \`${ctx.prefix}\`\nLoaded plugins: ${ctx.plugins.list().length}\n`;
    await ctx.reply(`${header}\n${lines.join('\n')}`);
  },
};
