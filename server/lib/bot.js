'use strict';
const wa = require('./whatsapp');

const MENU_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const lastMenu = new Map(); // customer wa_id -> timestamp of last menu
setInterval(() => { const now = Date.now(); for (const [k, v] of lastMenu) if (now - v > MENU_COOLDOWN_MS) lastMenu.delete(k); }, 60 * 60 * 1000).unref();

const SITE = 'https://www.trivorauae.com';
// Reply copy only uses facts from the company profile.
const TEXT = {
  categories: 'Our hospitality product categories:\n• Guest Room Amenities\n• Housekeeping & Linen Supplies\n• Food & Beverage Supplies\n• Lobby & Public Area Supplies\n• Cleaning & Janitorial Products\n• Back Office & Operational Supplies\n• Custom & Branded Items\n• Spa, Wellness & Leisure Supplies\n\nBrowse the range and build an enquiry list at ' + SITE + '/#products',
  quote: 'To request a quote, tell us the items and quantities you need, your hotel or company name and your email. You can also pick products and send a list at ' + SITE + '/#products. Our team will reply with a quotation.',
  delivery: 'Trivora offers competitive pricing models and reliable, timely delivery, with flexible sourcing options and scalable order capacity. For prices and delivery for your items, reply "quote" or "talk to team" and our sales team will assist you.',
  contact: 'Trivora Goods Wholesalers LLC\nBin Complex, Al Muteena, PO Box : 94769, Dubai, UAE\nPhone: +971 52 516 36 38\nEmail: sales@trivorauae.com\nWeb: www.trivorauae.com',
  team: 'Thank you. We have passed your message to our sales team and they will contact you here shortly.',
  hint: 'Hello again! Reply with a keyword: products, quote, delivery, contact, or "talk to team".',
  ack: 'Thanks for your message. We have forwarded it to our sales team and they will reply shortly.'
};
const MENU = {
  header: 'Trivora Goods Wholesalers',
  body: 'Welcome to Trivora, your hospitality wholesale partner. How can we help you today?',
  button: 'Choose an option',
  sections: [{ title: 'Menu', rows: [
    { id: 'categories', title: 'Product categories', description: 'See what we supply to hotels' },
    { id: 'quote', title: 'Request a quote', description: 'Tell us what you need' },
    { id: 'delivery', title: 'Delivery & pricing', description: 'How we price and deliver' },
    { id: 'contact', title: 'Contact & location', description: 'Phone, email and address' },
    { id: 'team', title: 'Talk to our team', description: 'Speak with our sales team' }
  ] }]
};
const REPLY_KEYS = ['categories', 'quote', 'delivery', 'contact', 'team'];

function route(text) {
  const t = String(text || '').toLowerCase();
  if (/\b(talk|speak|human|agent|team|sales|representative|call me|person)\b/.test(t)) return 'team';
  if (/\b(quote|quotation|order|rfq|enquiry|inquiry)\b/.test(t)) return 'quote';
  if (/\b(deliver\w*|shipping|price\w*|pricing|cost|rate\w*)\b/.test(t)) return 'delivery';
  if (/\b(contact|location|address|phone|email|where|map|office)\b/.test(t)) return 'contact';
  if (/\b(product\w*|categor\w*|catalog\w*|catalogue|range|items?|supplies)\b/.test(t)) return 'categories';
  if (/^\s*(hi|hello|hey|hola|salam|assalam\w*|good (morning|afternoon|evening)|menu|start|help)\W*$/.test(t)) return 'menu';
  return 'unknown';
}

const menuDue = (to) => !lastMenu.has(to) || Date.now() - lastMenu.get(to) >= MENU_COOLDOWN_MS;
async function sendMenu(to) { lastMenu.set(to, Date.now()); return wa.sendList(to, MENU); }

async function forwardToSales(from, name, text) {
  const sales = process.env.SALES_WHATSAPP;
  if (!sales) return;
  const body = 'Customer message on WhatsApp\nFrom: ' + (name || 'Unknown') + ' (+' + from + ')\n\n' + String(text || '').slice(0, 1500);
  const tpl = process.env.WA_TEMPLATE_SALES_FORWARD;
  try { await (tpl ? wa.sendTemplate(sales, tpl, [name, from, text]) : wa.sendText(sales, body)); }
  catch (e) { console.error('forward to sales failed:', e.message); }
}

async function handleMessage(msg, contactName) {
  const from = msg.from;
  if (!from || from === process.env.SALES_WHATSAPP) return; // never auto-reply to our own sales line
  let key, text = '';
  if (msg.type === 'interactive') {
    const r = msg.interactive && (msg.interactive.list_reply || msg.interactive.button_reply);
    key = r && r.id; text = (r && r.title) || '';
    if (REPLY_KEYS.indexOf(key) < 0) key = 'unknown';
  } else if (msg.type === 'text') {
    text = (msg.text && msg.text.body) || ''; key = route(text);
  } else { key = 'unknown'; text = '[' + (msg.type || 'unsupported') + ' message]'; }

  if (key === 'menu') return menuDue(from) ? sendMenu(from) : wa.sendText(from, TEXT.hint);
  if (key === 'team') { await forwardToSales(from, contactName, text); return wa.sendText(from, TEXT.team); }
  if (REPLY_KEYS.indexOf(key) > -1) return wa.sendText(from, TEXT[key]);
  // unknown: always forward; show the menu at most once per 6 hours
  await forwardToSales(from, contactName, text);
  return menuDue(from) ? sendMenu(from) : wa.sendText(from, TEXT.ack);
}

async function handleWebhook(body) {
  if (!body || body.object !== 'whatsapp_business_account') return;
  for (const entry of body.entry || []) for (const ch of entry.changes || []) {
    const v = ch.value || {};
    const names = {};
    (v.contacts || []).forEach((c) => { names[c.wa_id] = c.profile && c.profile.name; });
    for (const m of v.messages || []) {
      try { await handleMessage(m, names[m.from]); } catch (e) { console.error('webhook message error:', e.message); }
    }
  }
}
module.exports = { handleWebhook, route };
