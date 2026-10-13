// Patches VS Code's own workbench bundle so HTML5 drag events reach the
// Kilo Code webview when dragging files out of the Explorer, without holding
// Shift. VS Code's stock behavior calls _startBlockingIframeDragEvents() on
// every drag-start, which sets pointer-events:none on the webview container so
// dragover/drop pass through to the editor behind it; with Shift held, the
// drag handler early-returns and skips that call. We neutralize both halves.
//
// Deliberately free of the vscode module: this must also run from the
// uninstall hook, where the extension host API may already be torn down.
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const BAK = ".kilo-qol.bak";
const LOCK = ".kilo-qol.lock";
const CSS_MARKER = "/* KILO-QOL-WORKBENCH-DND-PATCH */";
const CSS_OVERRIDE = `\n${CSS_MARKER}\n.webview-container,.webview,iframe.webview,.webview-overlay{pointer-events:auto !important}\n`;

const JS_ANCHOR_BLOCK =
  '_startBlockingIframeDragEvents(){this.element&&(this.element.style.pointerEvents="none")}';
const JS_BLOCK_REPL = '_startBlockingIframeDragEvents(){/* unblocked by kilo-qol */}';
const JS_ANCHOR_SHIFT = "this._register(q(o,oe.DRAG,n=>{n.shiftKey?i():t()}))";
const JS_SHIFT_REPL = "this._register(q(o,oe.DRAG,n=>{i()}))";

const JS_PRODUCT_KEY = "vs/workbench/workbench.desktop.main.js";
const CSS_PRODUCT_KEY = "vs/workbench/workbench.desktop.main.css";

const LOCK_STALE_MS = 30_000;
const LOCK_RETRIES = 40; // ~5s total, enough for a slow disk write
const LOCK_RETRY_DELAY_MS = 125;

function computeChecksum(buf) {
  return crypto.createHash("sha256").update(buf).digest("base64").replace(/=+$/, "");
}

/**
 * Every VS Code install this machine has, so builds installed outside the
 * stock %LOCALAPPDATA%\Programs location are picked up too.
 */
function appRoots() {
  const found = [];
  const seen = new Set();
  const add = (p) => {
    try {
      if (fs.existsSync(path.join(p, "out", "vs", "workbench", "workbench.desktop.main.js"))) {
        const real = fs.realpathSync(p);
        if (!seen.has(real)) {
          seen.add(real);
          found.push(p);
        }
      }
    } catch (_) {}
  };

  const programDirs = ["Microsoft VS Code", "Microsoft VS Code Insiders"];
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  for (const prog of programDirs) {
    const root = path.join(localAppData, "Programs", prog);
    let entries = [];
    try {
      entries = fs.readdirSync(root);
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      add(path.join(root, entry, "resources", "app"));
    }
  }
  return found;
}

function getAppRoot() {
  return appRoots()[0];
}

function files(appRoot) {
  return {
    js: path.join(appRoot, "out", "vs", "workbench", "workbench.desktop.main.js"),
    css: path.join(appRoot, "out", "vs", "workbench", "workbench.desktop.main.css"),
    product: path.join(appRoot, "product.json"),
  };
}

function jsIsPatched(src) {
  return !src.includes(JS_ANCHOR_BLOCK) && !src.includes(JS_ANCHOR_SHIFT);
}

function cssIsPatched(src) {
  return src.includes(CSS_MARKER);
}

/**
 * Serialize concurrent access per app root. Two VS Code windows activate two
 * extension hosts at once; without this, the second host could snapshot an
 * already-patched file as the "original" backup and break uninstall.
 * The lock is advisory and stale-tolerant: a crash leaves LOCK_STALE_MS behind,
 * after which a new host takes over.
 */
function withLock(appRoot, fn) {
  const lockPath = path.join(appRoot, LOCK);
  let acquired = false;
  for (let i = 0; i < LOCK_RETRIES; i++) {
    try {
      fs.writeFileSync(lockPath, String(process.pid), "utf8", { flag: "wx" });
      acquired = true;
      break;
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
      try {
        const raw = fs.readFileSync(lockPath, "utf8").trim();
        const age = Date.now() - Number(raw || 0);
        if (raw && Number.isFinite(age) && age > LOCK_STALE_MS) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch (_) {}
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_DELAY_MS);
    }
  }
  if (!acquired) {
    return { success: false, error: `timed out waiting for lock ${lockPath}` };
  }
  try {
    return fn();
  } finally {
    try {
      fs.unlinkSync(lockPath);
    } catch (_) {}
  }
}

function updateProductChecksums(productPath, key, buf) {
  const raw = fs.readFileSync(productPath, "utf8");
  const digest = computeChecksum(buf);
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`("${escaped}"\\s*:\\s*")([^"]*)(")`);
  if (!re.test(raw)) {
    return { ok: false, error: `checksum entry missing for ${key}` };
  }
  fs.writeFileSync(productPath, raw.replace(re, `$1${digest}$3`), "utf8");
  return { ok: true, digest };
}

function patchOne(appRoot) {
  return withLock(appRoot, () => {
    const { js: jsPath, css: cssPath, product: productPath } = files(appRoot);
    for (const p of [jsPath, cssPath, productPath]) {
      if (!fs.existsSync(p)) return { success: false, error: `missing ${p}` };
    }

    let js = fs.readFileSync(jsPath, "utf8");
    let css = fs.readFileSync(cssPath, "utf8");

    const jsWasPristine = !jsIsPatched(js);
    const cssWasPristine = !cssIsPatched(css);

    // Only ever snapshot pristine content. A stale backup left over from an
    // interrupted run would otherwise restore a patched file on uninstall.
    if (jsWasPristine) {
      const bak = jsPath + BAK;
      if (!fs.existsSync(bak)) {
        try {
          fs.writeFileSync(bak, js, "utf8");
        } catch (err) {
          return { success: false, error: `could not back up ${jsPath}: ${err.message}` };
        }
      }
    }
    if (cssWasPristine) {
      const bak = cssPath + BAK;
      if (!fs.existsSync(bak)) {
        try {
          fs.writeFileSync(bak, css, "utf8");
        } catch (err) {
          return { success: false, error: `could not back up ${cssPath}: ${err.message}` };
        }
      }
    }

    const nextJs =
      js
        .replace(JS_ANCHOR_BLOCK, JS_BLOCK_REPL)
        .replace(JS_ANCHOR_SHIFT, JS_SHIFT_REPL);
    const nextCss = cssIsPatched(css) ? css : css + CSS_OVERRIDE;

    if (nextJs === js && nextCss === css) {
      return { success: true, alreadyPatched: true, appRoot };
    }

    const prodBak = productPath + BAK;
    if (!fs.existsSync(prodBak)) {
      try {
        fs.copyFileSync(productPath, prodBak);
      } catch (err) {
        return { success: false, error: `could not back up ${productPath}: ${err.message}` };
      }
    }

    if (nextJs !== js) fs.writeFileSync(jsPath, nextJs, "utf8");
    if (nextCss !== css) fs.writeFileSync(cssPath, nextCss, "utf8");

    if (nextJs !== js) {
      const r = updateProductChecksums(productPath, JS_PRODUCT_KEY, fs.readFileSync(jsPath));
      if (!r.ok) return { success: false, error: r.error, appRoot };
    }
    if (nextCss !== css) {
      const r = updateProductChecksums(productPath, CSS_PRODUCT_KEY, fs.readFileSync(cssPath));
      if (!r.ok) return { success: false, error: r.error, appRoot };
    }

    return { success: true, patched: true, appRoot };
  });
}

/** Patch every installed VS Code build; aggregates instead of failing fast. */
function patchWorkbench() {
  const roots = appRoots();
  if (roots.length === 0) {
    return { success: false, error: "VS Code app root not found", results: [] };
  }
  const results = roots.map(patchOne);
  return {
    success: results.every((r) => r.success),
    patched: results.some((r) => r.patched),
    results,
  };
}

function unpatchOne(appRoot) {
  return withLock(appRoot, () => {
    const { js: jsPath, css: cssPath, product: productPath } = files(appRoot);
    const restored = [];
    const noBackup = [];

    const restore = (file) => {
      const bak = file + BAK;
      if (!fs.existsSync(bak)) {
        noBackup.push(file);
        return;
      }
      fs.copyFileSync(bak, file);
      fs.unlinkSync(bak);
      restored.push(file);
    };

    for (const p of [jsPath, cssPath, productPath]) {
      if (fs.existsSync(p)) restore(p);
    }
    try {
      if (fs.existsSync(path.join(appRoot, LOCK))) fs.unlinkSync(path.join(appRoot, LOCK));
    } catch (_) {}
    return { restored, noBackup, appRoot };
  });
}

function unpatchWorkbench() {
  const roots = appRoots();
  if (roots.length === 0) {
    return { success: false, error: "VS Code app root not found", results: [] };
  }
  const results = roots.map(unpatchOne);
  return {
    success: results.some((r) => r.restored.length > 0),
    results,
  };
}

/** Read-only state for the status command. Never mutates. */
function status() {
  const roots = appRoots();
  if (roots.length === 0) return { found: false, results: [] };
  const results = roots.map((appRoot) => {
    const { js, css } = files(appRoot);
    let jsOn = false;
    let cssOn = false;
    try {
      jsOn = jsIsPatched(fs.readFileSync(js, "utf8"));
    } catch (_) {}
    try {
      cssOn = cssIsPatched(fs.readFileSync(css, "utf8"));
    } catch (_) {}
    return { appRoot, js: jsOn, css: cssOn, on: jsOn && cssOn };
  });
  return { found: true, on: results.some((r) => r.on), results };
}

module.exports = {
  patchWorkbench,
  unpatchWorkbench,
  status,
  getAppRoot,
  appRoots,
  jsIsPatched,
  cssIsPatched,
  computeChecksum,
};
