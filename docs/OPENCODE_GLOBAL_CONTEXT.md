# Global OpenCode Context Installer

OpenCode's project AGENTS.md is loaded only when the connected server is working in that project. A global AGENTS.md provides cross-project routing rules and prevents accidental context mixing, while each project keeps its own technical facts and permissions.

The official OpenCode documentation supports:
- Global instructions at ~/.config/opencode/AGENTS.md.
- Project instructions in a repository-root AGENTS.md.
- Additional instruction files loaded from the instructions array in opencode.json(c).

See [OpenCode Rules](https://opencode.ai/docs/rules) and [OpenCode Config](https://opencode.ai/docs/config).

## Apply on the Windows OpenCode server

Run the script in PowerShell from the Royal Egypt Group checkout or any workspace where this file is available:

    powershell -ExecutionPolicy Bypass -File ./scripts/Install-OpenCodeGlobalContext.ps1

That is preview-only. To apply the change:

    powershell -ExecutionPolicy Bypass -File ./scripts/Install-OpenCodeGlobalContext.ps1 -Apply

The script creates or updates only the marked project-routing block in %USERPROFILE%/.config/opencode/AGENTS.md. Existing unmarked content is preserved. It does not change project files, branches, credentials, or OpenCode server connectivity.

## Important limitation

This repository's project-specific context applies only when OpenCode is working inside the Royal Egypt Group checkout. The global routing block identifies OCTOPUSA as a separate Windows/Android AI-agent engineering project and tells OpenCode to inspect its latest MISSION-### files and delivery reports. OCTOPUSA, RoyalMediaPlayer, and Painty Creator still need their own local AGENTS.md and project-context files. Do not copy this repository's business details into those projects.