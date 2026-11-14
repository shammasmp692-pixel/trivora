# Trivora Goods Wholesalers LLC – website + WhatsApp automation

Single-page site (plain HTML/CSS/JS, no build step) plus an optional Node 18+ Express server that
(1) sends website enquiries to your sales WhatsApp, (2) confirms to the customer, and
(3) auto-replies to inbound WhatsApp messages. All copy and contacts come from `source/company-profile.pdf`.

```
index.html  styles.css  script.js  sitemap.xml  robots.txt
assets/            logo, leaf motif, products/ (18), clients/ (16)
server/            Express app (only dependency: express), tests in server/test
tools/             asset extraction (Python) and Playwright checks (dev only)
```

## Run locally

```bash
cd server
npm install
cp .env.example .env      # fill in values (see below)
npm start                 # http://localhost:3000
```

The server serves the site from an allow-list (index, css, js, sitemap, robots, `assets/*`). `/server`, `.env`,
`package.json`, `node_modules`, `tools` and `source` all return 404 (covered by the tests).
Without WhatsApp credentials the site still works: the enquiry form falls back to a prefilled `mailto:` link.

You can also open `index.html` directly or host it on any static host. Then set
`<script>window.TRIVORA_API_BASE='https://api.example.com'</script>` before `script.js`
and set `ALLOWED_ORIGIN` on the server.

## Environment (`server/.env`)

| Variable | Purpose |
|---|---|
| `WA_TOKEN` | Permanent system-user access token (Meta Business Settings) |
| `WA_PHONE_ID` | Phone number ID from WhatsApp > API Setup |
| `WA_VERIFY_TOKEN` | Any long random string; must match the webhook setup in Meta |
| `WA_APP_SECRET` | App secret (App settings > Basic); used to verify `X-Hub-Signature-256` |
| `SALES_WHATSAPP` | Sales number, digits only with country code (`971525163638`) |
| `PORT` | Default 3000 |
| `WA_TEMPLATE_SALES`, `WA_TEMPLATE_CUSTOMER`, `WA_TEMPLATE_LANG` | Optional approved templates (below) |
| `WA_TEMPLATE_SALES_FORWARD` | Optional template for forwarding inbound chats to sales (params: name, number, message) |
| `TRUST_PROXY` | `1` behind a reverse proxy so the 5-per-10-minutes rate limit uses real client IPs |
| `ALLOWED_ORIGIN` | Only if the site is hosted separately from the API |
| `WA_GRAPH_URL` | Override the Graph API base (used by tests) |

## Meta webhook setup

1. developers.facebook.com > your app > add the **WhatsApp** product; note the phone number ID.
2. Create a system user, give it the app and `whatsapp_business_messaging` permission, generate a permanent token (`WA_TOKEN`).
3. Deploy the server on a public **HTTPS** URL.
4. WhatsApp > Configuration > Webhook: callback URL `https://YOUR-DOMAIN/webhook`, verify token = `WA_VERIFY_TOKEN`. Subscribe to the **messages** field.
5. Send "hi" to the business number: you should get the welcome menu.

## Message templates (24-hour rule)

WhatsApp only allows free-text messages to a person within 24 hours of their last message to you.
A website visitor has not messaged you, and the sales number may be idle, so use approved templates in production:

- `WA_TEMPLATE_SALES` (category Utility), body with 6 variables, in this order:
  `New website enquiry from {{1}} ({{2}}). Email: {{3}}. Phone: {{4}}. Items: {{5}}. Message: {{6}}`
- `WA_TEMPLATE_CUSTOMER` (Utility), 1 variable:
  `Hello {{1}}, thank you for contacting Trivora Goods Wholesalers LLC. We have received your enquiry and our team will be in touch shortly.`

Create them in WhatsApp Manager > Message templates, wait for approval, then set the names in `.env`.
If unset, the server sends free text (works only inside the 24-hour window, so for sales: after the sales phone has messaged the business number).
If sending to sales fails, the API returns `503/502 {"fallback":"mailto"}` and the page opens a prefilled email so no lead is lost.

## Bot behaviour

Welcome list menu (Product categories, Request a quote, Delivery & pricing, Contact & location, Talk to our team),
keyword routing for free text, and forwarding of unrecognised messages or "talk to team" to `SALES_WHATSAPP`.
The menu is sent at most once per 6 hours per customer (kept in memory, so it resets when the process restarts; use Redis if you run several instances).
Rate limiting is also in memory, per process.

## Tests

```bash
node server/test/run-tests.js          # curl-style checks against a mock Graph API (45 checks)
cd tools && npm install && npx playwright install chromium
node screenshots.mjs http://localhost:3000   # screenshots at 1440/768/390 + UI assertions
python -I tools/extract-assets.py      # re-extract assets (needs: pip install pymupdf pillow)
```

## Deployment notes

- Any Node 18+ host (VPS, Render, Railway, Fly) behind HTTPS. Run with a process manager (pm2/systemd) and set `TRUST_PROXY=1`.
- Never commit `.env`. Rotate `WA_TOKEN` if exposed.
- Replace the product photos in `assets/products` with higher-resolution images when available (keep file names, or update `PRODUCTS` in `script.js`).
