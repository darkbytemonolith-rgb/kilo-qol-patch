const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const os = require("os");
const core = require("./patch-core");

let statusBar;
let justApplied = false;

function cfg() {
  const c = vscode.workspace.getConfiguration("kiloQolPatch");
  return {
    autoApply: c.get("autoApply", true),
    showStatusBar: c.get("showStatusBar", true),
    fillChatWidth: c.get("fillChatWidth", true),
  };
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

function inspect() {
  const wv = findWebview();
  if (!wv) return { found: false };
  const src = fs.readFileSync(wv, "utf8");
  if (core.isCurrent(src)) return { found: true, path: wv, applied: true };
  if (core.isPatched(src))
    return { found: true, path: wv, applied: false, old: true };
  const dry = core.applyToString(src);
  return {
    found: true,
    path: wv,
    applied: false,
    mismatch: !dry.ok,
    c1: dry.c1,
    c2: dry.c2,
  };
}

// --- CSS (chat width) ---
function applyCssFile() {
  if (!cfg().fillChatWidth) return;
  const css = findWebviewCss();
  if (!css) return;
  const src = fs.readFileSync(css, "utf8");
  if (core.cssIsPatched(src)) return;
  const bak = css + ".qolpatch.bak";
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, src, "utf8");
  fs.writeFileSync(css, core.applyCss(src), "utf8");
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
  if (core.cssIsPatched(src))
    fs.writeFileSync(css, core.removeCss(src), "utf8");
}

function doApply() {
  const wv = findWebview();
  if (!wv) return { state: "notfound" };
  let src = fs.readFileSync(wv, "utf8");
  if (core.isCurrent(src)) {
    applyCssFile(); // keep CSS in sync even if JS already patched
    return { state: "already", path: wv };
  }
  const bak = wv + ".qolpatch.bak";
  if (core.isPatched(src) && fs.existsSync(bak))
    src = fs.readFileSync(bak, "utf8");
  const res = core.applyToString(src);
  if (!res.ok) return { state: "noanchors", path: wv, c1: res.c1, c2: res.c2 };
  if (!fs.existsSync(bak)) fs.writeFileSync(bak, src, "utf8");
  fs.writeFileSync(wv, res.out, "utf8");
  applyCssFile();
  return { state: "patched", path: wv };
}

function doRemove() {
  const wv = findWebview();
  if (!wv) return { state: "notfound" };
  removeCssFile();
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
    .showInformationMessage(message, "Reload Window")
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
  const name = "Kilo QoL";
  if (!st.found) {
    statusBar.text = `$(circle-slash) ${name}`;
    statusBar.tooltip = "Kilo Code not found — nothing to patch.";
    statusBar.backgroundColor = undefined;
  } else if (st.applied && justApplied) {
    statusBar.text = `$(refresh) ${name}: reload`;
    statusBar.tooltip =
      "Patch applied. Reload the window to activate it.\nClick for options.";
    statusBar.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground",
    );
  } else if (st.applied) {
    statusBar.text = `$(pass-filled) ${name}`;
    statusBar.tooltip = `Patch applied and active.\n${st.path}\nClick for options.`;
    statusBar.backgroundColor = undefined;
  } else if (st.mismatch) {
    statusBar.text = `$(error) ${name}: build mismatch`;
    statusBar.tooltip = `This Kilo Code build is not recognized (anchors ${st.c1}/${st.c2}); patch skipped.\nClick for options.`;
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

function applyInteractive() {
  const r = doApply();
  if (r.state === "patched") {
    justApplied = true;
    refreshStatusBar();
    offerReload("Kilo QoL Patch applied. Reload to apply changes.");
  } else if (r.state === "already") {
    vscode.window.showInformationMessage("Kilo QoL Patch is already applied.");
    refreshStatusBar();
  } else if (r.state === "notfound")
    vscode.window.showErrorMessage("Kilo Code webview.js not found.");
  else if (r.state === "noanchors")
    vscode.window.showErrorMessage(
      `Kilo QoL Patch: this Kilo Code build is not recognized (anchors ${r.c1}/${r.c2}); skipped to avoid corruption.`,
    );
  refreshStatusBar();
}

function removeInteractive() {
  const r = doRemove();
  if (r.state === "restored" || r.state === "reversed") {
    justApplied = false;
    refreshStatusBar();
    offerReload("Kilo QoL Patch removed. Reload to apply.");
  } else if (r.state === "notpatched")
    vscode.window.showInformationMessage("Kilo QoL Patch was not applied.");
  else if (r.state === "notfound")
    vscode.window.showErrorMessage("Kilo Code webview.js not found.");
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
    title: `Kilo QoL Patch — ${stateText}`,
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
}

function showStatus() {
  const st = inspect();
  if (!st.found)
    return vscode.window.showErrorMessage("Kilo Code webview.js not found.");
  const css = findWebviewCss();
  const cssOn = css ? core.cssIsPatched(fs.readFileSync(css, "utf8")) : false;
  const state = st.applied
    ? justApplied
      ? "APPLIED (reload needed)"
      : "APPLIED & active"
    : st.mismatch
      ? `build mismatch (anchors ${st.c1}/${st.c2})`
      : st.old
        ? "older version applied"
        : "not applied";
  vscode.window.showInformationMessage(
    `Kilo QoL Patch: images=${state}; chat-width=${cssOn ? "on" : "off"}\n${st.path}`,
  );
}

async function onStartup(context) {
  const { autoApply } = cfg();
  const st = inspect();
  if (!st.found) {
    refreshStatusBar();
    return;
  }
  if (st.applied) {
    applyCssFile();
    refreshStatusBar();
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
    return;
  }
  if (autoApply) {
    const r = doApply();
    if (r.state === "patched") {
      justApplied = true;
      refreshStatusBar();
      offerReload("Kilo QoL Patch applied. Reload to apply changes.");
    } else refreshStatusBar();
  } else {
    refreshStatusBar();
    const pick = await vscode.window.showInformationMessage(
      "Kilo QoL Patch is installed but not applied. Apply it now?",
      "Apply",
      "Not now",
      "Always (enable auto-apply)",
    );
    if (pick === "Apply") applyInteractive();
    else if (pick === "Always (enable auto-apply)") {
      await vscode.workspace
        .getConfiguration("kiloQolPatch")
        .update("autoApply", true, true);
      applyInteractive();
    }
  }
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("kiloQolPatch.apply", applyInteractive),
    vscode.commands.registerCommand("kiloQolPatch.remove", removeInteractive),
    vscode.commands.registerCommand("kiloQolPatch.status", showStatus),
    vscode.commands.registerCommand("kiloQolPatch.menu", openMenu),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("kiloQolPatch")) refreshStatusBar();
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
}

module.exports = { activate, deactivate };
