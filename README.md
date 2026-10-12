# Kilo QoL Patch

A quality-of-life patch for the **Kilo Code** VS Code chat webview.

Kilo already turns MCP tool-result images (e.g. `read_image`, browser screenshots)
into attachments the model receives, but the generic MCP tool card never renders
them for you. This extension patches the chat webview so those images show
**inline, one per row, with the image path above each picture**, and clicking an
image opens the full-size preview.

## Features
- Inline rendering of MCP tool-result images (supports multiple images per result).
- Each image is labelled with its file path / filename.
- Click to open the built-in zoomable image preview.
- Status-bar indicator showing patch state (applied / reload-needed / off / build mismatch).
- Auto-apply on startup and after a Kilo Code update replaces the webview.
- One-click apply / remove / reload from the status-bar menu.

## Install
1. Download the `.vsix` from the [latest release](https://github.com/darkbytemonolith-rgb/kilo-qol-patch/releases).
2. VS Code → Extensions → `...` menu → **Install from VSIX...** → pick the file.
3. Run **Developer: Reload Window**.

## How it works
On activation it locates the installed Kilo Code extension's `dist/webview.js`,
verifies two anchor strings exist exactly once (so an unrecognized build is skipped,
not corrupted), backs the file up to `webview.js.qolpatch.bak`, and injects a small
image-rendering block into the MCP tool renderer. **Remove** restores the backup.

## Settings
- `kiloQolPatch.autoApply` (default `true`) — apply automatically; when off you're asked.
- `kiloQolPatch.showStatusBar` (default `true`) — show the status-bar indicator.

## Commands
- Kilo QoL Patch: Apply / Re-apply
- Kilo QoL Patch: Remove (restore original)
- Kilo QoL Patch: Status
- Kilo QoL Patch: Open Menu

## Caveats
Unofficial. It edits a minified bundle, so it is tied to a specific Kilo Code build
(developed against 7.8.8). If the bundle changes, the patch safely declines to apply
and the status bar shows "build mismatch" until the anchors are refreshed.

## License
MIT
