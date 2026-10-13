// Temp: extract the __mcpImgs fragment the patch injects, execute it against
// real tool-result shapes, and confirm the label resolves for every input form.
// String matching cannot prove the injected minified code actually runs, so
// this evaluates it for real.
const fs = require("fs");
const core = require("../patch-core");

const wv = process.argv[2];
const bak = wv + ".qolpatch.bak";
const res = core.applyToString(fs.readFileSync(bak, "utf8"), {});
if (!res.ok) {
  console.error("PATCH FAILED:", JSON.stringify(res));
  process.exit(1);
}

const patched = res.out;
const MARK = "__mcpImgs=ye(()=>{";
const start = patched.indexOf(MARK);
if (start < 0) {
  console.error("__mcpImgs fragment not found in patched output");
  process.exit(1);
}
// The fragment is "__mcpImgs=ye(()=>{...})" with no nested arrow braces in it,
// so the first "})" after the marker closes it.
const end = patched.indexOf("})", start) + 1;
const body = patched.slice(start + MARK.length, end); // "=>{...}"

// ye is the bundle's memo helper; the label logic lives in the fn itself.
const call = new Function(`e`, `"use strict";\n` + "var __mcpImgs=" + body + ";\nreturn __mcpImgs(e);");

const IMG = { mime: "image/png", url: "data:image/png;base64,AAA" };
const cases = {
  "read_image (paths)": { attachments: [IMG, IMG], input: { paths: ["/x/a.png", "/x/b.png"] } },
  "read_image (path)": { attachments: [IMG], input: { path: "/x/one.png" } },
  "screenshot (filename)": { attachments: [IMG], input: { filename: "hq-test.png", type: "png" } },
  "screenshot multi-shot": {
    attachments: [IMG, IMG],
    input: { shots: [{ label: "top", filename: "a.png" }, { label: "full", filename: "b.png" }] },
  },
  "attachment carries filename": {
    attachments: [{ mime: "image/png", url: "data:,X", filename: "inline.png" }],
    input: {},
  },
  "no paths at all": { attachments: [IMG], input: {} },
  "input null": { attachments: [IMG], input: null },
  "input absent": { attachments: [IMG] },
  "no attachments": { attachments: [], input: { filename: "x.png" } },
  "non-image attachment": { attachments: [{ mime: "text/plain", url: "http://x" }], input: { filename: "x.png" } },
};

let fail = 0;
for (const [name, e] of Object.entries(cases)) {
  try {
    const r = call(e);
    console.log(
      name.padEnd(30),
      "labels=" + JSON.stringify(r.map((x) => x.label)),
      "alts=" + JSON.stringify(r.map((x) => x.alt)),
    );
  } catch (err) {
    fail++;
    console.log(name.padEnd(30), "THREW:", err.message);
  }
}
console.log(fail === 0 ? "all cases executed" : fail + " case(s) threw");
process.exit(fail === 0 ? 0 : 1);
