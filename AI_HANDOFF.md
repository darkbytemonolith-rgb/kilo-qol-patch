# Comprehensive AI Handoff & Implementation Blueprint
**Project**: `kilo-qol-patch` (Kilo Code Drag & Drop & QoL Patches)  
**Date**: October 13, 2026  
**Status**: Root cause verified; complete copy-paste code and architecture ready for instant execution. No further research needed.

---

## 1. Executive Summary & Objective

The goal is to enable **native mouse-only drag-and-drop** of files and folders from the VS Code Explorer directly into Kilo Code's chat input area (identical to Google Antigravity IDE and Cursor), **without ever having to hold the `Shift` key**.

### Current Status: WE ARE NOT FINISHED YET!
The research and root cause analysis are complete, but the workbench unblocker code has **NOT YET BEEN APPLIED TO THE CODEBASE**. 

### 📌 Pending TODO List (What Is NOT Fixed Yet):
- [ ] **TODO 1: Create `workbench-patch.js`** in `c:\Users\Dark_Byte\Downloads\completed\kilo-qol-patch\workbench-patch.js` using the ready-to-run code in Section 5.A.
- [ ] **TODO 2: Integrate into `extension.js`** — call `patchWorkbench()` on activation so the user gets mouse-only drops automatically, and expose command `kiloQol.patchWorkbenchDnd`.
- [ ] **TODO 3: Integrate into `scripts/uninstall.js`** — call `unpatchWorkbench()` so uninstall restores original VS Code files and checksums.
- [ ] **TODO 4: Bump version to `0.8.0` in `package.json`**.
- [ ] **TODO 5: Run `node -e "const { patchWorkbench } = require('./workbench-patch'); console.log(patchWorkbench());"`** to verify patching works without errors.
- [ ] **TODO 6: Run `.\build-vsix.ps1` and `code --install-extension kilo-qol-patch-0.8.0.vsix --force`**.
- [ ] **TODO 7: Reload VS Code window & Live Test**:
  - Drag a file directly from Explorer to Kilo Code chat input with **MOUSE ONLY (NO SHIFT)**.
  - Drag a folder directly from Explorer to Kilo Code chat input with **MOUSE ONLY (NO SHIFT)**.
  - Verify clean `@name ` mention appears and context resolves.
  - Confirm NO "Installation appears corrupt" warning appears in VS Code.

---

---

## 2. Root Cause Analysis (Verified with Exact Offsets & Strings)

### A. The VS Code Workbench Webview Pointer Blocking Trap
In stock VS Code desktop (`workbench.desktop.main.js`):
1. **The Drag-Over Check** (~byte offset `4662636`):
   ```javascript
   var lde = class extends x {
     constructor(o, e) {
       super();
       let t = () => { e()?.windowDidDragStart() };
       let i = () => { e()?.windowDidDragEnd() };
       this._register(q(o, oe.DRAG_START, () => { t() }));
       this._register(q(o, oe.DRAG_END, i));
       this._register(q(o, oe.MOUSE_MOVE, n => { n.buttons === 0 && i() }));
       this._register(q(o, oe.DRAG, n => { n.shiftKey ? i() : t() })); // <-- ROOT CAUSE #1
     }
   }
   ```
2. **The Blocker Method** (~byte offset `19983946`):
   ```javascript
   _startBlockingIframeDragEvents() {
     this.element && (this.element.style.pointerEvents = "none"); // <-- ROOT CAUSE #2
   }
   _stopBlockingIframeDragEvents() {
     this.element && (this.element.style.pointerEvents = "auto");
   }
   ```

### B. Why Mouse Drops Fail Without Shift
- When dragging an item from the VS Code Explorer:
  1. `oe.DRAG_START` triggers `t()` (`windowDidDragStart()`).
  2. `_startBlockingIframeDragEvents()` sets `style.pointerEvents = "none"` directly on the webview iframe.
  3. While dragging with just the mouse, `n.shiftKey` is `false`, so `t()` is repeatedly executed.
  4. Because `pointerEvents = "none"` is active on the webview container, **all HTML5 drag events (`dragenter`, `dragover`, `drop`) pass straight through the webview into the editor grid behind it**. The webview never receives the drop!
  5. Antigravity IDE and Cursor fix this by neutralizing `_startBlockingIframeDragEvents()`.

---

## 3. Verified System Paths & Permissions

| Component | Absolute Path | Permissions |
| :--- | :--- | :--- |
| **Workspace** | `c:\Users\Dark_Byte\Downloads\completed\kilo-qol-patch` | Full Read/Write |
| **VS Code App Root** | `C:\Users\Dark_Byte\AppData\Local\Programs\Microsoft VS Code\2a59476c9b\resources\app` | Full User Read/Write (No Admin elevation needed) |
| **Workbench JS** | `.../resources/app/out/vs/workbench/workbench.desktop.main.js` | Verified Writable |
| **Workbench CSS** | `.../resources/app/out/vs/workbench/workbench.desktop.main.css` | Verified Writable |
| **Product Manifest** | `.../resources/app/product.json` | Verified Writable |
| **Kilo Code Ext** | `C:\Users\Dark_Byte\.vscode\extensions\kilocode.kilo-code-7.8.8-win32-x64` | Full Read/Write |
| **Kilo Webview JS**| `.../dist/webview.js` | Already patched with Antigravity drop parser |

### Verified Hash Algorithm for `product.json` Checksums
- Algorithm: `sha256` digest encoded as `base64`, with trailing `=` stripped:
  ```javascript
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('base64').replace(/=+$/, '');
  ```
- Verified against existing stock file: computed hash matches `product.json.checksums['vs/workbench/workbench.desktop.main.js']` (`YxwdecTzr5F3yiOnDP4M8lhqaSZ4vYl69shpMkFg2QU`).

---

## 4. Complete Ready-to-Use Code Modules

### A. New Workbench Patch Module: `workbench-patch.js`
Place this file directly in `c:\Users\Dark_Byte\Downloads\completed\kilo-qol-patch\workbench-patch.js`:

```javascript
// c:\Users\Dark_Byte\Downloads\completed\kilo-qol-patch\workbench-patch.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CSS_MARKER = '/* KILO-QOL-WORKBENCH-DND-PATCH */';
const CSS_OVERRIDE = `\n${CSS_MARKER}\n.webview-container, .webview, iframe.webview, .webview-overlay { pointer-events: auto !important; }\n`;

function getAppRoot() {
  // If running inside VS Code extension host:
  if (process.execPath) {
    const candidate = path.join(path.dirname(process.execPath), 'resources', 'app');
    if (fs.existsSync(candidate)) return candidate;
  }
  // Standard Windows user-install fallback:
  const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Local');
  const base = path.join(localAppData, 'Programs', 'Microsoft VS Code');
  if (fs.existsSync(base)) {
    const entries = fs.readdirSync(base);
    for (const entry of entries) {
      const p = path.join(base, entry, 'resources', 'app');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function computeChecksum(buf) {
  return crypto.createHash('sha256').update(buf).digest('base64').replace(/=+$/, '');
}

function patchWorkbench() {
  const appRoot = getAppRoot();
  if (!appRoot) return { success: false, error: 'VS Code app root not found' };

  const jsPath = path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.desktop.main.js');
  const cssPath = path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.desktop.main.css');
  const productPath = path.join(appRoot, 'product.json');

  if (!fs.existsSync(jsPath) || !fs.existsSync(cssPath) || !fs.existsSync(productPath)) {
    return { success: false, error: 'Workbench files not found in ' + appRoot };
  }

  let jsContent = fs.readFileSync(jsPath, 'utf8');
  let cssContent = fs.readFileSync(cssPath, 'utf8');
  const productRaw = fs.readFileSync(productPath, 'utf8');
  const product = JSON.parse(productRaw);

  let modified = false;

  // 1. Backup if backup does not exist
  const jsBackup = jsPath + '.kilo-qol.bak';
  const cssBackup = cssPath + '.kilo-qol.bak';
  const productBackup = productPath + '.kilo-qol.bak';
  if (!fs.existsSync(jsBackup)) fs.writeFileSync(jsBackup, jsContent, 'utf8');
  if (!fs.existsSync(cssBackup)) fs.writeFileSync(cssBackup, cssContent, 'utf8');
  if (!fs.existsSync(productBackup)) fs.writeFileSync(productBackup, productRaw, 'utf8');

  // 2. Patch JS: Disable _startBlockingIframeDragEvents
  const targetFn = '_startBlockingIframeDragEvents(){this.element&&(this.element.style.pointerEvents="none")}';
  const replFn = '_startBlockingIframeDragEvents(){/* unblocked by kilo-qol */};_origStartBlocking(){this.element&&(this.element.style.pointerEvents="none")}';
  if (jsContent.includes(targetFn)) {
    jsContent = jsContent.replace(targetFn, replFn);
    modified = true;
  }

  // 3. Patch JS: Drag handler n.shiftKey ? i() : t() -> i()
  const targetDrag = 'this._register(q(o,oe.DRAG,n=>{n.shiftKey?i():t()}))';
  const replDrag = 'this._register(q(o,oe.DRAG,n=>{i()}))';
  if (jsContent.includes(targetDrag)) {
    jsContent = jsContent.replace(targetDrag, replDrag);
    modified = true;
  }

  // 4. Patch CSS: Add pointer-events: auto !important
  if (!cssContent.includes(CSS_MARKER)) {
    cssContent += CSS_OVERRIDE;
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(jsPath, jsContent, 'utf8');
    fs.writeFileSync(cssPath, cssContent, 'utf8');

    // 5. Update product.json checksums
    if (product.checksums) {
      product.checksums['vs/workbench/workbench.desktop.main.js'] = computeChecksum(Buffer.from(jsContent, 'utf8'));
      product.checksums['vs/workbench/workbench.desktop.main.css'] = computeChecksum(Buffer.from(cssContent, 'utf8'));
      fs.writeFileSync(productPath, JSON.stringify(product, null, '\t'), 'utf8');
    }
    return { success: true, patched: true };
  }

  return { success: true, alreadyPatched: true };
}

function unpatchWorkbench() {
  const appRoot = getAppRoot();
  if (!appRoot) return { success: false, error: 'VS Code app root not found' };

  const jsPath = path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.desktop.main.js');
  const cssPath = path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.desktop.main.css');
  const productPath = path.join(appRoot, 'product.json');

  const jsBackup = jsPath + '.kilo-qol.bak';
  const cssBackup = cssPath + '.kilo-qol.bak';
  const productBackup = productPath + '.kilo-qol.bak';

  if (fs.existsSync(jsBackup)) {
    fs.copyFileSync(jsBackup, jsPath);
    fs.unlinkSync(jsBackup);
  }
  if (fs.existsSync(cssBackup)) {
    fs.copyFileSync(cssBackup, cssPath);
    fs.unlinkSync(cssBackup);
  }
  if (fs.existsSync(productBackup)) {
    fs.copyFileSync(productBackup, productPath);
    fs.unlinkSync(productBackup);
  }

  return { success: true };
}

module.exports = {
  patchWorkbench,
  unpatchWorkbench,
  getAppRoot
};
```

---

### B. Integration into `extension.js`
In `c:\Users\Dark_Byte\Downloads\completed\kilo-qol-patch\extension.js`:
1. Require `workbench-patch.js`:
   ```javascript
   const { patchWorkbench } = require('./workbench-patch');
   ```
2. In `activate(context)`:
   ```javascript
   // Auto-unblock mouse drag and drop at workbench layer
   try {
     const res = patchWorkbench();
     if (res.success && res.patched) {
       vscode.window.showInformationMessage(
         'Kilo QoL: Mouse-only drag & drop enabled! Please reload window.',
         'Reload Window'
       ).then(choice => {
         if (choice === 'Reload Window') {
           vscode.commands.executeCommand('workbench.action.reloadWindow');
         }
       });
     }
   } catch (err) {
     console.error('Failed to patch workbench drag:', err);
   }
   ```
3. Register command:
   ```javascript
   context.subscriptions.push(
     vscode.commands.registerCommand('kiloQol.patchWorkbenchDnd', () => {
       const res = patchWorkbench();
       if (res.success) {
         vscode.window.showInformationMessage('Workbench Drag & Drop unblocked successfully! Reload window to apply.', 'Reload').then(c => {
           if (c === 'Reload') vscode.commands.executeCommand('workbench.action.reloadWindow');
         });
       } else {
         vscode.window.showErrorMessage('Failed to unblock workbench drag: ' + res.error);
       }
     })
   );
   ```

---

### C. Clean Uninstall in `scripts/uninstall.js`
In `c:\Users\Dark_Byte\Downloads\completed\kilo-qol-patch\scripts\uninstall.js`:
```javascript
const { unpatchWorkbench } = require('../workbench-patch');

// In uninstall execution:
try {
  unpatchWorkbench();
  console.log('Restored original VS Code workbench files and checksums.');
} catch (e) {
  console.warn('Could not restore workbench files:', e.message);
}
```

---

## 5. Build, Verification & Testing Steps

To apply and verify:
1. **Build & Install Extension**:
   ```powershell
   cd c:\Users\Dark_Byte\Downloads\completed\kilo-qol-patch
   powershell -ExecutionPolicy Bypass -File build-vsix.ps1
   code --install-extension kilo-qol-patch-0.7.0.vsix --force
   ```
2. **Execute Workbench Patch Directly (Or via Extension Activation)**:
   ```powershell
   node -e "const { patchWorkbench } = require('./workbench-patch'); console.log(patchWorkbench());"
   ```
3. **Restart VS Code**:
   - Close and reopen VS Code (or run `Developer: Reload Window`).
4. **Test Drag and Drop**:
   - Open Kilo Code chat window.
   - Click and drag any file or folder from the Explorer sidebar into the chat prompt textarea with **just the mouse (no Shift key held)**.
   - The drop executes immediately, producing `@filename ` or `@foldername `.
5. **Test Clean Uninstall**:
   - Run `node scripts/uninstall.js`.
   - Confirm backup files are cleanly restored and checksums match original values.
