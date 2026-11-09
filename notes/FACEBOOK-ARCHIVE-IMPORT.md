# CEO Notes — Facebook archive import (free/offline)

This procedure replaces the blocked Make archive-export scenario. It uses the owner's Meta data export and a dependency-free Node.js script; it does not require Make credits, a paid service, or Facebook publishing permissions.

## Obtain the source archive

1. In Facebook, open the Page settings or Meta Accounts Center and choose **Download your information** (often under **Your information and permissions**).
2. Select the CEO Page if Meta offers an account/Page selector; choose **Posts** and the full available date range.
3. Request **JSON** format and choose the highest available media quality.
4. Download the ZIP and extract it locally. Keep the original ZIP unchanged as the source backup.
5. Confirm the extracted folder contains post JSON and its associated media folders. Typical post records refer to files such as \`posts/media/...jpg\` through \`attachments[].data[].media.uri\`.

Do not upload the archive to a third-party converter. It can contain private Page/account information. Process it locally or share the export ZIP in this ChatGPT conversation if assistance is needed.

## Preview text and image import

Requires Node.js 20 or newer; no \`npm install\` is needed.

From the repository root:

\`\`\`powershell
node scripts/import-ceo-facebook-archive.mjs --input "C:\\path\\to\\extracted-meta-export" --current notes/posts.json --output notes/posts.import-preview.json --media-output notes/images/facebook-archive
\`\`\`

The default mode is preview-only for the feed. It:
- reads JSON files whose paths identify post/publication/timeline data;
- extracts post text, timestamps, Facebook IDs and permalinks where present;
- follows image references in post attachments and copies the original image files into \`notes/images/facebook-archive\`;
- names copied files by a SHA-256 content fingerprint, so repeated references do not create duplicate files;
- adds local \`/images/facebook-archive/...\` paths to each post's \`images\` array and sets \`imageUrl\` to the first archive image;
- enriches matching posts already in \`notes/posts.json\` with archive images without replacing their existing \`imageUrl\`;
- preserves existing feed entries, sorts new imports chronologically, and assigns unused day numbers;
- skips duplicate posts by Facebook ID, permalink, or normalized text plus publication date;
- reports scanned/imported posts, duplicates, enriched existing posts, image references found, unique files copied, missing/unsafe media references, and the date range.

The importer only copies image attachments (JPEG, PNG, GIF, WebP, AVIF and HEIC/HEIF). Video and audio attachments are intentionally not copied by this image-import phase. Missing or unsafe media paths do not stop text import; check the report and compare it with the source archive. The script never fetches remote URLs and never uploads archive contents to a third party.

## Review the complete candidate

Before changing the canonical feed:
1. Inspect \`notes/posts.import-preview.json\`.
2. Open several copied images and confirm they belong to the matching posts.
3. Compare the report's media count, source files, exported date range and post count with the Facebook Page archive.
4. Check posts with no images and posts with multiple images.
5. Review duplicates and any incomplete or private material; do not publish private messages, comments or unrelated account data.

The website supports one or multiple local archive images per post. Existing generated \`imageUrl\` values are preserved; archive images are stored separately in \`images\`.

Only after review, create the final feed deliberately. \`--apply\` updates the local feed file only; it does not commit, deploy, or publish to Facebook:

\`\`\`powershell
node scripts/import-ceo-facebook-archive.mjs --input "C:\\path\\to\\extracted-meta-export" --current notes/posts.json --apply
\`\`\`

Keep the original feed and export ZIP as rollback evidence. The copied image directory and the final feed must be committed together so image paths do not break.

## Safety boundaries

- Website archive import only; never repost old content to Facebook.
- No changes to Make scenarios or their active/paused state.
- No production deployment is performed by this script.
- No existing feed entry is deleted or rewritten.
- Never put credentials, private messages, comments, or unrelated account data into the public feed.
- Review every imported post and copied image before merging the candidate into \`notes/posts.json\`.
