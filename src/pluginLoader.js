import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import logger from './logger.js';

/**
 * Plug-and-play plugin loader.
 *
 * Every `.js` file in the plugins folder is a plugin. A plugin is an ES module
 * whose default export (or named `plugin` export) is an object:
 *
 *   export default {
 *     name: 'ping',                 // unique id (defaults to filename)
 *     description: 'Replies pong',  // shown by the help plugin
 *     command: 'ping',              // string or string[] that triggers it
 *     pattern: /^hi$/i,             // optional regex alternative to command
 *     adminOnly: false,             // optional, restricts to OWNERS
 *     async execute(ctx) { ... }    // handler; see ctx shape in README
 *   }
 *
 * Drop a file in, and it becomes part of the bot. With HOT_RELOAD on, adding or
 * editing a file re-registers it live, no restart needed.
 */
export class PluginManager {
  constructor({ dir, hotReload = true } = {}) {
    this.dir = path.resolve(dir);
    this.hotReload = hotReload;
    this.plugins = new Map(); // name -> plugin
    this.byFile = new Map(); // absolute file path -> name
    this.watcher = null;
  }

  /** Validate and normalise a raw module export into a plugin object. */
  static normalize(mod, file) {
    const p = (mod && (mod.default || mod.plugin || mod)) || null;
    if (!p || typeof p !== 'object') {
      throw new Error('plugin must export an object (default export)');
    }
    const name = p.name || path.basename(file, path.extname(file));
    if (typeof p.execute !== 'function') {
      throw new Error(`plugin "${name}" is missing an execute(ctx) function`);
    }
    const commands = []
      .concat(p.command || [])
      .map((c) => String(c).toLowerCase())
      .filter(Boolean);
    return {
      name,
      description: p.description || '',
      commands,
      pattern: p.pattern instanceof RegExp ? p.pattern : null,
      adminOnly: Boolean(p.adminOnly),
      execute: p.execute,
    };
  }

  async loadFile(file) {
    const abs = path.resolve(this.dir, file);
    if (!abs.endsWith('.js')) return null;
    if (!fs.existsSync(abs)) return null;
    // Cache-bust so hot-reload picks up edits.
    const url = `${pathToFileURL(abs).href}?v=${Date.now()}`;
    const mod = await import(url);
    const plugin = PluginManager.normalize(mod, abs);
    // Replace any previous registration from the same file.
    const prev = this.byFile.get(abs);
    if (prev && prev !== plugin.name) this.plugins.delete(prev);
    this.plugins.set(plugin.name, plugin);
    this.byFile.set(abs, plugin.name);
    return plugin;
  }

  async loadAll() {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
    const files = fs.readdirSync(this.dir).filter((f) => f.endsWith('.js'));
    for (const f of files) {
      try {
        const p = await this.loadFile(f);
        if (p) logger.info({ plugin: p.name }, 'plugin loaded');
      } catch (err) {
        logger.error({ file: f, err: err.message }, 'failed to load plugin');
      }
    }
    return this.plugins;
  }

  watch() {
    if (!this.hotReload || this.watcher) return;
    try {
      this.watcher = fs.watch(this.dir, async (event, filename) => {
        if (!filename || !filename.endsWith('.js')) return;
        const abs = path.resolve(this.dir, filename);
        try {
          if (!fs.existsSync(abs)) {
            const name = this.byFile.get(abs);
            if (name) {
              this.plugins.delete(name);
              this.byFile.delete(abs);
              logger.info({ plugin: name }, 'plugin removed');
            }
            return;
          }
          const p = await this.loadFile(filename);
          if (p) logger.info({ plugin: p.name }, 'plugin (re)loaded');
        } catch (err) {
          logger.error({ file: filename, err: err.message }, 'hot-reload failed');
        }
      });
      logger.info({ dir: this.dir }, 'hot-reload watching plugins');
    } catch (err) {
      logger.warn({ err: err.message }, 'could not start plugin watcher');
    }
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  list() {
    return [...this.plugins.values()];
  }

  /** Find the plugin that matches a prefixed command or a pattern. */
  match({ isCommand, commandName, text }) {
    for (const p of this.plugins.values()) {
      if (isCommand && p.commands.includes(commandName)) return { plugin: p };
      if (!isCommand && p.pattern && p.pattern.test(text)) return { plugin: p };
    }
    return null;
  }
}

export default PluginManager;
