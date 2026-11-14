'use strict';
const fs = require('fs');
const path = require('path');
// Minimal .env loader (no dotenv dependency). Real environment variables win.
(function load() {
  let txt;
  try { txt = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8'); } catch (e) { return; }
  txt.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().startsWith('#')) return;
    const v = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  });
})();
