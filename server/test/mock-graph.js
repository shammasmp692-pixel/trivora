'use strict';
// Mock of the WhatsApp Graph API: records every POST /:phoneId/messages; GET /__log returns them.
const http = require('http');
const log = [];
let failNext = false;
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/__log') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify(log)); }
  if (req.method === 'POST' && req.url === '/__reset') { log.length = 0; failNext = false; return res.end('ok'); }
  if (req.method === 'POST' && req.url === '/__fail') { failNext = true; return res.end('ok'); }
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    let json = null; try { json = JSON.parse(body); } catch (e) { /* ignore */ }
    log.push({ url: req.url, auth: req.headers.authorization, body: json });
    if (failNext) { failNext = false; res.statusCode = 500; return res.end('{"error":"mock failure"}'); }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.MOCK' }] }));
  });
});
module.exports = server;
if (require.main === module) server.listen(Number(process.env.MOCK_PORT) || 4010, () => console.log('mock graph up'));
