/**
 * Owner-only live control from WhatsApp itself.
 *
 *   !plugin list                 — show every plugin and its on/off state
 *   !plugin on  <name>           — enable a plugin (persisted)
 *   !plugin off <name>           — disable a plugin (persisted)
 *   !feature on|off|list …       — alias of !plugin
 *   !shutdown / !off             — graceful process exit
 *   !restart                     — soft reconnect without exiting
 *
 * Requires at least one OWNER_NUMBER. The bot refuses these commands when no
 * owner is configured, so an open bot can't be shut down by strangers.
 */
export default {
  name: 'control',
  description: 'Owner live control: plugin on/off, list, shutdown, restart',
  category: 'Admin',
  command: ['plugin', 'feature', 'plugins', 'shutdown', 'off', 'restart'],
  adminOnly: true,
  async execute(ctx) {
    try {
      if (!ctx.config.owners.length) {
        await ctx.reply(
          '🔒 No OWNER_NUMBER is set. Add your number to .env before using control commands.',
        );
        return;
      }
      // Belt-and-braces: even if adminOnly somehow slipped, re-check.
      if (!ctx.isOwner) {
        await ctx.reply('🚫 Owner-only.');
        return;
      }

      switch (ctx.command) {
        case 'shutdown':
        case 'off':
          return shutdown(ctx);
        case 'restart':
          return restart(ctx);
        default:
          return pluginCmd(ctx);
      }
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'control error');
      await ctx.reply('❌ Control command failed: ' + err.message);
    }
  },
};

async function pluginCmd(ctx) {
  const [actionRaw, ...rest] = ctx.args;
  const action = (actionRaw || 'list').toLowerCase();
  const name = rest.join(' ').trim();

  if (action === 'list' || action === 'ls' || action === 'status') {
    const lines = ctx.plugins
      .list()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p) => {
        const on = ctx.plugins.isEnabled(p.name);
        const cmds = p.commands.length
          ? p.commands.map((c) => ctx.prefix + c).join(', ')
          : p.listen
            ? '(listener)'
            : '(pattern)';
        return `${on ? '✅' : '⛔'} *${p.name}* — ${cmds}`;
      });
    await ctx.reply(
      `🧩 *Plugins* (${ctx.plugins.list().length})\n` +
        `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n` +
        lines.join('\n') +
        `\n\nToggle: \`${ctx.prefix}plugin on|off <name>\``,
    );
    return;
  }

  if (action === 'on' || action === 'enable') {
    if (!name) {
      await ctx.reply(`Usage: ${ctx.prefix}plugin on <name>`);
      return;
    }
    if (name === 'control') {
      await ctx.reply('⚠️ The control plugin cannot be disabled/re-enabled this way.');
      return;
    }
    if (!ctx.plugins.get(name)) {
      await ctx.reply(`❌ Unknown plugin \`${name}\`. Try \`${ctx.prefix}plugin list\`.`);
      return;
    }
    ctx.plugins.enable(name);
    await ctx.reply(`✅ Plugin *${name}* enabled.`);
    return;
  }

  if (action === 'off' || action === 'disable') {
    if (!name) {
      await ctx.reply(`Usage: ${ctx.prefix}plugin off <name>`);
      return;
    }
    if (name === 'control') {
      await ctx.reply('⚠️ Refusing to disable the control plugin (you would lock yourself out).');
      return;
    }
    if (!ctx.plugins.get(name)) {
      await ctx.reply(`❌ Unknown plugin \`${name}\`. Try \`${ctx.prefix}plugin list\`.`);
      return;
    }
    ctx.plugins.disable(name);
    await ctx.reply(`⛔ Plugin *${name}* disabled. Re-enable with \`${ctx.prefix}plugin on ${name}\`.`);
    return;
  }

  await ctx.reply(
    `Usage:\n` +
      `• ${ctx.prefix}plugin list\n` +
      `• ${ctx.prefix}plugin on <name>\n` +
      `• ${ctx.prefix}plugin off <name>\n` +
      `• ${ctx.prefix}shutdown\n` +
      `• ${ctx.prefix}restart`,
  );
}

async function shutdown(ctx) {
  await ctx.reply('🛑 Shutting down gracefully…');
  // Give the reply a moment to flush before we tear the socket down.
  setTimeout(async () => {
    try {
      await ctx.bot.shutdown();
    } finally {
      process.exit(0);
    }
  }, 750);
}

async function restart(ctx) {
  await ctx.reply('🔄 Soft-restarting the WhatsApp connection…');
  setTimeout(() => {
    ctx.bot.restart().catch((err) =>
      ctx.logger.error({ err: err.message }, 'restart failed'),
    );
  }, 500);
}
