import os from 'node:os';

const START_TIME = new Date();

export default {
  name: 'systeminfo',
  description: 'Show bot host resources (RAM, CPU, uptime) — no IP',
  category: 'Core',
  command: ['systeminfo', 'sysinfo', 'status'],
  async execute(ctx) {
    try {
      const ramUsed = process.memoryUsage().rss;
      const totalMem = os.totalmem();
      const cpus = os.cpus();
      const load = os.loadavg()[0] || 0;
      const cpuPercent = Math.min(
        Math.floor((load * 100) / Math.max(cpus.length, 1)),
        100,
      );

      let text = `🖥️ *System dashboard*\n`;
      text += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n`;
      text += `⏱️ Runtime: ${formatUptime(process.uptime())}\n`;
      text += `🔄 Started: ${START_TIME.toLocaleString()}\n`;
      text += `⚙️ System: ${os.platform()} (${os.arch()})\n`;
      text += `🚀 Cores: ${cpus.length}× ${cpus[0]?.speed || '?'} MHz\n`;
      text += `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n`;
      text += `💾 *Memory*\n${formatBytes(ramUsed)} / ${formatBytes(totalMem)}\n`;
      text += `${bar(ramUsed, totalMem)} *${((ramUsed / totalMem) * 100).toFixed(1)}%*\n\n`;
      text += `🧠 *CPU load*\n${cpus[0]?.model?.trim() || 'unknown'}\n`;
      text += `${bar(cpuPercent, 100)} *${cpuPercent}%*\n\n`;
      text += `_Host IP is never shown._`;
      await ctx.reply(text);
    } catch (err) {
      ctx.logger.error({ err: err.message }, 'systeminfo error');
      await ctx.reply('❌ Could not read system stats.');
    }
  },
};

function bar(current, total) {
  const size = 10;
  const pct = Math.min(current / Math.max(total, 1), 1);
  const filled = Math.round(size * pct);
  return `[${'█'.repeat(filled)}${'░'.repeat(size - filled)}]`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(2)} ${units[i]}`;
}

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
