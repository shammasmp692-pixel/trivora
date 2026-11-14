'use strict';
require('./lib/env');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const wa = require('./lib/whatsapp');
const bot = require('./lib/bot');
const { validateEnquiry } = require('./lib/validate');
const { createLimiter } = require('./lib/ratelimit');

const ROOT = path.resolve(__dirname, '..');
const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);

app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' });
  next();
});

/* ---------- enquiry API ---------- */
const limiter = createLimiter(5, 10 * 60 * 1000);
const FALLBACK = { ok: false, fallback: 'mailto' };
function cors(req, res, next) {
  const o = process.env.ALLOWED_ORIGIN;
  if (o && req.headers.origin === o) {
    res.set({ 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}

app.post('/api/enquiry', cors, express.json({ limit: '20kb' }), async (req, res) => {
  const rl = limiter(req.ip);
  if (!rl.allowed) return res.status(429).set('Retry-After', String(rl.retryAfter)).json({ error: 'Too many enquiries. Please try again later.', ...FALLBACK });
  const body = req.body || {};
  if (typeof body.website === 'string' && body.website.trim()) return res.json({ ok: true }); // honeypot: pretend success
  const v = validateEnquiry(body);
  if (!v.ok) return res.status(400).json({ ok: false, errors: v.errors });
  if (!wa.configured() || !process.env.SALES_WHATSAPP) return res.status(503).json({ ...FALLBACK, error: 'WhatsApp automation not configured' });

  const d = v.data;
  const itemsText = d.items.length ? d.items.join(', ') : 'None selected';
  const phoneText = d.phone ? '+' + d.phone : '-';
  const leadText = 'New website enquiry\nName: ' + d.name + '\nCompany: ' + (d.company || '-') + '\nEmail: ' + d.email + '\nPhone: ' + phoneText + '\nItems: ' + itemsText + '\nMessage: ' + (d.message || '-');
  try {
    const tpl = process.env.WA_TEMPLATE_SALES;
    await (tpl ? wa.sendTemplate(process.env.SALES_WHATSAPP, tpl, [d.name, d.company, d.email, phoneText, itemsText, d.message]) : wa.sendText(process.env.SALES_WHATSAPP, leadText));
  } catch (e) {
    console.error('sales notification failed:', e.message);
    return res.status(502).json({ ...FALLBACK, error: 'Could not deliver enquiry' });
  }
  if (d.phone) { // best effort; never fails the request
    try {
      const tpl = process.env.WA_TEMPLATE_CUSTOMER;
      const conf = 'Hello ' + d.name + ', thank you for contacting Trivora Goods Wholesalers LLC. We have received your enquiry and our team will be in touch shortly.';
      await (tpl ? wa.sendTemplate(d.phone, tpl, [d.name]) : wa.sendText(d.phone, conf));
    } catch (e) { console.error('customer confirmation failed:', e.message); }
  }
  res.json({ ok: true });
});
app.options('/api/enquiry', cors);

/* ---------- WhatsApp webhook ---------- */
app.get('/webhook', (req, res) => {
  const tok = process.env.WA_VERIFY_TOKEN;
  if (tok && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === tok) {
    return res.status(200).type('text/plain').send(String(req.query['hub.challenge'] || ''));
  }
  res.sendStatus(403);
});
function sigOk(raw, header) {
  const secret = process.env.WA_APP_SECRET;
  if (!secret || typeof header !== 'string' || header.indexOf('sha256=') !== 0) return false;
  const expected = crypto.createHmac('sha256', secret).update(raw).digest();
  const got = Buffer.from(header.slice(7), 'hex');
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}
app.post('/webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!sigOk(raw, req.get('x-hub-signature-256'))) return res.sendStatus(401);
  res.sendStatus(200); // acknowledge immediately, process afterwards
  let json; try { json = JSON.parse(raw.toString('utf8')); } catch (e) { return; }
  if (!wa.configured()) return console.error('webhook received but WA_TOKEN/WA_PHONE_ID missing');
  bot.handleWebhook(json).catch((e) => console.error('webhook handler error:', e.message));
});

/* ---------- static site (allow-list only) ---------- */
const FILES = new Set(['index.html', 'styles.css', 'script.js', 'sitemap.xml', 'robots.txt']);
app.get(/^\/(.*)$/, (req, res, next) => {
  let rel; try { rel = decodeURIComponent(req.params[0]); } catch (e) { return res.sendStatus(400); }
  if (rel === '') rel = 'index.html';
  const ok = FILES.has(rel) || /^assets\/[A-Za-z0-9_\-\/]+\.(png|jpe?g|svg|webp)$/.test(rel);
  if (!ok) return next();
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file)) return next();
  res.set('Cache-Control', rel.indexOf('assets/') === 0 ? 'public, max-age=604800' : 'no-cache');
  res.sendFile(file);
});
app.use((req, res) => res.status(404).type('text/plain').send('Not found'));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  if (err && err.type === 'entity.too.large') return res.status(413).json({ ok: false, error: 'Payload too large' });
  console.error(err);
  res.status(500).json({ ok: false, error: 'Server error' });
});

const port = Number(process.env.PORT) || 3000;
if (require.main === module) {
  app.listen(port, () => console.log('Trivora server on http://localhost:' + port + ' (WhatsApp ' + (wa.configured() ? 'configured' : 'NOT configured: enquiries fall back to mailto') + ')'));
}
module.exports = app;
