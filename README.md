# Royal Egypt Group

A multilingual group portal for Royal Egypt Group and its three divisions:

- **Royal Egypt Properties** — real-estate information, approved listing catalogue, property enquiries and developer directory.
- **Royal Egypt Coffee** — an introductory division page with an interest-registration form.
- **Royal Egypt Transportation** — an introductory division page with an interest-registration form.

## Production site

- Cloudflare Pages project: royalegyptgroup
- Production branch: main
- Primary and canonical Pages hostname: https://royalegyptgroup-vy7.pages.dev

## Main pages

- index.html — group homepage and navigation.
- markets.html — markets and financial information center with third-party market widgets.
- properties.html — property catalogue, property submission and AI assistant.
- developers.html — informational developer directory with official-source and non-endorsement disclaimers.
- coffee.html and transportation.html — interest-only division pages; they are not online shops or booking systems.
- admin-inbox.html — private owner inbox for customers, opportunities, listings and read-only orders.
- admin-listings.html — private listing moderation interface.

## Current application behavior

- Public property reads are limited to approved listings. New listing submissions remain pending until an administrator reviews them.
- The website intake endpoint stores accepted customer, opportunity and listing requests in Cloudflare D1. Consent is required; submissions do not publish listings automatically.
- The shared assistant uses Cloudflare Workers AI and approved public listing context. It must not invent prices, availability, legal status or guarantees.
- Coffee and Transportation forms collect expressions of interest only. They do not confirm a booking, order, payment or service availability.
- The owner inbox and moderation APIs require server-side authentication. Verify the owner authentication secret and a successful authenticated session before relying on these tools.
- Owner notification delivery must be configured and tested before public lead collection is treated as operational.

## Important limitations

- The Production catalogue currently has no approved D1 listings. Verify property details and obtain owner approval before publishing any offer.
- A website image-upload/gallery pipeline is not active. Do not advertise website image uploads; use only an owner-approved photo-sharing process.
- Coffee and Transportation are not yet operational commerce or booking systems.
- The platform is in controlled pre-launch status, not a completed commercial launch.

## Free-first hosting and data

- Source control: GitHub.
- Hosting and server-side functions: Cloudflare Pages.
- Application data: separate Production and Preview Cloudflare D1 databases.
- Workers AI is configured for Production. Preview AI availability must be verified from the live project configuration before AI testing; observe current provider quotas.
- No R2 image bucket or paid image-storage service is enabled.
- Do not add a paid service, subscription, card requirement or recurring charge without explicit approval.

## Development and release

- Run the repository's GitHub Actions checks before merging.
- Use Preview and synthetic data for integration tests.
- Never run test writes against Production D1.
- Never publish a property listing without explicit owner approval.
- Keep secrets out of source control, documentation, frontend storage, logs and chat.
- Production merges/deployments, external messages and changes to real customer data remain approval-gated.

See [the latest technical audit](docs/TECHNICAL_AUDIT_2026-11-11.md) for the verified infrastructure state, test evidence and outstanding launch gates.
