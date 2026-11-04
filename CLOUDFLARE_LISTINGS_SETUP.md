# Cloudflare listing uploads setup

The public listing form is committed, but uploads remain disabled until the following free-tier resources are created and bound in Cloudflare Pages.

1. Create a D1 database named `royal-eg-listings`.
2. Run `migrations/0001_listings.sql` against that database.
3. Create an R2 bucket named `royal-eg-property-images`.
4. In Pages > royalegyptgroup > Settings > Functions, add bindings for Production (and Preview if desired):
   - D1 binding variable: `DB` -> database `royal-eg-listings`
   - R2 binding variable: `PROPERTY_IMAGES` -> bucket `royal-eg-property-images`
5. Add an encrypted secret named `ADMIN_TOKEN` with a long random value. Do not commit the token.
6. Redeploy Pages after adding bindings.

Public visitors can submit listings, but all new submissions are stored as `pending`. Only requests to `/api/admin/listings` with the ADMIN_TOKEN can review them. Never expose the token in browser code.

R2 public access is not enabled by this setup. Before publishing approved listing images, add a controlled image-serving route that reads only keys referenced by approved rows. Do not enable public bucket listing.
