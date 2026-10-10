// Polished, dynamically generated menu. Groups every non-hidden loaded plugin
// by its `category` so new plugins appear automatically.
export default {
  name: 'menu',
  description: 'Shows the command menu, grouped by category',
  category: 'Core',
  command: ['menu', 'help', 'commands'],
  async execute(ctx) {
    try {
      const { plugins, prefix, config, pushName, isOwner } = ctx;
      const list = plugins
        .list()
        .filter((p) => !p.hidden && p.commands.length)
        .sort((a, b) => a.name.localeCompare(b.name));

      // Group by category, preserving alphabetical order within each group.
      const groups = new Map();
      for (const p of list) {
        const cat = p.category || 'General';
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push(p);
      }
      const categories = [...groups.keys()].sort((a, b) => a.localeCompare(b));

      const uptime = formatUptime(process.uptime());
      const enabled = list.filter((p) => plugins.isEnabled(p.name)).length;

      let text = '';
      text += `╭━━━〔 *${config.botName}* 〕━━━╮\n`;
      text += `┃ 👋 Hi *${pushName || 'there'}*\n`;
      text += `┃ 📦 Version: \`v${config.version}\`\n`;
      text += `┃ ⚡ Prefix:  \`${prefix}\`\n`;
      text += `┃ ⏱️ Uptime:  ${uptime}\n`;
      text += `┃ 🧩 Plugins: ${enabled}/${list.length} enabled\n`;
      if (config.ownerName) text += `┃ 👑 Owner:   ${config.ownerName}\n`;
      text += `╰━━━━━━━━━━━━━━━━━━━━━━━╯\n`;

      for (const cat of categories) {
        text += `\n*${cat}*\n`;
        text += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
        for (const p of groups.get(cat)) {
          const cmds = p.commands.map((c) => `\`${prefix}${c}\``).join(', ');
          const status = plugins.isEnabled(p.name) ? '' : ' _(disabled)_';
          const lock = p.adminOnly ? ' 🔒' : '';
          text += `• ${cmds}${lock}${status}\n  ${p.description || '—'}\n`;
        }
      }

      text += `\n_Type ${prefix}<command> to run. Owner-only commands are marked 🔒._`;
      if (!isOwner && config.owners.length) {
        text += `\n_Some features are owner-only._`;
      }

      await ctx.reply(text);
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'menu error');
      await ctx.reply('❌ Could not build the menu.');
    }
  },
};

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`, `${s}s`);
  return parts.join(' ');
}
