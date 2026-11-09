[CmdletBinding()]
param(
    [string]$FeedPath = "notes/posts.json",
    [string]$MediaDirectory = "notes/images/facebook-archive",
    [string]$ReportPath = "notes/facebook-thumbnail-import-preview.json",
    [ValidateSet("none", "chrome", "edge", "firefox", "brave")]
    [string]$Browser = "none",
    [switch]$Apply
)

$ErrorActionPreference = "Stop"

function Write-Info([string]$Message) {
    Write-Host "[CEO Notes] $Message" -ForegroundColor Cyan
}

$RepoRoot = (Get-Location).Path
$FeedFullPath = Join-Path $RepoRoot $FeedPath
$MediaFullPath = Join-Path $RepoRoot $MediaDirectory
$ReportFullPath = Join-Path $RepoRoot $ReportPath

if (-not (Test-Path -LiteralPath $FeedFullPath -PathType Leaf)) {
    throw "Feed not found: $FeedFullPath. Run this script from the repository root."
}

$YtDlp = Get-Command yt-dlp -ErrorAction SilentlyContinue
if (-not $YtDlp) {
    throw "yt-dlp is not installed. Install the free open-source tool with: py -m pip install --user -U yt-dlp"
}

$Feed = Get-Content -LiteralPath $FeedFullPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $Feed.posts) {
    throw "No posts array found in $FeedPath"
}

$Targets = @($Feed.posts | Where-Object { $_.day -ge 1 -and $_.day -le 24 } | Sort-Object day)
if ($Targets.Count -eq 0) {
    throw "No day 1-24 posts were found."
}

New-Item -ItemType Directory -Path $MediaFullPath -Force | Out-Null
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("ceo-notes-thumbnails-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null

$Results = [System.Collections.Generic.List[object]]::new()

try {
    foreach ($Post in $Targets) {
        $Day = [int]$Post.day
        $Url = [string]$Post.sourceUrl
        $FilePrefix = "day-{0:D2}" -f $Day

        if ([string]::IsNullOrWhiteSpace($Url)) {
            $Results.Add([pscustomobject]@{
                day = $Day; status = "missing_source_url"; sourceUrl = $null; file = $null
                note = "The feed has no Facebook source URL for this day."
            })
            continue
        }

        Write-Info "Extracting thumbnail for day $Day"
        $OutputTemplate = Join-Path $TempRoot ($FilePrefix + ".%(ext)s")
        $Arguments = @("--no-warnings", "--no-progress", "--skip-download", "--write-thumbnail", "--output", $OutputTemplate)
        if ($Browser -ne "none") {
            $Arguments += @("--cookies-from-browser", $Browser)
        }
        $Arguments += $Url

        & $YtDlp.Source @Arguments
        $ExitCode = $LASTEXITCODE
        $Downloaded = @(Get-ChildItem -LiteralPath $TempRoot -File -Filter ($FilePrefix + ".*") -ErrorAction SilentlyContinue)

        if ($ExitCode -ne 0 -or $Downloaded.Count -eq 0) {
            $Results.Add([pscustomobject]@{
                day = $Day; status = "unavailable"; sourceUrl = $Url; file = $null
                note = "yt-dlp could not extract a thumbnail. The post may require login or may not expose a thumbnail."
            })
            continue
        }

        $Chosen = $Downloaded | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
        $DestinationName = $FilePrefix + $Chosen.Extension.ToLowerInvariant()
        $Destination = Join-Path $MediaFullPath $DestinationName
        Copy-Item -LiteralPath $Chosen.FullName -Destination $Destination -Force

        $RelativeUrl = "/" + ($MediaDirectory -replace "\\", "/").Trim("/") + "/" + $DestinationName
        $Results.Add([pscustomobject]@{
            day = $Day; status = "thumbnail_downloaded"; sourceUrl = $Url
            file = $DestinationName; imageUrl = $RelativeUrl
            note = "Thumbnail only; this may be a Reel cover, not an original photo attachment."
        })
    }

    $Successful = @($Results | Where-Object { $_.status -eq "thumbnail_downloaded" })
    if ($Apply) {
        foreach ($Post in $Targets) {
            $Found = $Successful | Where-Object { $_.day -eq [int]$Post.day } | Select-Object -First 1
            if ($Found) {
                $ExistingImages = @()
                if ($Post.images -is [array]) { $ExistingImages = @($Post.images) }
                if ($ExistingImages -notcontains $Found.imageUrl) {
                    $Post.images = @($ExistingImages + $Found.imageUrl)
                }
                if ([string]::IsNullOrWhiteSpace([string]$Post.imageUrl)) {
                    $Post.imageUrl = $Found.imageUrl
                }
            }
        }
        $Feed | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $FeedFullPath -Encoding UTF8
        Write-Info "Applied local image references to $FeedPath. No commit, deployment, or Facebook publishing was performed."
    }

    $Report = [pscustomobject]@{
        generatedAt = (Get-Date).ToUniversalTime().ToString("o")
        mode = $(if ($Apply) { "applied_locally" } else { "preview_only" })
        requestedDays = $Targets.Count
        downloadedThumbnails = $Successful.Count
        unresolvedDays = @($Results | Where-Object { $_.status -ne "thumbnail_downloaded" } | ForEach-Object { $_.day })
        results = @($Results)
        note = "Reel thumbnails are not guaranteed to be the original image files. Review all images before publishing the local feed."
    }
    $Report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ReportFullPath -Encoding UTF8
    Write-Info "Downloaded $($Successful.Count) thumbnail(s) for $($Targets.Count) archive post(s)."
    Write-Info "Report: $ReportFullPath"
    if (-not $Apply) {
        Write-Info "Preview only. Feed was not modified. Re-run with -Apply only after reviewing the downloaded images."
    }
}
finally {
    Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
}
