'use strict';
// End-to-end tests against a mock Graph API. Run: node server/test/run-tests.js
const { spawn } = require('child_process');
const crypto = require('crypto');
const path = require('path');
const mock = require('./mock-graph');

const MOCK = 4010, APP = 4011, APP2 = 4012, SECRET = 'test-secret';
const SALES = '971525163638';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function start(port, env) {
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')], { env: { ...process.env, PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stderr.on('data', () => {}); // keep quiet; expected errors are logged for failure cases
  return p;
}
async function waitUp(port) { for (let i = 0; i < 50; i++) { try { await fetch(`http://localhost:${port}/robots.txt`); return; } catch (e) { await sleep(100); } } throw new Error('server did not start'); }
const U = (p, port) => `http://localhost:${port || APP}${p}`;
const postJson = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const sign = (raw) => 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
const mockLog = async () => (await fetch(`http://localhost:${MOCK}/__log`)).json();
const mockReset = () => fetch(`http://localhost:${MOCK}/__reset`, { method: 'POST' });
const inbound = (from, msg) => JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: { contacts: [{ wa_id: from, profile: { name: 'Test Guest' } }], messages: [Object.assign({ from }, msg)] } }] }] });
async function send(raw, sig) { return fetch(U('/webhook'), { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': sig === undefined ? sign(raw) : sig }, body: raw }); }
const text = (body) => ({ type: 'text', text: { body } });

(async () => {
  await new Promise((r) => mock.listen(MOCK, r));
  const cfg = { WA_TOKEN: 'tok', WA_PHONE_ID: '111', WA_VERIFY_TOKEN: 'verify-me', WA_APP_SECRET: SECRET, SALES_WHATSAPP: SALES, WA_GRAPH_URL: `http://localhost:${MOCK}` };
  const s1 = start(APP, cfg);
  const s2 = start(APP2, { WA_TOKEN: '', WA_PHONE_ID: '', SALES_WHATSAPP: SALES });
  try {
    await waitUp(APP); await waitUp(APP2);

    console.log('Static handler');
    ok((await fetch(U('/'))).status === 200, 'GET / = 200');
    ok((await fetch(U('/styles.css'))).status === 200, 'GET /styles.css = 200');
    ok((await fetch(U('/assets/logo-white.png'))).status === 200, 'GET asset = 200');
    for (const p of ['/server/index.js', '/server/package.json', '/server/.env', '/.env', '/package.json', '/node_modules/express/package.json', '/tools/extract-assets.py', '/source/company-profile.pdf', '/.git/config', '/assets/../server/index.js', '/%2e%2e/server/index.js', '/assets/%2e%2e/server/index.js']) {
      ok((await fetch(U(p))).status === 404, `GET ${p} = 404`);
    }

    console.log('POST /api/enquiry');
    await mockReset();
    let r = await postJson(U('/api/enquiry'), { name: 'Aisha Khan', company: 'Palm Hotel', email: 'aisha@palm.example', phone: '0501234567', message: 'Need 200 slippers', items: ['Glassware', 'Cutlery'] });
    ok(r.status === 200 && (await r.json()).ok === true, 'valid enquiry -> 200 ok');
    let log = await mockLog();
    ok(log.length === 2, 'two WhatsApp messages sent (sales + customer)');
    ok(log[0] && log[0].body.to === SALES && /Aisha Khan/.test(log[0].body.text.body) && /Glassware, Cutlery/.test(log[0].body.text.body), 'sales lead contains details');
    ok(log[1] && log[1].body.to === '971501234567', 'customer confirmation sent to normalised number (05x -> 971)');
    ok(log[0] && log[0].auth === 'Bearer tok' && log[0].url === '/111/messages', 'Graph call uses bearer token and phone id');

    r = await postJson(U('/api/enquiry'), { name: 'A', email: 'nope', phone: '12' });
    const j = await r.json();
    ok(r.status === 400 && j.errors && j.errors.name && j.errors.email && j.errors.phone, 'invalid enquiry -> 400 with field errors');

    await mockReset();
    r = await postJson(U('/api/enquiry'), { name: 'Bot', email: 'bot@spam.example', website: 'http://spam' });
    ok(r.status === 200 && (await mockLog()).length === 0, 'honeypot -> silent 200, nothing sent');

    r = await postJson(U('/api/enquiry'), { name: '<b>Bob</b>', email: 'bob@x.example', message: 'x'.repeat(5000) });
    log = await mockLog();
    ok(r.status === 200 && log.length === 1 && !/<b>/.test(log[0].body.text.body) && log[0].body.text.body.length < 1800, 'sanitises markup and caps length; no phone -> no customer message');

    r = await postJson(U('/api/enquiry'), { name: 'Five', email: 'five@x.example' });
    ok(r.status === 200, '5th request accepted');
    r = await postJson(U('/api/enquiry'), { name: 'Six', email: 'six@x.example' });
    ok(r.status === 429 && !!r.headers.get('retry-after'), '6th request within window -> 429 + Retry-After');

    r = await fetch(U('/api/enquiry'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
    ok(r.status === 429 || r.status === 400, 'malformed JSON rejected (429 since limiter exhausted)');

    r = await postJson(U('/api/enquiry', APP2), { name: 'Cara', email: 'cara@x.example' });
    const j2 = await r.json();
    ok(r.status === 503 && j2.fallback === 'mailto', 'unconfigured server -> 503 with mailto fallback');

    console.log('Webhook verification & signature');
    r = await fetch(U('/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345'));
    ok(r.status === 200 && (await r.text()) === '12345', 'GET /webhook correct token echoes challenge');
    r = await fetch(U('/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345'));
    ok(r.status === 403, 'GET /webhook wrong token -> 403');
    await mockReset();
    let raw = inbound('971500000001', text('hello'));
    r = await send(raw, 'sha256=' + 'a'.repeat(64));
    ok(r.status === 401, 'bad signature -> 401');
    r = await send(raw, 'sha256=zz');
    ok(r.status === 401, 'malformed signature -> 401');
    r = await send(raw, '');
    ok(r.status === 401, 'empty signature -> 401');
    r = await fetch(U('/webhook'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw });
    ok(r.status === 401, 'missing signature header -> 401');
    await sleep(200);
    ok((await mockLog()).length === 0, 'unsigned requests triggered no outbound messages');

    console.log('Inbound bot');
    r = await send(raw);
    ok(r.status === 200, 'signed inbound -> 200');
    await sleep(300);
    log = await mockLog();
    ok(log.length === 1 && log[0].body.type === 'interactive' && log[0].body.to === '971500000001' && log[0].body.interactive.action.sections[0].rows.length === 5, 'welcome list menu with 5 options sent');
    const titles = log[0].body.interactive.action.sections[0].rows.map((x) => x.title).join('|');
    ok(titles === 'Product categories|Request a quote|Delivery & pricing|Contact & location|Talk to our team', 'menu titles match spec');
    await send(inbound('971500000001', text('hi')));
    await sleep(300);
    log = await mockLog();
    ok(log.length === 2 && log[1].body.type === 'text', 'second greeting inside 6h does NOT repeat the menu');

    await send(inbound('971500000001', text('what is your delivery and pricing?')));
    await send(inbound('971500000001', text('where is your office?')));
    await send(inbound('971500000001', text('show me your product range')));
    await sleep(500);
    log = await mockLog();
    const bodies = log.slice(2).map((x) => (x.body.text && x.body.text.body) || '');
    ok(/competitive pricing/.test(bodies[0]), 'keyword: delivery/pricing routed');
    ok(/Al Muteena/.test(bodies[1]) && /\+971 52 516 36 38/.test(bodies[1]), 'keyword: contact/location routed');
    ok(/Guest Room Amenities/.test(bodies[2]), 'keyword: products routed');

    await mockReset();
    await send(inbound('971500000002', { type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'team', title: 'Talk to our team' } } }));
    await sleep(400);
    log = await mockLog();
    ok(log.some((x) => x.body.to === SALES && /Test Guest/.test(x.body.text.body)) && log.some((x) => x.body.to === '971500000002'), '"Talk to our team" forwards to sales and replies to customer');

    await mockReset();
    await send(inbound('971500000003', text('do you sell fresh flowers?')));
    await sleep(400);
    log = await mockLog();
    ok(log.some((x) => x.body.to === SALES) && log.some((x) => x.body.to === '971500000003' && x.body.type === 'interactive'), 'unrecognised text forwarded to sales; first contact gets menu');
    await send(inbound('971500000003', text('and balloons?')));
    await sleep(400);
    log = await mockLog();
    ok(log.filter((x) => x.body.type === 'interactive').length === 1, 'menu not repeated on second unrecognised message');
    ok(log.filter((x) => x.body.to === SALES).length === 2, 'both unrecognised messages forwarded to sales');
  } catch (e) {
    fail++; console.log('  FAIL exception: ' + e.stack);
  } finally {
    s1.kill(); s2.kill(); mock.close();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
