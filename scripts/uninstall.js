/**
 * Runs when the extension is uninstalled (package.json "vscode:uninstall").
 *
 * The patch lives inside Kilo Code's own dist/ files, so an extension that is
 * removed leaves them patched: a webview that renders images the user did not
 * ask for, with no extension left to turn it off again. This puts them back.
 *
 * Deliberately free of the vscode module. The uninstall hook is the one place
 * the extension host API may already be torn down, and everything here is plain
 * file work anyway.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const core = require("../patch-core");

const flagFile = path.join(os.homedir(), ".kilo-qol-patch-uninstalled");
try {
  fs.writeFileSync(flagFile, Date.now().toString(), "utf8");
} catch (_) {}

function log(line) {
  console.log(`[kilo-qol-patch] uninstall: ${line}`);
}

/** Every Kilo Code install this machine has, newest layout last so it wins. */
function kiloDistDirs() {
  const found = [];
  const roots = [
    path.join(os.homedir(), ".vscode", "extensions"),
    path.join(os.homedir(), ".vscode-insiders", "extensions"),
    path.join(os.homedir(), ".cursor", "extensions"),
  ];
  for (const root of roots) {
    try {
      for (const name of fs.readdirSync(root)) {
        if (name.toLowerCase().startsWith("kilocode.kilo-code"))
          found.push(path.join(root, name));
      }
    } catch (_) {}
  }
  return found
    .map((base) => path.join(base, "dist"))
    .filter((dir) => fs.existsSync(path.join(dir, "webview.js")));
}

function restore(file, reverse) {
  if (!fs.existsSync(file)) return;
  const bak = file + ".qolpatch.bak";
  if (fs.existsSync(bak)) {
    fs.copyFileSync(bak, file);
    try {
      fs.unlinkSync(bak);
    } catch (_) {}
    log(`restored from backup: ${file}`);
    return;
  }
  try {
    const src = fs.readFileSync(file, "utf8");
    const out = reverse(src);
    if (out !== src) {
      fs.writeFileSync(file, out, "utf8");
      log(`reversed in place: ${file}`);
    }
  } catch (error) {
    log(`could not reverse ${file}: ${error && error.message}`);
  }
}

const dirs = kiloDistDirs();
if (dirs.length === 0) {
  log("no Kilo Code install found, nothing to restore");
  process.exit(0);
}

for (const dir of dirs) {
  restore(path.join(dir, "webview.js"), core.removeFromString);
  restore(path.join(dir, "webview.css"), core.removeCss);
  restore(path.join(dir, "extension.js"), core.removeHostFromString);
  const pkg = path.join(dir, "..", "package.json");
  if (fs.existsSync(pkg)) core.applyOpenInTabTitle(pkg, false);
}

log("done");
