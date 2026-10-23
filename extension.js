const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");
const core = require("./patch-core");
const backgroundSubagents = require("./background-subagents");
const crypto = require("crypto");

let statusBar;
let justApplied = false;

function cfg() {
  const c = vscode.workspace.getConfiguration("kiloQolPatch");
  return {
    autoApply: c.get("autoApply", true),
    showStatusBar: c.get("showStatusBar", true),
    fillChatWidth: c.get("fillChatWidth", true),
    showAllChats: c.get("showAllChats", false),
    keyboardShortcuts: c.get("keyboardShortcuts", true),
    addAttachFileButton: c.get("addAttachFileButton", false),
    chatMathRendering: c.get("chatMathRendering", true),
    chatMathFontSizeEm: c.get("chatMathFontSizeEm", 1.21),
    chatRawMarkdownButton: c.get("chatRawMarkdownButton", true),
    chatHistoryFontSizeEm: c.get("chatHistoryFontSizeEm", 1),
    chatHistoryFontFamily: c.get("chatHistoryFontFamily", ""),
    compactChatLayout: c.get("compactChatLayout", false),
    chatCodeWrap: c.get("chatCodeWrap", false),
    backgroundSubagents: c.get("backgroundSubagents", true),
    renameOpenInTab: c.get("renameOpenInTab", false),
  };
}

function syncBackgroundSubagents() {
  try {
    const result = cfg().backgroundSubagents
      ? backgroundSubagents.enable(backgroundSubagents.configDir())
      : backgroundSubagents.disable(backgroundSubagents.configDir());
    return result.changed;
  } catch (err) {
    console.error("[kilo-qol-patch] background subagent rule update failed", err);
    vscode.window.showWarningMessage(
      `Kilo QoL Patch could not update the background-subagent rule: ${err.message}`,
    );
    return false;
  }
}

function offerBackgroundRuleReload() {
  offerReload(
    "Kilo's background-subagent instruction changed. Reload the window for new chats to use it.",
  );
}

function kiloDistDir() {
  const candidates = [];
  const ext = vscode.extensions.getExtension("kilocode.kilo-code");
  if (ext && ext.extensionPath) candidates.push(ext.extensionPath);
  const roots = [
    path.join(os.homedir(), ".vscode", "extensions"),
    path.join(os.homedir(), ".vscode-insiders", "extensions"),
  ];
  for (const root of roots) {
    try {
      for (const name of fs.readdirSync(root)) {
        if (name.toLowerCase().startsWith("kilocode.kilo-code"))
          candidates.push(path.join(root, name));
      }
    } catch (_) {}
  }
  for (const base of candidates) {
    if (fs.existsSync(path.join(base, "dist", "webview.js")))
      return path.join(base, "dist");
  }
  return undefined;
}

function findWebview() {
  const d = kiloDistDir();
  return d ? path.join(d, "webview.js") : undefined;
}
function findWebviewCss() {
  const d = kiloDistDir();
  if (!d) return undefined;
  const p = path.join(d, "webview.css");
  return fs.existsSync(p) ? p : undefined;
}

function findHost() {
  const d = kiloDistDir();
  if (!d) return undefined;
  const p = path.join(d, "extension.js");
  return fs.existsSync(p) ? p : undefined;
}

function inspect() {
  const wv = findWebview();
  if (!wv) return { found: false };
  const src = fs.readFileSync(wv, "utf8");
  if (core.isCurrent(src)) return { found: true, path: wv, applied: true };
  if (core.isPatched(src))
    return { found: true, path: wv, applied: false, old: true };
  const dry = core.applyToString(src, cfg());
  return {
    found: true,
    path: wv,
    applied: false,
    mismatch: !dry.ok,
    anchors: anchorsOf(dry),
  };
}

function anchorsOf(r) {
  if (!r || r.ok !== false) return "";
  return `${r.c1}/1 ${r.c2}/1 ${r.c3}/1 ${r.c4}/1 ${r.c5}/1 ${r.c6}/1 ${r.c7}/1 ${r.c8}/1 ${r.c9}/1 ${r.c10}/1`;
}

// --- CSS (tool cards, code blocks, chat width, math, typography, raw-markdown) ---
function applyCssFile() {
  const css = findWebviewCss();
  if (!css) return;
  const src = fs.readFileSync(css, "utf8");
  const bak = css + ".qolpatch.bak";
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, src, "utf8");
  const updated = core.applyCss(src, cfg());
  if (updated !== src) fs.writeFileSync(css, updated, "utf8");
}

function removeCssFile() {
  const css = findWebviewCss();
  if (!css) return;
  const bak = css + ".qolpatch.bak";
  if (fs.existsSync(bak)) {
    fs.copyFileSync(bak, css);
    try {
      fs.unlinkSync(bak);
    } catch (_) {}
    return;
  }
  const src = fs.readFileSync(css, "utf8");
  if (core.cssIsPatched(src)) fs.writeFileSync(css, core.removeCss(src), "utf8");
}

// --- extension.js show-all-chats (host) patch ---
function applyHostFile() {
  if (!cfg().showAllChats) {
    removeHostFile();
    return;
  }
  const host = findHost();
  if (!host) return;
  const src = fs.readFileSync(host, "utf8");
  if (core.hostIsCurrent(src)) return;
  const bak = host + ".qolpatch.bak";
  if (core.hostIsPatched(src) && fs.existsSync(bak)) {
    const restored = core.removeHostFromString(src);
    const res = core.applyHostToString(restored);
    if (!res.ok) return;
    fs.writeFileSync(host, res.out, "utf8");
    return;
  }
  const res = core.applyHostToString(src);
  if (!res.ok) return { noanchors: true };
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, src, "utf8");
  fs.writeFileSync(host, res.out, "utf8");
}

function removeHostFile() {
  const host = findHost();
  if (!host) return;
  const bak = host + ".qolpatch.bak";
  if (fs.existsSync(bak)) {
    fs.copyFileSync(bak, host);
    try {
      fs.unlinkSync(bak);
    } catch (_) {}
    return;
  }
  const src = fs.readFileSync(host, "utf8");
  if (core.hostIsPatched(src))
    fs.writeFileSync(host, core.removeHostFromString(src), "utf8");
}

// --- package.json title tweak ---
function applyOpenInTab() {
  const d = kiloDistDir();
  if (!d) return;
  const pkg = path.join(d, "..", "package.json");
  if (fs.existsSync(pkg)) {
    core.applyOpenInTabTitle(pkg, cfg().renameOpenInTab);
  }
}

function removeOpenInTab() {
  const d = kiloDistDir();
  if (!d) return;
  const pkg = path.join(d, "..", "package.json");
  if (fs.existsSync(pkg)) {
    core.applyOpenInTabTitle(pkg, false);
  }
}

function doApply() {
  const wv = findWebview();
  if (!wv) return { state: "notfound" };
  let src = fs.readFileSync(wv, "utf8");
  const bak = wv + ".qolpatch.bak";

  // If an older patch is present, cleanly restore to clean stock source first
  if (core.isPatched(src)) {
    if (fs.existsSync(bak)) {
      try {
        const bakSrc = fs.readFileSync(bak, "utf8");
        if (!core.isPatched(bakSrc)) {
          src = bakSrc;
        } else {
          src = core.removeFromString(src);
        }
      } catch (_) {
        src = core.removeFromString(src);
      }
    } else {
      src = core.removeFromString(src);
    }
  }

  // Ensure backup holds clean stock content
  if (!fs.existsSync(bak) || core.isPatched(fs.readFileSync(bak, "utf8"))) {
    fs.writeFileSync(bak, src, "utf8");
  }

  const conf = cfg();
  const res = core.applyToString(src, conf);
  if (!res.ok) return { state: "noanchors", path: wv, anchors: anchorsOf(res) };
  fs.writeFileSync(wv, res.out, "utf8");
  applyCssFile();
  applyHostFile();
  applyOpenInTab();
  return { state: "patched", path: wv };
}

function doRemove() {
  const wv = findWebview();
  if (!wv) return { state: "notfound" };
  removeCssFile();
  removeHostFile();
  removeOpenInTab();
  const bak = wv + ".qolpatch.bak";
  if (fs.existsSync(bak)) {
    fs.copyFileSync(bak, wv);
    try {
      fs.unlinkSync(bak);
    } catch (_) {}
    return { state: "restored", path: wv };
  }
  const src = fs.readFileSync(wv, "utf8");
  if (!core.isPatched(src)) return { state: "notpatched", path: wv };
  fs.writeFileSync(wv, core.removeFromString(src), "utf8");
  return { state: "reversed", path: wv };
}

function reloadWindow() {
  return vscode.commands.executeCommand("workbench.action.reloadWindow");
}
function offerReload(message) {
  vscode.window
    .showInformationMessage(message, "Reload Window", "Later")
    .then((pick) => {
      if (pick === "Reload Window") reloadWindow();
    });
}

function refreshStatusBar() {
  const { showStatusBar } = cfg();
  if (!showStatusBar) {
    if (statusBar) statusBar.hide();
    return;
  }
  if (!statusBar) {
    statusBar = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      50,
    );
    statusBar.command = "kiloQolPatch.menu";
  }
  const st = inspect();
  const name = "Kilo QoL+KB";
  if (!st.found) {
    statusBar.text = `$(circle-slash) ${name}`;
    statusBar.tooltip = "Kilo Code not found — nothing to patch.";
    statusBar.backgroundColor = undefined;
  } else if (st.applied && justApplied) {
    statusBar.text = `$(refresh) ${name}: reload`;
    statusBar.tooltip =
      "Patches applied. Reload the window to activate.\nClick for options.";
    statusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
  } else if (st.applied) {
    statusBar.text = `$(pass-filled) ${name}`;
    statusBar.tooltip = `All QoL + KB features active.\n${st.path}\nClick for options.`;
    statusBar.backgroundColor = undefined;
  } else if (st.mismatch) {
    statusBar.text = `$(error) ${name}: build mismatch`;
    statusBar.tooltip = `This Kilo Code build is not recognized (anchors ${st.anchors}); patch skipped.\nClick for options.`;
    statusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground",
    );
  } else {
    statusBar.text = `$(warning) ${name}: off`;
    statusBar.tooltip = "Patch is not applied. Click to apply.";
    statusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
  }
  statusBar.show();
}

async function applyInteractive() {
  const r = doApply();
  if (r.state === "patched") {
    justApplied = true;
    refreshStatusBar();
    await new Promise((resolve) => setTimeout(resolve, 200));
    reloadWindow();
  } else if (r.state === "already") {
    vscode.window.showInformationMessage("Kilo QoL + KB Patch is already applied.");
    refreshStatusBar();
  } else if (r.state === "notfound") {
    vscode.window.showErrorMessage("Kilo Code webview.js not found.");
  } else if (r.state === "noanchors") {
    vscode.window.showErrorMessage(
      `Kilo QoL Patch: this Kilo Code build is not recognized (anchors ${r.anchors}); skipped to avoid corruption.`,
    );
  }
  refreshStatusBar();
}

async function removeInteractive() {
  const r = doRemove();
  if (r.state === "restored" || r.state === "reversed") {
    justApplied = false;
    refreshStatusBar();
    await new Promise((resolve) => setTimeout(resolve, 200));
    reloadWindow();
  } else if (r.state === "notpatched") {
    vscode.window.showInformationMessage("Kilo QoL Patch was not applied.");
  } else if (r.state === "notfound") {
    vscode.window.showErrorMessage("Kilo Code webview.js not found.");
  }
  refreshStatusBar();
}

async function openMenu() {
  const st = inspect();
  const items = [];
  if (st.found && st.applied) {
    if (justApplied)
      items.push({ label: "$(refresh) Reload Window", action: "reload" });
    items.push({
      label: "$(discard) Remove patch (restore original)",
      action: "remove",
    });
    items.push({ label: "$(sync) Re-apply patch", action: "apply" });
  } else {
    items.push({ label: "$(check) Apply patch", action: "apply" });
  }
  items.push({ label: "$(info) Show status", action: "status" });
  items.push({ label: "$(gear) Open settings", action: "settings" });
  const { showAllChats } = cfg();
  items.push({
    label: showAllChats
      ? "$(eye) Disable Show All Chats"
      : "$(eye-closed) Enable Show All Chats",
    action: "toggleShowAllChats",
  });
  const stateText = !st.found
    ? "Kilo Code not found"
    : st.applied
      ? justApplied
        ? "applied — reload needed"
        : "applied & active"
      : st.mismatch
        ? "build mismatch"
        : "not applied";
  const pick = await vscode.window.showQuickPick(items, {
    title: `Kilo QoL + KB Patch — ${stateText}`,
    placeHolder: "Choose an action",
  });
  if (!pick) return;
  if (pick.action === "apply") applyInteractive();
  else if (pick.action === "remove") removeInteractive();
  else if (pick.action === "reload") reloadWindow();
  else if (pick.action === "status")
    vscode.commands.executeCommand("kiloQolPatch.status");
  else if (pick.action === "settings")
    vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "kiloQolPatch",
    );
  else if (pick.action === "toggleShowAllChats") toggleShowAllChats();
}

function showStatus() {
  const st = inspect();
  if (!st.found)
    return vscode.window.showErrorMessage("Kilo Code webview.js not found.");
  const css = findWebviewCss();
  const cssOn = css ? core.cssIsPatched(fs.readFileSync(css, "utf8")) : false;
  const hostOn = { on: false, fresh: false };
  const host = findHost();
  if (host) {
    const hsrc = fs.readFileSync(host, "utf8");
    hostOn.on = core.hostIsPatched(hsrc);
    hostOn.fresh = cfg().showAllChats && core.hostIsCurrent(hsrc);
  }
  const state = st.applied
    ? justApplied
      ? "APPLIED (reload needed)"
      : "APPLIED & active"
    : st.mismatch
      ? `build mismatch (anchors ${st.anchors})`
      : st.old
        ? "older version applied"
        : "not applied";
  vscode.window.showInformationMessage(
    `Kilo QoL + KB Patch: webview(kb/images/tools/drops)=${state}; css=${cssOn ? "on" : "off"}; all-chats=${
      hostOn.on ? (hostOn.fresh ? "on" : "stale") : "off"
    }\n${st.path}`,
  );
}

function startWatcher(context) {
  const d = kiloDistDir();
  if (!d) return;
  const wv = path.join(d, "webview.js");
  if (!fs.existsSync(wv)) return;

  let debounceTimer = null;
  try {
    const watcher = fs.watch(wv, (eventType) => {
      if (eventType !== "change") return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        const uninstallFlag = path.join(os.homedir(), ".kilo-qol-patch-uninstalled");
        if (fs.existsSync(uninstallFlag)) {
          try { watcher.close(); } catch (_) {}
          return;
        }
        const st = inspect();
        if (st.found && !st.applied && !st.mismatch) {
          const r = doApply();
          if (r.state === "patched") {
            justApplied = true;
            refreshStatusBar();
            await new Promise((resolve) => setTimeout(resolve, 200));
            reloadWindow();
          }
        }
        refreshStatusBar();
      }, 1000);
    });
    context.subscriptions.push({ dispose: () => watcher.close() });
  } catch (_) {}
}

function cleanupOldExtensionVersions(context) {
  try {
    const extDir = context.extensionPath;
    const parentDir = path.dirname(extDir);
    const currentName = path.basename(extDir).toLowerCase();
    const candidateRoots = [
      parentDir,
      path.join(os.homedir(), ".vscode", "extensions"),
      path.join(os.homedir(), ".vscode-insiders", "extensions"),
      path.join(os.homedir(), ".cursor", "extensions"),
    ];
    const seenRoots = new Set();
    for (const root of candidateRoots) {
      if (!root || seenRoots.has(root) || !fs.existsSync(root)) continue;
      seenRoots.add(root);
      try {
        for (const name of fs.readdirSync(root)) {
          const lower = name.toLowerCase();
          if (
            (lower.startsWith("dark-byte.kilo-qol-patch-") || lower.startsWith("kilo-qol-patch-")) &&
            lower !== currentName
          ) {
            const target = path.join(root, name);
            try {
              fs.rmSync(target, { recursive: true, force: true });
              console.log(`[kilo-qol-patch] Cleaned up legacy version folder: ${target}`);
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
  } catch (_) {}
}

async function onStartup(context) {
  cleanupOldExtensionVersions(context);

  // Activation itself proves the extension is installed; a stale uninstall flag
  // (written by the old version's hook during an in-place upgrade) must not block patching.
  const flagFile = path.join(os.homedir(), ".kilo-qol-patch-uninstalled");
  if (fs.existsSync(flagFile)) {
    try { fs.unlinkSync(flagFile); } catch (_) {}
  }
  const backgroundRuleChanged = syncBackgroundSubagents();
  const currentVersion = context.extension?.packageJSON?.version || "1.3.7";
  const lastVersion = context.globalState.get("installedVersion");
  const isNewInstallOrUpdate = lastVersion !== currentVersion;

  const st = inspect();
  if (!st.found) {
    if (backgroundRuleChanged) offerBackgroundRuleReload();
    refreshStatusBar();
    return;
  }

  // 1. Fresh install, version upgrade, or older patch applied on disk (st.old):
  if (isNewInstallOrUpdate || st.old) {
    await context.globalState.update("installedVersion", currentVersion);
    const r = doApply();
    if (r.state === "patched") {
      justApplied = true;
      refreshStatusBar();
      await new Promise((resolve) => setTimeout(resolve, 200));
      reloadWindow();
      return;
    }
  }

  // 2. Unpatched build: auto-patch and auto-reload immediately without asking
  if (!st.applied && !st.mismatch) {
    const r = doApply();
    if (r.state === "patched") {
      justApplied = true;
      refreshStatusBar();
      await new Promise((resolve) => setTimeout(resolve, 200));
      reloadWindow();
      return;
    }
  }

  // 3. Already applied: sync style/host/manifest
  if (st.applied) {
    applyCssFile();
    applyHostFile();
    applyOpenInTab();
    refreshStatusBar();
    startWatcher(context);
    if (backgroundRuleChanged) offerBackgroundRuleReload();
    return;
  }

  if (st.mismatch) {
    refreshStatusBar();
    const key = "mismatchWarned:" + st.path;
    if (!context.globalState.get(key)) {
      context.globalState.update(key, true);
      vscode.window.showWarningMessage(
        "Kilo QoL Patch: this Kilo Code version isn't recognized, so the patch was skipped. An update is needed.",
      );
    }
    if (backgroundRuleChanged) offerBackgroundRuleReload();
    return;
  }

  startWatcher(context);
  if (backgroundRuleChanged) offerBackgroundRuleReload();
}

async function toggleShowAllChats() {
  const key = "showAllChats";
  const c = vscode.workspace.getConfiguration("kiloQolPatch");
  const next = !(c.get(key, false));
  await c.update(key, next, true);
  applyHostFile();
  refreshStatusBar();
  await new Promise((resolve) => setTimeout(resolve, 200));
  reloadWindow();
}

// --- Mention files/folders in Kilo chat from the VS Code explorer ---
async function mentionInChat(clickedUri, allUris) {
  const uris = (allUris && allUris.length > 0) ? allUris : (clickedUri ? [clickedUri] : []);
  if (uris.length === 0) return;

  try {
    await vscode.commands.executeCommand("kilo-code.SidebarProvider.focus");
  } catch (_) {
    vscode.window.showErrorMessage("Kilo QoL Patch: Could not focus Kilo Code sidebar.");
    return;
  }

  await new Promise((r) => setTimeout(r, 300));

  const bridge = globalThis.__kqpPostMessage;
  if (typeof bridge === "function") {
    for (const uri of uris) {
      const relPath = vscode.workspace.asRelativePath(uri, false);
      bridge({
        type: "appendChatContext",
        context: {
          id: crypto.randomUUID(),
          filePath: relPath,
        },
      });
    }
    try {
      await vscode.commands.executeCommand("kilo-code.new.focusChatInput");
    } catch (_) {}
    return;
  }

  for (const uri of uris) {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.type & vscode.FileType.Directory) continue;
      const doc = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(doc, {
        preview: true,
        preserveFocus: true,
      });
      editor.selection = new vscode.Selection(0, 0, 0, 0);
      await new Promise((r) => setTimeout(r, 100));
      await vscode.commands.executeCommand("kilo-code.new.addToContext");
    } catch (err) {
      console.error("[kilo-qol-patch] mentionInChat failed for", uri.fsPath, err);
    }
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("kiloQolPatch.reload", reloadWindow),
    vscode.commands.registerCommand("kiloQolPatch.apply", applyInteractive),
    vscode.commands.registerCommand("kiloQolPatch.remove", removeInteractive),
    vscode.commands.registerCommand("kiloQolPatch.status", showStatus),
    vscode.commands.registerCommand("kiloQolPatch.menu", openMenu),
    vscode.commands.registerCommand("kiloQolPatch.toggleShowAllChats", toggleShowAllChats),
    vscode.commands.registerCommand("kiloQolPatch.mentionInChat", mentionInChat),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("kiloQolPatch")) {
        if (e.affectsConfiguration("kiloQolPatch.backgroundSubagents")) {
          if (syncBackgroundSubagents()) offerBackgroundRuleReload();
        }
        if (e.affectsConfiguration("kiloQolPatch.showAllChats")) applyHostFile();
        applyCssFile();
        applyOpenInTab();
        refreshStatusBar();
      }
    }),
  );
  try {
    onStartup(context);
  } catch (err) {
    console.error("[kilo-qol-patch] startup failed", err);
  }
  context.subscriptions.push({
    dispose: () => statusBar && statusBar.dispose(),
  });
}

function deactivate() {
  if (statusBar) statusBar.dispose();
  // Only the uninstall hook's flag means "really gone". An .obsolete entry for an
  // old version during an in-place upgrade must NOT strip patches from the webview.
  const flagFile = path.join(os.homedir(), ".kilo-qol-patch-uninstalled");
  if (fs.existsSync(flagFile)) {
    try {
      doRemove();
    } catch (_) {}
  }
}

module.exports = { activate, deactivate };
