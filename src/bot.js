import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import config, { validateConfig } from './config.js';
import logger from './logger.js';
import PluginManager from './pluginLoader.js';

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
    });
    this.sock = null;
    this.reconnectAttempts = 0;
    this.pairingRequested = false;
    this.stopping = false;
  }

  async init() {
    const errors = validateConfig();
    if (errors.length) {
      for (const e of errors) logger.error(e);
      throw new Error('invalid configuration');
    }
    await this.plugins.loadAll();
    this.plugins.watch();
  }

  nextBackoffMs() {
    // Exponential backoff capped at 30s, with jitter.
    const base = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempts);
    return base + Math.floor(Math.random() * 1_000);
  }

  async start() {
    const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: socketLogger,
      auth: state,
      // We render the QR ourselves so we can also support pairing codes.
      printQRInTerminal: false,
      browser: ['Cosmic-WA-Bot', 'Chrome', '1.0.0'],
      markOnlineOnConnect: false,
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
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(config.botNumber);
          const pretty = code?.match(/.{1,4}/g)?.join('-') || code;
          logger.info('──────────────────────────────');
          logger.info(`Pairing code for +${config.botNumber}: ${pretty}`);
          logger.info('Enter it in WhatsApp > Linked devices > Link with phone number');
          logger.info('──────────────────────────────');
        } catch (err) {
          logger.error({ err: err.message }, 'failed to request pairing code');
        }
      }, 3_000);
    }

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && config.authMethod === 'qr') {
        logger.info('Scan this QR in WhatsApp > Linked devices > Link a device:');
        qrcodeTerminal.generate(qr, { small: true });
      }

      if (connection === 'open') {
        this.reconnectAttempts = 0;
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
    if (!config.owners.length) return true;
    return config.owners.includes(jid);
  }

  async onMessages({ messages, type }) {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      await this.dispatch(msg).catch((err) =>
        logger.error({ err: err.message }, 'plugin dispatch error'),
      );
    }
  }

  async dispatch(msg) {
    const text = extractText(msg).trim();
    if (!text) return;

    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

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
    if (plugin.adminOnly && !this.isOwner(sender)) {
      await this.sock.sendMessage(from, { text: '🚫 Not allowed.' }, { quoted: msg });
      return;
    }

    const ctx = {
      sock: this.sock,
      msg,
      from,
      sender,
      text,
      args,
      command: commandName,
      prefix: config.prefix,
      plugins: this.plugins,
      reply: (content) =>
        this.sock.sendMessage(
          from,
          typeof content === 'string' ? { text: content } : content,
          { quoted: msg },
        ),
      logger,
    };

    // Each plugin is isolated: a throw here is caught by the caller and logged.
    await plugin.execute(ctx);
  }

  async shutdown() {
    this.stopping = true;
    this.plugins.stop();
    try {
      await this.sock?.ws?.close();
    } catch {
      /* ignore */
    }
    logger.info('shutdown complete');
  }
}

export default CosmicBot;
