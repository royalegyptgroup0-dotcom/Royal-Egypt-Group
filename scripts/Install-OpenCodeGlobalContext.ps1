[CmdletBinding()]
param(
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'
$configDirectory = Join-Path $HOME '.config\opencode'
$agentsPath = Join-Path $configDirectory 'AGENTS.md'
$startMarker = '<!-- PROJECT-ROUTING-CONTEXT:START -->'
$endMarker = '<!-- PROJECT-ROUTING-CONTEXT:END -->'

$managedBlock = @'
# OpenCode Global Project Routing

This file is intended for %USERPROFILE%\.config\opencode\AGENTS.md. It is a short global routing layer, not a replacement for each project's own documentation.

## Rules for every task

1. Identify the active workspace from the actual OpenCode server session and current working directory. Do not infer it from the last conversation or another project.
2. Before asking the owner for project details, inspect the workspace root for AGENTS.md, README.md, docs/PROJECT_CONTEXT.md, project config, Git branch/status, and recent commits.
3. If the workspace contains project instructions, read and follow them. Use the repo's project context as the source of truth for names, architecture, paths, and known decisions.
4. Never ask the owner to repeat facts already present in the repository, project notes, or previous accepted decisions accessible to the current session. Ask only for a genuinely missing decision, permission, or inaccessible path.
5. Never mix repositories, source trees, credentials, customers, channels, or release plans across projects. One task must have one clearly identified project/workspace.
6. If a project root is not the current workspace, locate it using the known path hints below and verify that it exists before switching. Never silently change workspace or branch.
7. Preserve existing local changes. Inspect before editing. Use a separate branch, tests, and evidence. Do not merge, publish, message customers, spend money, or change production without explicit authorization.
8. Never request or reveal passwords, API tokens, private keys, customer records, or other secrets. Verify secret presence only.

## Separate project registry

- **Royal Egypt Group:** business platform and divisions Royal Egypt Properties, Royal Egypt Coffee, Royal Egypt Transportation. Last-known Windows checkout: C:\Users\yasse\Desktop\royalegyptgroup.pages.dev. Use that repository's AGENTS.md and docs/PROJECT_CONTEXT.md.
- **OCTOPUSA:** independent agent-engineering platform. Last-known Windows checkout: D:\OCTOPUSA-main-latest-20261112. Do not import Royal Egypt context into OCTOPUSA. Read OCTOPUSA's own project instructions and mission files before acting.
- **CEO Notes:** independent editorial/social project. It may share hosting or source repository locations with other work, but its editorial identity, audience, social accounts, and publishing approvals remain separate.
- **RoyalMediaPlayer:** separate desktop media-player project. Use its own repository and instructions.
- **Painty Creator:** separate creative application project. Use its own repository and instructions.
- Other projects must be identified from their actual repository/workspace, not guessed.

## When context is still missing

First inspect available local folders, Git repositories, project docs, and the current OpenCode server workspace. If the project root or server connection cannot be accessed, state exactly which access is missing and do not invent architecture or ask a broad "tell me about the project" question.
'@

$newLine = [Environment]::NewLine
$managedBlock = $startMarker + $newLine + $managedBlock + $newLine + $endMarker
if (-not $Apply) {
    Write-Output "Preview only. Target: $agentsPath"
    Write-Output "The existing file will be preserved; only the marked project-routing block will be inserted or replaced."
    Write-Output "Run again with -Apply to write the global OpenCode instructions."
    exit 0
}

New-Item -ItemType Directory -Path $configDirectory -Force | Out-Null
$existing = if (Test-Path -LiteralPath $agentsPath) {
    Get-Content -LiteralPath $agentsPath -Raw
} else {
    ''
}

if ($existing.Contains($startMarker) -and $existing.Contains($endMarker)) {
    $pattern = '(?s)' + [regex]::Escape($startMarker) + '.*?' + [regex]::Escape($endMarker)
    $updated = [regex]::Replace($existing, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $managedBlock }, 1)
} else {
    $separator = if ([string]::IsNullOrWhiteSpace($existing)) { '' } else { $newLine + $newLine }
    $updated = $existing + $separator + $managedBlock + $newLine
}

Set-Content -LiteralPath $agentsPath -Value $updated -Encoding utf8
Write-Output "Updated global OpenCode instructions: $agentsPath"
Write-Output "Existing unmarked content was preserved."
