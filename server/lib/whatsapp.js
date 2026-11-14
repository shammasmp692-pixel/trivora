'use strict';
// Thin WhatsApp Cloud API client. Config is read lazily so tests can set env first.
const cfg = () => ({
  token: process.env.WA_TOKEN, phoneId: process.env.WA_PHONE_ID,
  graph: (process.env.WA_GRAPH_URL || 'https://graph.facebook.com/v21.0').replace(/\/$/, ''),
  lang: process.env.WA_TEMPLATE_LANG || 'en'
});
const configured = () => { const c = cfg(); return !!(c.token && c.phoneId); };

async function post(payload) {
  const c = cfg();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(`${c.graph}/${c.phoneId}/messages`, {
      method: 'POST', signal: ctl.signal,
      headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload })
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`Graph API ${r.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : {};
  } finally { clearTimeout(t); }
}
const sendText = (to, body) => post({ to, type: 'text', text: { body: String(body).slice(0, 4000), preview_url: false } });
// Template params may not contain newlines/tabs or 4+ spaces.
const param = (v) => ({ type: 'text', text: String(v || '-').replace(/[\r\n\t]+/g, ', ').replace(/ {4,}/g, '   ').slice(0, 900) });
const sendTemplate = (to, name, values) => post({
  to, type: 'template',
  template: { name, language: { code: cfg().lang }, components: [{ type: 'body', parameters: values.map(param) }] }
});
const sendList = (to, { header, body, button, sections }) => post({
  to, type: 'interactive',
  interactive: { type: 'list', header: { type: 'text', text: header }, body: { text: body }, action: { button, sections } }
});
module.exports = { configured, sendText, sendTemplate, sendList };
