import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PluginManager from '../src/pluginLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginsDir = path.resolve(__dirname, '..', 'plugins');

test('loads all example plugins', async () => {
  const pm = new PluginManager({ dir: pluginsDir, hotReload: false });
  await pm.loadAll();
  const names = pm.list().map((p) => p.name).sort();
  assert.ok(names.includes('ping'), 'ping loaded');
  assert.ok(names.includes('help'), 'help loaded');
  assert.ok(names.includes('echo'), 'echo loaded');
  assert.ok(names.includes('hello'), 'hello loaded');
});

test('matches a prefixed command', async () => {
  const pm = new PluginManager({ dir: pluginsDir, hotReload: false });
  await pm.loadAll();
  const hit = pm.match({ isCommand: true, commandName: 'ping', text: '!ping' });
  assert.ok(hit, 'found a match');
  assert.equal(hit.plugin.name, 'ping');
});

test('matches a regex pattern plugin', async () => {
  const pm = new PluginManager({ dir: pluginsDir, hotReload: false });
  await pm.loadAll();
  const hit = pm.match({ isCommand: false, commandName: '', text: 'hello there' });
  assert.ok(hit, 'found a pattern match');
  assert.equal(hit.plugin.name, 'hello');
});

test('executes a plugin against a mocked socket', async () => {
  const pm = new PluginManager({ dir: pluginsDir, hotReload: false });
  await pm.loadAll();
  const sent = [];
  const ctx = {
    args: ['world'],
    prefix: '!',
    plugins: pm,
    reply: async (content) => sent.push(content),
    logger: { debug() {}, info() {}, error() {} },
  };
  const echo = pm.list().find((p) => p.name === 'echo');
  await echo.execute(ctx);
  assert.deepEqual(sent, ['world']);
});

test('rejects a plugin with no execute function', () => {
  assert.throws(() => PluginManager.normalize({ default: { name: 'bad' } }, 'bad.js'));
});
