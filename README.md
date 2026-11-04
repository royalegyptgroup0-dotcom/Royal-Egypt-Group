# Royal Egypt Group — Website

A multilingual, responsive real-estate marketing website for Royal Egypt Group.

## Pages and features

- `index.html`: company landing page, services, brand information and customer enquiry form.
- `properties.html`: searchable and filterable property catalogue with a guided, rule-based enquiry assistant.
- Arabic, English and Russian interface. The language selector cycles through all three languages and remembers the choice in the visitor's browser.
- WhatsApp enquiry links open a prefilled message for the visitor to review and send. The site does not send messages automatically or store submitted details.
- `assets/royal.css` and `assets/royal.js`: shared responsive design system and language/navigation logic.
- `royal-logo.jpg`: supplied Royal Egypt brand logo.

## Current published catalogue

1. Hurghada, Al Ahyaa — 4,000 m² investment land; buyer instalment option was supplied in the listing brief.
2. Stella di Mare, Zafarana / Ain Sokhna — furnished 110 m² villa; 3 bedrooms, 2 bathrooms, 36 m² terrace.
3. Suez, Nasser Street — administrative space up to 600 m² and 900 m² garage / basement.

The catalogue is an enquiry catalogue, not a live inventory feed. Prices, legal status, availability, exact boundaries, permitted use and payment terms must be confirmed by the company and independently checked before a transaction.

## Cloudflare Pages deployment

- Repository: `yasserabdelaziz83-maker/Royal-Egypt-Group`
- Production branch: `main`
- Framework preset: None
- Build command: leave empty
- Build output directory: / (repository root)
- No package installation or build step is needed.

Each commit to `main` should trigger a Pages deployment if the repository integration and automatic deployments are enabled. Check the Pages deployment log for the latest commit if the live site does not reflect the repository.

## Important production boundary

The on-page property assistant is currently a lightweight, browser-based guided matcher. It is not connected to a large language model and does not claim to provide legal, valuation or availability advice.

The enquiry form opens WhatsApp with a draft; it does not transmit or save leads by itself.

A secure multi-user admin dashboard, shared listing database, authenticated staff accounts, stored lead inbox and genuine AI agent require server-side services and secrets (for example Cloudflare Pages Functions/Workers with D1 and protected authentication). Do not put API keys, admin passwords or private tokens in front-end files. Those services are not represented as active until provisioned and tested.
