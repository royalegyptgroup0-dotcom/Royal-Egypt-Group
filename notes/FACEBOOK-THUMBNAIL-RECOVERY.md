# CEO Notes — Free Facebook thumbnail recovery

This is a local-only fallback for the 24 historical CEO Notes entries when the Meta ZIP export is unavailable.

## What it does

- Reads days 1–24 from `notes/posts.json`.
- Uses the original Facebook source URL already recorded for each post.
- Calls the free, open-source `yt-dlp` utility with thumbnail-only options; it does not download the Reel video.
- Saves any extracted thumbnails under `notes/images/facebook-archive`.
- Writes a report to `notes/facebook-thumbnail-import-preview.json`.
- Does not upload cookies, call Make, publish to Facebook, commit, or deploy.

**Important limitation:** for Reel entries, the recovered file is the Reel's preview/cover thumbnail, not necessarily the original full-resolution image attachment. The current feed has source URLs for 23 of the 24 entries; day 18 has no source URL, so it is reported as unresolved. The ordinary Facebook post on day 24 may or may not be supported by the extractor.

## Run on Windows

From the repository root:

```powershell
py -m pip install --user -U yt-dlp
.scriptsdownload-ceo-facebook-thumbnails.ps1
```

If Facebook requires an authenticated session, run the script with the browser profile where you are already signed in:

```powershell
.scriptsdownload-ceo-facebook-thumbnails.ps1 -Browser edge
```

Supported browser values: `chrome`, `edge`, `firefox`, `brave`. The default `none` tries public access first.

The script asks yt-dlp to read the browser session locally. **Do not export, paste, or send browser cookies to anyone.** Do not use third-party downloader websites or upload the Facebook archive to online converters.

## Review before applying

Open the downloaded files and the JSON report. Confirm each thumbnail matches the corresponding post. The default run is preview-only and does not modify `notes/posts.json`.

Only after reviewing the result, apply the local image references:

```powershell
.scriptsdownload-ceo-facebook-thumbnails.ps1 -Browser edge -Apply
```

`-Apply` only edits the local `notes/posts.json` and writes the report. It does not commit, deploy, or publish anything. Keep the original feed backed up before applying.

## If extraction fails

Facebook may change its page delivery or require a fresh login. Update yt-dlp and retry once. If a post remains unavailable, use Meta's official **Download your information** / Page download flow and run the existing offline archive importer; that is the route most likely to preserve original attached media.
