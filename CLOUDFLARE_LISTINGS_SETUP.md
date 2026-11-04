# Royal Egypt listings — free D1-only setup

The listing form stores text details in Cloudflare D1. No R2 bucket or payment card is required for this text-only version. Property photos are collected separately through the official Royal Egypt WhatsApp contact after the listing is submitted.

1. Create the D1 database named `royal-eg-listings`.
2. Run `migrations/0001_listings.sql` in its Console.
3. In Cloudflare Pages > `royalegyptgroup` > Settings > Functions, add a D1 binding:
   - Variable name: `DB`
   - Database: `royal-eg-listings`
4. Add an encrypted secret named `ADMIN_TOKEN` with a long random value. Keep it private; do not put it in website code or send it in chat.
5. Redeploy the Pages project after adding the binding and secret.

Submissions are stored as `pending`. Only an administrator who knows the secret can review, approve, or reject them at `/admin-listings.html`. Approved listings appear in the public catalogue. This version does not accept image uploads because the available storage option requested payment-card details. Do not enable paid services unless explicitly approved.
