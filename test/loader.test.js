import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PluginManager from '../src/pluginLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginsDir = path.resolve(__dirname, '..', 'plugins');

const EXPECTED = [
  'antidelete',
  'autostatus',
  'autotyping',
  'calculator',
  'control',
  'echo',
  'groq',
  'hello',
  'menu',
  'ping',
  'pollai',
  'profile',
  'systeminfo',
  'vcf',
  'weather',
];

test('loads every included plugin', async () => {
  const pm = new PluginManager({ dir: pluginsDir, hotReload: false });
  await pm.loadAll();
  const names = pm.list().map((p) => p.name).sort();
  assert.deepEqual(names, EXPECTED.slice().sort());
});

test('matches a prefixed command', async () => {
  const pm = new PluginManager({ dir: pluginsDir, hotReload: false });
  await pm.loadAll();
  const hit = pm.match({ isCommand: true, commandName: 'ping', text: '!ping' });
  assert.ok(hit);
  assert.equal(hit.plugin.name, 'ping');
});

test('matches a regex pattern plugin', async () => {
  const pm = new PluginManager({ dir: pluginsDir, hotReload: false });
  await pm.loadAll();
  const hit = pm.match({ isCommand: false, commandName: '', text: 'hello there' });
  assert.ok(hit);
  assert.equal(hit.plugin.name, 'hello');
});

test('menu command aliases resolve', async () => {
  const pm = new PluginManager({ dir: pluginsDir, hotReload: false });
  await pm.loadAll();
  for (const cmd of ['menu', 'help', 'commands']) {
    const hit = pm.match({ isCommand: true, commandName: cmd, text: '!' + cmd });
    assert.ok(hit, cmd + ' should match');
    assert.equal(hit.plugin.name, 'menu');
  }
});

test('executes echo against a mocked socket', async () => {
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

test('rejects a plugin with neither execute nor listen', () => {
  assert.throws(() =>
    PluginManager.normalize({ default: { name: 'bad' } }, 'bad.js'),
  );
});

test('disable stops match(); enable restores it; state persists', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cwb-state-'));
  const stateFile = path.join(tmp, 'state.json');
  const pm = new PluginManager({
    dir: pluginsDir,
    hotReload: false,
    stateFile,
  });
  await pm.loadAll();

  assert.ok(pm.match({ isCommand: true, commandName: 'ping', text: '!ping' }));
  assert.equal(pm.disable('ping'), true);
  assert.equal(pm.isEnabled('ping'), false);
  assert.equal(
    pm.match({ isCommand: true, commandName: 'ping', text: '!ping' }),
    null,
  );
  assert.ok(fs.existsSync(stateFile));
  const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  assert.ok(saved.disabled.includes('ping'));

  // A fresh manager with the same state file should remember the disable.
  const pm2 = new PluginManager({
    dir: pluginsDir,
    hotReload: false,
    stateFile,
  });
  await pm2.loadAll();
  assert.equal(pm2.isEnabled('ping'), false);
  assert.equal(pm2.enable('ping'), true);
  assert.ok(pm2.match({ isCommand: true, commandName: 'ping', text: '!ping' }));

  fs.rmSync(tmp, { recursive: true, force: true });
});

test('listeners() only returns enabled listener plugins', async () => {
  const pm = new PluginManager({ dir: pluginsDir, hotReload: false });
  await pm.loadAll();
  const before = pm.listeners().map((p) => p.name).sort();
  assert.ok(before.includes('antidelete'));
  assert.ok(before.includes('autostatus'));
  pm.disable('antidelete');
  const after = pm.listeners().map((p) => p.name).sort();
  assert.ok(!after.includes('antidelete'));
  assert.ok(after.includes('autostatus'));
});

test('every plugin declares a category', async () => {
  const pm = new PluginManager({ dir: pluginsDir, hotReload: false });
  await pm.loadAll();
  for (const p of pm.list()) {
    assert.ok(p.category && p.category.length, `${p.name} missing category`);
  }
});
