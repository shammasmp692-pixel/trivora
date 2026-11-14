'use strict';
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
// strip control chars and angle brackets; collapse whitespace on single-line fields
function clean(v, max, multiline) {
  if (typeof v !== 'string') return '';
  let s = v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[<>]/g, '');
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
}
// Returns digits in international format (no +) or '' if unusable. UAE local 05x numbers are expanded.
function normalizePhone(v) {
  let d = String(v || '').replace(/[^\d+]/g, '');
  if (!d) return '';
  d = d.replace(/^\+/, '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (/^05\d{8}$/.test(d)) d = '971' + d.slice(1);
  return d.length >= 8 && d.length <= 15 ? d : '';
}
function validateEnquiry(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = {};
  const name = clean(b.name, 100);
  const email = clean(b.email, 150);
  const company = clean(b.company, 120);
  const message = clean(b.message, 1500, true);
  const rawPhone = clean(b.phone, 30);
  const phone = normalizePhone(rawPhone);
  const items = (Array.isArray(b.items) ? b.items : []).slice(0, 30).map((i) => clean(i, 80)).filter(Boolean);
  if (name.length < 2) errors.name = 'Name is required';
  if (!EMAIL_RE.test(email)) errors.email = 'Valid email is required';
  if (rawPhone && !phone) errors.phone = 'Phone number is not valid';
  return { ok: !Object.keys(errors).length, errors, data: { name, email, company, message, phone, items } };
}
module.exports = { validateEnquiry, normalizePhone, clean };
