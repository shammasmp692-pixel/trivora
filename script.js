(function () {
  'use strict';
  document.documentElement.classList.remove('no-js');

  var SALES_WA = '971525163638';
  var SALES_EMAIL = 'sales@trivorauae.com';
  var API_BASE = (window.TRIVORA_API_BASE || '').replace(/\/$/, '');
  var STORE_KEY = 'trivora.enquiry.v1';

  var CATS = [
    'Guest Room Amenities',
    'Housekeeping & Linen Supplies',
    'Food & Beverage Supplies',
    'Lobby & Public Area Supplies',
    'Cleaning & Janitorial Products',
    'Back Office & Operational Supplies',
    'Custom & Branded Items',
    'Spa, Wellness & Leisure Supplies'
  ];
  // Names are descriptive labels for the photos in the company profile (no specs or prices claimed).
  var PRODUCTS = [
    { id: 'coffee-tray', name: 'Tea & Coffee Tray Set', cat: CATS[0] },
    { id: 'bath-amenities-slippers', name: 'Bath Amenities & Slippers', cat: CATS[0] },
    { id: 'minibar-hairdryer', name: 'Minibar, Hair Dryer & Waste Bin', cat: CATS[0] },
    { id: 'housekeeping-trolleys', name: 'Housekeeping Trolleys', cat: CATS[1] },
    { id: 'dinnerware', name: 'Dinnerware', cat: CATS[2] },
    { id: 'glassware', name: 'Glassware', cat: CATS[2] },
    { id: 'cutlery', name: 'Cutlery', cat: CATS[2] },
    { id: 'chafing-dish', name: 'Chafing Dish', cat: CATS[2] },
    { id: 'commercial-range', name: 'Commercial Range', cat: CATS[2] },
    { id: 'banquet-chairs', name: 'Banquet Chairs', cat: CATS[2] },
    { id: 'buffet-risers', name: 'Buffet Risers', cat: CATS[2] },
    { id: 'luggage-trolleys', name: 'Luggage Trolleys', cat: CATS[3] },
    { id: 'signage-stands', name: 'Signage Stands', cat: CATS[3] },
    { id: 'no-parking-sign', name: 'No Parking Sign', cat: CATS[3] },
    { id: 'bins-ashtrays', name: 'Bins & Ashtrays', cat: CATS[3] },
    { id: 'rope-stanchions', name: 'Rope Stanchions', cat: CATS[3] },
    { id: 'belt-barriers', name: 'Belt Barriers', cat: CATS[3] },
    { id: 'wet-floor-signs', name: 'Folding Floor Signs', cat: CATS[4] }
  ].map(function (p) { p.img = 'assets/images/products/' + p.id + '.jpg'; return p; });

  var CLIENTS = [
    ['riu', 'RIU Hotels & Resorts'], ['asiana-grand', 'Asiana Grand Hotel'], ['hilton', 'Hilton'],
    ['ritz-carlton', 'The Ritz-Carlton'], ['crowne-plaza', 'Crowne Plaza by IHG'], ['sheraton', 'Sheraton Hotels & Resorts'],
    ['radisson-blu', 'Radisson Blu'], ['millennium', 'Millennium Hotels and Resorts'], ['fairmont', 'Fairmont Hotels & Resorts'],
    ['movenpick', 'Mövenpick Hotels & Resorts'], ['taj', 'Taj Hotels Resorts and Palaces'], ['address-downtown', 'Address Downtown'],
    ['rotana', 'Rotana Hotels & Resorts'], ['le-meridien', 'Le Méridien'], ['jw-marriott', 'JW Marriott'], ['grand-hyatt', 'Grand Hyatt']
  ];

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  /* ---------- enquiry store ---------- */
  var selected = [], qty = {};
  function clampQty(n) { n = parseInt(n, 10); return isNaN(n) || n < 1 ? 1 : Math.min(n, 99999); }
  try {
    var saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}');
    var ids = Array.isArray(saved) ? saved : (saved.ids || []);
    selected = ids.filter(function (id) { return PRODUCTS.some(function (p) { return p.id === id; }); });
    selected.forEach(function (id) { qty[id] = clampQty(saved.qty && saved.qty[id]); });
  } catch (e) { selected = []; qty = {}; }
  function persist() { try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ ids: selected, qty: qty })); } catch (e) { /* ignore */ } }
  function line(p) { return p.name + ' × ' + (qty[p.id] || 1); }
  function byId(id) { return PRODUCTS.filter(function (p) { return p.id === id; })[0]; }
  function items() { return selected.map(byId).filter(Boolean); }

  /* ---------- header ---------- */
  var header = $('#header'), nav = $('#nav'), burger = $('#burger');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { header.classList.toggle('solid', !en[0].isIntersecting); }).observe($('#top-sentinel'));
  } else {
    window.addEventListener('scroll', function () { header.classList.toggle('solid', window.scrollY > 40); }, { passive: true });
  }
  function setMenu(open) {
    nav.classList.toggle('open', open);
    header.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
  }
  burger.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); burger.focus(); } });

  /* ---------- products ---------- */
  var activeCat = 'All', query = '';
  var chips = $('#chips'), grid = $('#grid'), countEl = $('#count'), emptyEl = $('#empty');
  ['All'].concat(CATS).forEach(function (c) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = c; b.dataset.cat = c;
    b.setAttribute('aria-pressed', String(c === 'All'));
    chips.appendChild(b);
  });
  chips.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    activeCat = b.dataset.cat;
    Array.prototype.forEach.call(chips.children, function (c) { c.setAttribute('aria-pressed', String(c === b)); });
    renderProducts();
  });
  var t;
  $('#search').addEventListener('input', function (e) {
    clearTimeout(t); var v = e.target.value;
    t = setTimeout(function () { query = v.trim().toLowerCase(); renderProducts(); }, 120);
  });

  function renderProducts() {
    var onRequest = !query && activeCat !== 'All' && !PRODUCTS.some(function (p) { return p.cat === activeCat; });
    $('#onreq').hidden = !onRequest;
    if (onRequest) $('#onreqCat').textContent = activeCat;
    var list = PRODUCTS.filter(function (p) {
      return (activeCat === 'All' || p.cat === activeCat) && (!query || (p.name + ' ' + p.cat).toLowerCase().indexOf(query) > -1);
    });
    grid.innerHTML = list.map(function (p) {
      var on = selected.indexOf(p.id) > -1;
      return '<li class="pcard"><img src="' + p.img + '" width="360" height="280" loading="lazy" alt="' + esc(p.name) + '">' +
        '<div class="pbody"><span class="pcat">' + esc(p.cat) + '</span><h3 class="pname">' + esc(p.name) + '</h3>' +
        '<button type="button" class="add" data-id="' + p.id + '" aria-pressed="' + on + '">' + (on ? '✓ Added' : '+ Add to enquiry') + '</button></div></li>';
    }).join('');
    emptyEl.hidden = list.length > 0 || onRequest;
    countEl.textContent = list.length + (list.length === 1 ? ' product' : ' products');
  }
  grid.addEventListener('click', function (e) {
    var b = e.target.closest('.add'); if (!b) return;
    toggle(b.dataset.id);
  });
  function toggle(id) {
    var i = selected.indexOf(id);
    if (i > -1) { selected.splice(i, 1); delete qty[id]; } else { selected.push(id); qty[id] = 1; }
    persist(); sync();
  }

  /* ---------- message builders ---------- */
  function listText() { return items().map(function (p, i) { return (i + 1) + '. ' + line(p); }).join('\n'); }
  function enquiryMessage(extra) {
    var m = 'Hello Trivora, I would like to enquire about the following products:\n' + (items().length ? listText() : '(no items selected)');
    if (extra) m += '\n\n' + extra;
    return m;
  }
  function waLink(msg) { return 'https://wa.me/' + SALES_WA + '?text=' + encodeURIComponent(msg); }
  function mailLink(msg, subject) { return 'mailto:' + SALES_EMAIL + '?subject=' + encodeURIComponent(subject || 'Product enquiry') + '&body=' + encodeURIComponent(msg); }

  /* ---------- drawer ---------- */
  var drawer = $('#drawer'), scrim = $('#scrim'), lastFocus = null;
  function refreshLinks() {
    var l = items(), m = enquiryMessage();
    $('#dWa').href = waLink(m); $('#dMail').href = mailLink(m);
    $('#formItems').innerHTML = l.length ? '<ul>' + l.map(function (p) { return '<li>' + esc(line(p)) + '</li>'; }).join('') + '</ul>' : 'None selected. Add products above, or describe your needs in the message.';
  }
  function sync() {
    $('#enqCount').textContent = selected.length;
    var l = items();
    $('#dList').innerHTML = l.map(function (p) {
      return '<li><img src="' + p.img + '" width="64" height="50" alt=""><span class="nm">' + esc(p.name) + '</span>' +
        '<span class="qty"><button type="button" data-q="-1" data-id="' + p.id + '" aria-label="Decrease quantity of ' + esc(p.name) + '">−</button>' +
        '<input type="number" min="1" max="99999" inputmode="numeric" value="' + (qty[p.id] || 1) + '" data-qin="' + p.id + '" aria-label="Quantity of ' + esc(p.name) + '">' +
        '<button type="button" data-q="1" data-id="' + p.id + '" aria-label="Increase quantity of ' + esc(p.name) + '">+</button></span>' +
        '<button type="button" data-rm="' + p.id + '" aria-label="Remove ' + esc(p.name) + '">Remove</button></li>';
    }).join('');
    $('#dEmpty').hidden = l.length > 0;
    var wa = $('#dWa'), ml = $('#dMail');
    refreshLinks();
    wa.classList.toggle('disabled', !l.length); ml.classList.toggle('disabled', !l.length);
    wa.setAttribute('aria-disabled', String(!l.length)); ml.setAttribute('aria-disabled', String(!l.length));
    Array.prototype.forEach.call(grid.querySelectorAll('.add'), function (b) {
      var on = selected.indexOf(b.dataset.id) > -1;
      b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '✓ Added' : '+ Add to enquiry';
    });
  }
  function openDrawer() {
    lastFocus = document.activeElement;
    scrim.hidden = false; drawer.classList.add('open'); drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $('#drawerClose').focus();
  }
  function closeDrawer() {
    drawer.classList.remove('open'); drawer.setAttribute('aria-hidden', 'true'); scrim.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $('#enqBtn').addEventListener('click', openDrawer);
  $('#drawerClose').addEventListener('click', closeDrawer);
  scrim.addEventListener('click', closeDrawer);
  $('#dForm').addEventListener('click', closeDrawer);
  $('#dList').addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (b) { toggle(b.dataset.rm); if (!drawer.contains(document.activeElement)) $('#drawerClose').focus(); } });
  function setQty(id, n) { qty[id] = clampQty(n); persist(); refreshLinks(); }
  $('#dList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-q]'); if (!b) return;
    setQty(b.dataset.id, (qty[b.dataset.id] || 1) + parseInt(b.dataset.q, 10));
    b.parentNode.querySelector('input').value = qty[b.dataset.id];
  });
  $('#dList').addEventListener('change', function (e) {
    var i = e.target.closest('[data-qin]'); if (!i) return;
    setQty(i.dataset.qin, i.value); i.value = qty[i.dataset.qin];
  });
  [$('#dWa'), $('#dMail')].forEach(function (a) { a.addEventListener('click', function (e) { if (!items().length) e.preventDefault(); }); });
  document.addEventListener('keydown', function (e) {
    if (!drawer.classList.contains('open')) return;
    if (e.key === 'Escape') { closeDrawer(); return; }
    if (e.key !== 'Tab') return;
    var f = Array.prototype.filter.call(drawer.querySelectorAll('a[href],button'), function (n) { return !n.classList.contains('disabled') && n.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- clients ---------- */
  $('#clientGrid').innerHTML = CLIENTS.map(function (c) {
    return '<li class="reveal"><img src="assets/clients/' + c[0] + '.jpg" width="378" height="378" loading="lazy" alt="' + esc(c[1]) + '"></li>';
  }).join('');

  /* ---------- quote form ---------- */
  var form = $('#quoteForm'), status = $('#formStatus');
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  function field(n) { return form.elements[n]; }
  function setErr(n, msg) {
    var el = field(n), er = $('#e-' + n);
    el.classList.toggle('invalid', !!msg); el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (er) er.textContent = msg || '';
    return !msg;
  }
  function validate() {
    var ok = true;
    ok = setErr('name', field('name').value.trim().length < 2 ? 'Please enter your name.' : '') && ok;
    ok = setErr('email', !EMAIL_RE.test(field('email').value.trim()) ? 'Please enter a valid email address.' : '') && ok;
    var ph = field('phone').value.trim();
    ok = setErr('phone', ph && !/^\+?[0-9 ()\-]{7,20}$/.test(ph) ? 'Please enter a valid phone number.' : '') && ok;
    if (!ok) { var bad = form.querySelector('.invalid'); if (bad) bad.focus(); }
    return ok;
  }
  function payload() {
    return {
      name: field('name').value.trim(), company: field('company').value.trim(), email: field('email').value.trim(),
      phone: field('phone').value.trim(), message: field('message').value.trim(),
      items: items().map(line), website: field('website').value
    };
  }
  function detailsText(d) {
    return 'Name: ' + d.name + (d.company ? '\nCompany: ' + d.company : '') + '\nEmail: ' + d.email + (d.phone ? '\nPhone: ' + d.phone : '') + (d.message ? '\nMessage: ' + d.message : '');
  }
  function say(msg, ok) { status.textContent = msg; status.className = 'status ' + (ok ? 'ok' : 'bad'); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validate()) return;
    var d = payload(), btn = form.querySelector('[type=submit]');
    btn.disabled = true; say('Sending…', true);
    var ctl = ('AbortController' in window) ? new AbortController() : null;
    var to = setTimeout(function () { if (ctl) ctl.abort(); }, 10000);
    fetch(API_BASE + '/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function () { say('Thank you. Your enquiry has been sent and our team will be in touch.', true); form.reset(); selected = []; persist(); sync(); })
      .catch(function () {
        say('We could not reach our server, so we opened your email app instead. Please press send there.', false);
        window.location.href = mailLink(enquiryMessage(detailsText(d)), 'Quote request from ' + d.name);
      })
      .then(function () { clearTimeout(to); btn.disabled = false; });
  });
  $('#formWa').addEventListener('click', function () {
    if (!validate()) return;
    window.open(waLink(enquiryMessage(detailsText(payload()))), '_blank', 'noopener');
  });
  ['name', 'email', 'phone'].forEach(function (n) { field(n).addEventListener('input', function () { if (field(n).classList.contains('invalid')) setErr(n, ''); }); });

  /* ---------- misc ---------- */
  $('#year').textContent = new Date().getFullYear();
  var waf = $('#waFloat'); waf.href = 'https://wa.me/' + SALES_WA + '?text=' + encodeURIComponent('Hello Trivora, I would like to know more about your products.');

  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
    }, { threshold: 0.12 });
    Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (n) { io.observe(n); });
  } else {
    Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (n) { n.classList.add('in'); });
  }

  renderProducts(); sync();
})();
