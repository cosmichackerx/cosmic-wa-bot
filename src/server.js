import express from 'express';
import QRCode from 'qrcode';
import config from './config.js';
import logger from './logger.js';

/**
 * Lightweight web server, adapted from X-Bot's lib/server.js and hardened.
 *
 *   GET /        -> tiny status page
 *   GET /health  -> JSON health check (for uptime pingers / Render)
 *   GET /qr      -> current login QR as a PNG page   (requires WEB_TOKEN)
 *   GET /pair    -> request a pairing code as JSON    (requires WEB_TOKEN)
 *
 * The QR and pairing endpoints expose login control, so they are only mounted
 * when WEB_TOKEN is set and require ?token=<WEB_TOKEN>. Without a token they
 * return 404 and the server is a pure keep-alive/health endpoint.
 */
export function startWebServer(bot) {
  const app = express();
  app.disable('x-powered-by');

  const connected = () => Boolean(bot.sock?.user);

  app.get('/', (req, res) => {
    res
      .type('html')
      .send(
        `<!doctype html><meta charset="utf-8"><title>${config.botName}</title>` +
          `<body style="font-family:system-ui;background:#0d1117;color:#c9d1d9;text-align:center;padding:40px">` +
          `<h1>🚀 ${config.botName}</h1><p>v${config.version}</p>` +
          `<p>Status: ${connected() ? '✅ connected' : '⏳ not linked yet'}</p>` +
          `</body>`,
      );
  });

  app.get('/health', (req, res) => {
    res.json({
      name: config.botName,
      version: config.version,
      status: 'ok',
      connected: connected(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  if (config.webToken) {
    const auth = (req, res, next) => {
      if (req.query.token !== config.webToken) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      next();
    };

    app.get('/qr', auth, async (req, res) => {
      try {
        if (connected()) return res.type('html').send('<p>Already linked ✅</p>');
        if (!bot.latestQR) {
          return res
            .type('html')
            .send('<p>No QR available yet. Refresh in a few seconds.</p>');
        }
        const dataUrl = await QRCode.toDataURL(bot.latestQR, { width: 320 });
        res
          .type('html')
          .send(
            `<!doctype html><meta charset="utf-8"><title>Scan QR</title>` +
              `<body style="background:#0d1117;text-align:center;padding:30px">` +
              `<img src="${dataUrl}" alt="QR"/></body>`,
          );
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    app.get('/pair', auth, async (req, res) => {
      try {
        const code = await bot.requestPairing(req.query.phone);
        res.json({ code });
      } catch (err) {
        res.json({ error: err.message });
      }
    });
  }

  const server = app.listen(config.port, () =>
    logger.info({ port: config.port }, 'web server listening'),
  );
  server.on('error', (err) =>
    logger.error({ err: err.message }, 'web server error'),
  );
  return server;
}

export default startWebServer;
