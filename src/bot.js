import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import config, { validateConfig, jidNumber } from './config.js';
import logger from './logger.js';
import PluginManager from './pluginLoader.js';
import { startWebServer } from './server.js';

// Baileys' own socket logger is kept silent; our app logs through `logger`.
const socketLogger = pino({ level: 'silent' });

/** Extract plain text from the many shapes a WhatsApp message can take. */
function extractText(msg) {
  const m = msg.message || {};
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

export class CosmicBot {
  constructor() {
    this.plugins = new PluginManager({
      dir: config.pluginsDir,
      hotReload: config.hotReload,
      stateFile: config.stateFile,
    });
    this.sock = null;
    this.reconnectAttempts = 0;
    this.pairingRequested = false;
    this.stopping = false;
    this.server = null;
    this.latestQR = null; // last QR string, for the optional web endpoint
  }

  async init() {
    const errors = validateConfig();
    if (errors.length) {
      for (const e of errors) logger.error(e);
      throw new Error('invalid configuration');
    }
    await this.plugins.loadAll();
    this.plugins.watch();
    if (config.webServer) {
      this.server = startWebServer(this);
    }
  }

  nextBackoffMs() {
    // Exponential backoff capped at 30s, with jitter.
    const base = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempts);
    return base + Math.floor(Math.random() * 1_000);
  }

  async start() {
    const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
    const { version } = await fetchLatestBaileysVersion();
    this.saveCreds = saveCreds;

    const sock = makeWASocket({
      version,
      logger: socketLogger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, socketLogger),
      },
      // We render the QR ourselves so we can also support pairing codes.
      printQRInTerminal: false,
      browser: ['Cosmic-WA-Bot', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    this.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    // Pairing-code login: request once, when we have no session yet.
    if (
      config.authMethod === 'pairing' &&
      !sock.authState.creds.registered &&
      !this.pairingRequested
    ) {
      this.pairingRequested = true;
      // Small delay so the socket is ready before requesting.
      setTimeout(() => {
        this.requestPairing(config.botNumber).catch((err) =>
          logger.error({ err: err.message }, 'failed to request pairing code'),
        );
      }, 3_000);
    }

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.latestQR = qr;
        if (config.authMethod === 'qr') {
          logger.info('Scan this QR in WhatsApp > Linked devices > Link a device:');
          qrcodeTerminal.generate(qr, { small: true });
        }
      }

      if (connection === 'open') {
        this.reconnectAttempts = 0;
        this.latestQR = null;
        logger.info('✅ connected to WhatsApp');
      }

      if (connection === 'close') {
        this.handleClose(lastDisconnect);
      }
    });

    sock.ev.on('messages.upsert', (ev) => {
      // Never let a message crash the process.
      this.onMessages(ev).catch((err) =>
        logger.error({ err: err.message }, 'messages.upsert handler error'),
      );
    });

    return sock;
  }

  /** Request a pairing code for a number; returns the pretty-printed code. */
  async requestPairing(number) {
    const digits = String(number || '').replace(/[^0-9]/g, '');
    if (!digits) throw new Error('a phone number (with country code) is required');
    if (!this.sock) throw new Error('socket not ready yet');
    if (this.sock.authState.creds.registered) {
      throw new Error('already linked; delete the auth folder to re-pair');
    }
    const code = await this.sock.requestPairingCode(digits);
    const pretty = code?.match(/.{1,4}/g)?.join('-') || code;
    logger.info('──────────────────────────────');
    logger.info(`Pairing code for +${digits}: ${pretty}`);
    logger.info('Enter it in WhatsApp > Linked devices > Link with phone number');
    logger.info('──────────────────────────────');
    return pretty;
  }

  handleClose(lastDisconnect) {
    if (this.stopping) return;
    const statusCode =
      lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output?.statusCode
        : lastDisconnect?.error?.output?.statusCode;

    const loggedOut = statusCode === DisconnectReason.loggedOut;

    if (loggedOut) {
      logger.error(
        'Logged out by WhatsApp. Delete the auth folder and re-link to continue.',
      );
      // Do not auto-reconnect on a real logout; the session is invalid.
      return;
    }

    const delay = this.nextBackoffMs();
    this.reconnectAttempts += 1;
    logger.warn(
      { statusCode, attempt: this.reconnectAttempts, delayMs: delay },
      'connection closed, reconnecting',
    );
    setTimeout(() => {
      this.start().catch((err) =>
        logger.error({ err: err.message }, 'reconnect failed'),
      );
    }, delay);
  }

  isOwner(jid) {
    // No owners configured => permissive (matches original behaviour). The
    // owner-control plugin separately refuses to act when no owner is set.
    if (!config.owners.length) return true;
    return config.owners.includes(jidNumber(jid));
  }

  async onMessages({ messages, type }) {
    for (const msg of messages) {
      if (!msg?.message) continue;

      // Background listeners run for every message (status, revokes, etc.),
      // each isolated so one failure can't affect the others or the process.
      await this.runListeners(msg);

      // Command dispatch: only fresh notifications, never our own messages.
      if (type !== 'notify' || msg.key.fromMe) continue;
      await this.dispatch(msg).catch((err) =>
        logger.error({ err: err.message }, 'plugin dispatch error'),
      );
    }
  }

  async runListeners(msg) {
    const listeners = this.plugins.listeners();
    if (!listeners.length) return;
    const from = msg.key.remoteJid;
    const body = extractText(msg);
    const base = {
      sock: this.sock,
      m: msg,
      msg: msg.message,
      from,
      body,
      bot: this,
      plugins: this.plugins,
      config,
      logger,
    };
    await Promise.allSettled(
      listeners.map((p) =>
        Promise.resolve()
          .then(() => p.listen(base))
          .catch((err) =>
            logger.error({ plugin: p.name, err: err.message }, 'listener error'),
          ),
      ),
    );
  }

  async dispatch(msg) {
    const text = extractText(msg).trim();
    if (!text) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isGroup = String(from).endsWith('@g.us');

    const isCommand = text.startsWith(config.prefix);
    const commandName = isCommand
      ? text.slice(config.prefix.length).trim().split(/\s+/)[0].toLowerCase()
      : '';
    const args = isCommand
      ? text.slice(config.prefix.length).trim().split(/\s+/).slice(1)
      : [];

    const hit = this.plugins.match({ isCommand, commandName, text });
    if (!hit) return;

    const { plugin } = hit;
    const owner = this.isOwner(sender);
    if (plugin.adminOnly && !owner) {
      await this.sock.sendMessage(from, { text: '🚫 Owner-only command.' }, { quoted: msg });
      return;
    }

    const ctx = {
      sock: this.sock,
      msg,
      m: msg,
      from,
      sender,
      senderNumber: jidNumber(sender),
      isGroup,
      pushName: msg.pushName || '',
      text,
      args,
      command: commandName,
      prefix: config.prefix,
      plugins: this.plugins,
      bot: this,
      config,
      isOwner: owner,
      logger,
      reply: (content) =>
        this.sock.sendMessage(
          from,
          typeof content === 'string' ? { text: content } : content,
          { quoted: msg },
        ),
      react: (emoji) =>
        this.sock.sendMessage(from, { react: { text: emoji, key: msg.key } }),
    };

    // Each plugin is isolated: a throw here is caught by the caller and logged.
    await plugin.execute(ctx);
  }

  /** Soft restart: drop the current socket and reconnect from saved creds. */
  async restart() {
    logger.info('restart requested');
    this.reconnectAttempts = 0;
    try {
      await this.sock?.ws?.close();
    } catch {
      /* ignore */
    }
    // handleClose will fire from the socket close and reconnect; if it does not
    // (e.g. socket already gone), start explicitly after a short delay.
    setTimeout(() => {
      if (!this.sock || this.sock.ws?.readyState !== 1) {
        this.start().catch((err) =>
          logger.error({ err: err.message }, 'restart reconnect failed'),
        );
      }
    }, 2_000);
  }

  async shutdown() {
    this.stopping = true;
    this.plugins.stop();
    try {
      await new Promise((resolve) => {
        if (!this.server) return resolve();
        this.server.close(() => resolve());
        setTimeout(resolve, 2_000);
      });
    } catch {
      /* ignore */
    }
    try {
      await this.sock?.ws?.close();
    } catch {
      /* ignore */
    }
    logger.info('shutdown complete');
  }
}

export default CosmicBot;
