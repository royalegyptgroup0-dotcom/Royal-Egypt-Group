# CEO Notes — Facebook archive import (free/offline)

This procedure replaces the blocked Make archive-export scenario. It uses the owner's Meta data export and a dependency-free Node.js script; it does not require Make credits, a paid service, or Facebook publishing permissions.

## Obtain the source archive

1. In Facebook, open the page/profile settings for the CEO Page and use **Download your information** (Meta Accounts Center may show this as **Your information and permissions → Download your information**).
2. Select the CEO Page if Meta offers an account/page selector; choose **Posts** and the full available date range.
3. Request JSON format and the highest available media quality if media is to be reviewed.
4. Download the ZIP and extract it locally. Keep the original ZIP unchanged as the source backup.
5. Confirm the extracted folder contains a posts JSON file, usually under a path containing `posts` (for example, `posts/your_posts_1.json`).

Do not upload the archive to a third-party converter. It can contain private page/account information. Share only the export ZIP in this ChatGPT conversation if you want assistance processing it.

## Preview the import

Requires Node.js 20 or newer; no npm install is needed.

From the repository root:

```powershell
node scripts/import-ceo-facebook-archive.mjs --input "C:\\path\\to\\extracted-meta-export" --current notes/posts.json --output notes/posts.import-preview.json
```

The default mode is preview-only. It:
- reads JSON files whose paths identify post/publication/timeline data;
- extracts post text, timestamps, Facebook IDs and permalinks where present;
- preserves the existing feed entries;
- sorts newly imported posts chronologically and assigns unused day numbers;
- skips duplicates by Facebook ID, permalink, or normalized text plus publication date;
- reports source files, scanned records, imported posts and skipped duplicates.

Posts that have a timestamp but no text are retained using their export title as a placeholder so they can be manually reviewed. Media files are not copied into the site by this first import pass.

## Review and apply

Inspect `notes/posts.import-preview.json` before replacing the canonical feed. Correct placeholder titles, categories, tags, missing article text, and any ambiguous duplicate manually. Do not treat the export's presence as proof that every page post was included; compare the exported date range and record count with the Facebook Page archive.

Only after review, create the final feed deliberately. The script supports `--apply` for local file generation, but it never commits, deploys, or publishes to Facebook:

```powershell
node scripts/import-ceo-facebook-archive.mjs --input "C:\\path\\to\\extracted-meta-export" --current notes/posts.json --apply
```

The output report must be saved with the import review. Keep the original feed and export ZIP as rollback evidence.

## Safety boundaries

- Website archive import only; never repost old content to Facebook.
- No changes to Make scenarios or their active/paused state.
- No production deployment is performed by this script.
- No existing feed entry is deleted or rewritten.
- Never put credentials, private messages, comments, or unrelated account data into the public feed.
- Review every imported post before merging the candidate into `notes/posts.json`.
