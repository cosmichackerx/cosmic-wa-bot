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
 *     name: 'ping',               // optional, defaults to filename
 *     description: 'Replies pong',
 *     category: 'Core',           // optional, groups the command in the menu
 *     command: 'ping',            // string or array; omit for a listener-only plugin
 *     pattern: /^hi\b/i,          // optional regex trigger (no prefix needed)
 *     adminOnly: false,           // optional, restrict to owners
 *     hidden: false,              // optional, hide from the menu
 *     async execute(ctx) { ... }, // command/pattern handler
 *     async listen(ctx) { ... },  // optional background listener (every message)
 *   }
 *
 * Drop a file in, and it becomes part of the bot. With HOT_RELOAD on, adding or
 * editing a file re-registers it live, no restart needed.
 *
 * Plugins can be toggled on/off at runtime; disabled plugins are skipped by
 * `match()` and `listeners()` and the disabled set is persisted to a small,
 * git-ignored JSON state file so the choice survives a restart.
 */
export class PluginManager {
  constructor({ dir, hotReload = true, stateFile = null } = {}) {
    this.dir = path.resolve(dir);
    this.hotReload = hotReload;
    this.stateFile = stateFile ? path.resolve(stateFile) : null;
    this.plugins = new Map(); // name -> plugin
    this.byFile = new Map(); // absolute file path -> name
    this.disabled = new Set(); // names disabled at runtime
    this.watcher = null;
    this._loadState();
  }

  /** Validate and normalise a raw module export into a plugin object. */
  static normalize(mod, file) {
    const p = (mod && (mod.default || mod.plugin || mod)) || null;
    if (!p || typeof p !== 'object') {
      throw new Error('plugin must export an object (default export)');
    }
    const name = p.name || path.basename(file, path.extname(file));
    const hasExecute = typeof p.execute === 'function';
    const hasListen = typeof p.listen === 'function';
    if (!hasExecute && !hasListen) {
      throw new Error(
        `plugin "${name}" must define execute(ctx) and/or listen(ctx)`,
      );
    }
    const commands = []
      .concat(p.command || [])
      .map((c) => String(c).toLowerCase())
      .filter(Boolean);
    return {
      name,
      description: p.description || '',
      category: p.category || 'General',
      commands,
      pattern: p.pattern instanceof RegExp ? p.pattern : null,
      adminOnly: Boolean(p.adminOnly),
      hidden: Boolean(p.hidden),
      execute: hasExecute ? p.execute : null,
      listen: hasListen ? p.listen : null,
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

  get(name) {
    return this.plugins.get(name) || null;
  }

  // ---- runtime enable/disable -------------------------------------------

  isEnabled(name) {
    return !this.disabled.has(name);
  }

  enable(name) {
    if (!this.plugins.has(name)) return false;
    if (this.disabled.delete(name)) this._saveState();
    return true;
  }

  disable(name) {
    if (!this.plugins.has(name)) return false;
    if (!this.disabled.has(name)) {
      this.disabled.add(name);
      this._saveState();
    }
    return true;
  }

  _loadState() {
    if (!this.stateFile) return;
    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = JSON.parse(fs.readFileSync(this.stateFile, 'utf8'));
        if (Array.isArray(raw?.disabled)) {
          this.disabled = new Set(raw.disabled.map(String));
        }
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'could not read plugin state file');
    }
  }

  _saveState() {
    if (!this.stateFile) return;
    try {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      fs.writeFileSync(
        this.stateFile,
        JSON.stringify({ disabled: [...this.disabled] }, null, 2),
      );
    } catch (err) {
      logger.warn({ err: err.message }, 'could not write plugin state file');
    }
  }

  // ---- lookups -----------------------------------------------------------

  /** Enabled plugins that have a background listener. */
  listeners() {
    return [...this.plugins.values()].filter(
      (p) => p.listen && this.isEnabled(p.name),
    );
  }

  /** Find the enabled plugin that matches a prefixed command or a pattern. */
  match({ isCommand, commandName, text }) {
    for (const p of this.plugins.values()) {
      if (!p.execute) continue;
      if (!this.isEnabled(p.name)) continue;
      if (isCommand && p.commands.includes(commandName)) return { plugin: p };
      if (!isCommand && p.pattern && p.pattern.test(text)) return { plugin: p };
    }
    return null;
  }
}

export default PluginManager;
