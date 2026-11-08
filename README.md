# Royal Egypt Group — Group Website

A responsive group portal for Royal Egypt Group and its three business divisions.

## Group structure and pages
- `index.html`: parent company hub — Royal Egypt Group, linked to the financial markets center.
- `markets.html`: investor information center with TradingView market widgets (EGX30/global indices, gold, financial news and economic calendar), world clocks, and reference FX rates.
- `properties.html`: Royal Egypt Properties searchable property catalogue and rule-based enquiry assistant.
- `coffee.html`: Royal Egypt Coffee division landing page (initial information page; not yet an online shop).
- `transportation.html`: Royal Egypt Transportation division landing page (initial information page; not yet a booking system).
- `assets/royal.css` and `assets/royal.js`: shared design and language/navigation assets.
- `royal-logo.jpg`: supplied company logo.

## Current property enquiry catalogue
1. Hurghada, Al Ahyaa — 4,000 m² investment land; buyer instalment option was supplied in the listing brief.
2. Stella di Mare, Zafarana / Ain Sokhna — furnished 110 m² villa; 3 bedrooms, 2 bathrooms, 36 m² terrace.
3. Suez, Nasser Street — administrative space up to 600 m² and 900 m² garage / basement.

This is not a live inventory feed. Prices, availability, legal status, boundaries, permitted use and payment terms must be confirmed before any transaction.

## Free-first hosting
- GitHub repository: `yasserabdelaziz83-maker/Royal-Egypt-Group`
- Cloudflare Pages static hosting; production branch `main`, framework preset None, build command empty, output directory repository root.
- No paid APIs, paid plugins, or paid subscriptions are required for the current static pages.
- Optional future services (database, server-side AI, booking/CRM) must be checked against current free quotas and must not be enabled if they introduce charges without explicit approval.

## Current functionality and limitations
- The property assistant is a lightweight browser-based guided matcher, not a connected LLM.
- Enquiry buttons open WhatsApp with a prefilled draft; the visitor reviews and sends it. The website does not automatically send WhatsApp messages or store leads.
- Coffee and Transportation are introductory landing pages. Product sales, inventory, payments, live transport availability and booking are not active.
- Secure staff dashboard, authenticated accounts, shared database, lead inbox and genuine AI agent are not active. Never put secrets or admin passwords in frontend code.

## Cloudflare Pages settings
- Production branch: `main`
- Framework preset: None
- Build command: leave blank
- Build output directory: `/`
- A commit to `main` should deploy automatically when the GitHub integration and auto-deploy are enabled. Verify the deployment log in Cloudflare Pages.

## Custom domain
The intended public domain is `www.royalegyptgroup.com`. It must be attached to this Pages project in Cloudflare Pages > Custom domains, and DNS must be managed by the domain's Cloudflare zone. Do not change or delete existing DNS records until the active domain target is confirmed. The `pages.dev` address remains the fallback until the custom domain is verified.
