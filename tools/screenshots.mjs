// Usage: node tools/screenshots.mjs [baseUrl]   (server must be running; default http://localhost:3000)
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.argv[2] || 'http://localhost:3000';
const OUT = new URL('./shots/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ok   ' : '  FAIL ') + m); };

const browser = await chromium.launch();
for (const [w, h, name] of [[1440, 900, 'desktop'], [768, 1024, 'tablet'], [390, 844, 'mobile']]) {
  console.log(`\n== ${name} ${w}px`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push('requestfailed ' + r.url()); });
  page.on('response', (r) => { if (r.status() >= 400 && !/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push(r.status() + ' ' + r.url()); });
  await page.goto(BASE, { waitUntil: 'load' });
  await page.addStyleTag({ content: '.reveal{opacity:1!important;transform:none!important}' });

  const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  ok(sw[0] <= sw[1], `no horizontal scroll (${sw[0]} <= ${sw[1]})`);
  const small = await page.evaluate(() => [...document.querySelectorAll('p,li,a,label,button,small')].filter((e) => e.offsetParent && parseFloat(getComputedStyle(e).fontSize) < 12 && e.textContent.trim()).length);
  ok(small === 0, 'no text under 12px');
  await page.screenshot({ path: `${OUT}${name}-top.png` });

  // header turns solid after scroll
  await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.getElementById('header').classList.contains('solid')), 'header turns white after scrolling');

  if (w <= 860) {
    await page.click('#burger'); await page.waitForTimeout(350);
    ok(await page.getAttribute('#burger', 'aria-expanded') === 'true', 'mobile menu opens');
    const box = await page.locator('#burger').boundingBox();
    ok(box.width >= 44 && box.height >= 44, 'hamburger is >= 44px');
    await page.screenshot({ path: `${OUT}${name}-menu.png` });
    await page.click('#nav a[href="#products"]'); await page.waitForTimeout(700);
    ok(await page.getAttribute('#burger', 'aria-expanded') === 'false', 'menu closes after choosing a link');
  } else {
    await page.click('#nav a[href="#products"]'); await page.waitForTimeout(700);
  }

  // products: filter, search, add, drawer
  ok(await page.locator('#grid .pcard').count() === 18, '18 product cards render');
  const cols = await page.evaluate(() => getComputedStyle(document.getElementById('grid')).gridTemplateColumns.split(' ').length);
  ok(cols === (w >= 1025 ? 4 : w >= 641 ? 3 : 2), `product grid columns = ${cols}`);
  await page.click('.chip[data-cat="Food & Beverage Supplies"]');
  ok(await page.locator('#grid .pcard').count() === 7, 'category filter -> 7 F&B products');
  await page.click('.chip[data-cat="All"]');
  await page.fill('#search', 'trolley'); await page.waitForTimeout(300);
  ok(await page.locator('#grid .pcard').count() === 2, 'search "trolley" -> 2 products');
  await page.fill('#search', 'zzzz'); await page.waitForTimeout(300);
  ok(await page.locator('#empty').isVisible(), 'empty state shown for no results');
  await page.fill('#search', ''); await page.waitForTimeout(300);

  await page.locator('.add[data-id="glassware"]').click();
  await page.locator('.add[data-id="cutlery"]').click();
  ok(await page.textContent('#enqCount') === '2', 'enquiry count = 2');
  await page.click('#enqBtn'); await page.waitForTimeout(450);
  ok(await page.locator('#dList li').count() === 2, 'drawer lists 2 items');
  const wa = await page.getAttribute('#dWa', 'href');
  ok(wa.startsWith('https://wa.me/971525163638?text=') && decodeURIComponent(wa).includes('1. Glassware') && decodeURIComponent(wa).includes('2. Cutlery'), 'WhatsApp link prefilled with list');
  const mail = await page.getAttribute('#dMail', 'href');
  ok(mail.startsWith('mailto:sales@trivorauae.com') && decodeURIComponent(mail).includes('Cutlery'), 'mailto link prefilled');
  await page.screenshot({ path: `${OUT}${name}-drawer.png` });
  await page.click('[data-rm="glassware"]');
  ok(await page.locator('#dList li').count() === 1, 'remove button works');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  ok(!(await page.locator('#drawer').evaluate((d) => d.classList.contains('open'))), 'Escape closes drawer');
  await page.reload(); await page.waitForTimeout(300);
  ok(await page.textContent('#enqCount') === '1', 'enquiry persisted in sessionStorage across reload');

  // form validation + fallback
  await page.locator('#quoteForm').scrollIntoViewIfNeeded();
  await page.click('#quoteForm [type=submit]');
  ok(await page.locator('#e-name').textContent() !== '' && await page.locator('#e-email').textContent() !== '', 'form validation messages shown');
  await page.screenshot({ path: `${OUT}${name}-contact.png` });

  // full page
  await page.screenshot({ path: `${OUT}${name}-full.png`, fullPage: true });
  ok(errors.length === 0, 'no console/network errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nall checks passed');
process.exit(fails ? 1 : 0);
