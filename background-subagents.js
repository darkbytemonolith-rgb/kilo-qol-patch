const fs = require("fs");
const os = require("os");
const path = require("path");

const RULE_NAME = "kilo-qol-background-subagents.md";
const STATE_NAME = ".kilo-qol-patch-background-subagents.json";
const RULE_SOURCE = path.join(__dirname, "rules", "background-subagents.md");

function configDir() {
  const root =
    process.env.KILO_CONFIG_DIR ||
    process.env.XDG_CONFIG_HOME ||
    path.join(os.homedir(), ".config");
  return process.env.KILO_CONFIG_DIR ? root : path.join(root, "kilo");
}

function skipTrivia(text, start) {
  let i = start;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++;
    } else if (text.startsWith("//", i)) {
      const end = text.indexOf("\n", i + 2);
      i = end < 0 ? text.length : end + 1;
    } else if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) throw new Error("Unterminated comment in Kilo config.");
      i = end + 2;
    } else {
      break;
    }
  }
  return i;
}

function readString(text, start) {
  if (text[start] !== '"') throw new Error("Expected a quoted string in Kilo config.");
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === "\\") {
      i += 2;
    } else if (text[i++] === '"') {
      return { value: JSON.parse(text.slice(start, i)), end: i };
    }
  }
  throw new Error("Unterminated string in Kilo config.");
}

function matchingEnd(text, start) {
  const pairs = { "{": "}", "[": "]" };
  const stack = [];
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      i = readString(text, i).end;
    } else if (text.startsWith("//", i)) {
      const end = text.indexOf("\n", i + 2);
      i = end < 0 ? text.length : end + 1;
    } else if (text.startsWith("/*", i)) {
      const end = text.indexOf("*/", i + 2);
      if (end < 0) throw new Error("Unterminated comment in Kilo config.");
      i = end + 2;
    } else if (pairs[ch]) {
      stack.push(pairs[ch]);
      i++;
    } else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) throw new Error("Mismatched brackets in Kilo config.");
      if (stack.length === 0) return i;
      i++;
    } else {
      i++;
    }
  }
  throw new Error("Unterminated value in Kilo config.");
}

function skipValue(text, start) {
  const i = skipTrivia(text, start);
  if (text[i] === "{" || text[i] === "[") return matchingEnd(text, i) + 1;
  if (text[i] === '"') return readString(text, i).end;
  let end = i;
  while (end < text.length && !",}]".includes(text[end])) end++;
  return end;
}

function parseStringArray(text, start, end) {
  const items = [];
  let i = start + 1;
  let trailingComma = false;
  while (true) {
    i = skipTrivia(text, i);
    if (i === end) return { items, trailingComma };
    const item = readString(text, i);
    items.push({ ...item, start: i, comma: -1 });
    i = skipTrivia(text, item.end);
    if (text[i] === "]") return { items, trailingComma };
    if (text[i] !== ",") {
      throw new Error("Kilo config instructions must be an array of file paths.");
    }
    items[items.length - 1].comma = i;
    i = skipTrivia(text, i + 1);
    if (i === end) {
      trailingComma = true;
      return { items, trailingComma };
    }
  }
}

function locateInstructions(text) {
  const rootStart = skipTrivia(text, text.charCodeAt(0) === 0xfeff ? 1 : 0);
  if (text[rootStart] !== "{") throw new Error("Kilo config must contain a JSON object.");
  const rootEnd = matchingEnd(text, rootStart);
  let i = rootStart + 1;
  let rootHasEntries = false;
  let rootTrailingComma = false;

  while (true) {
    i = skipTrivia(text, i);
    if (i === rootEnd) {
      return {
        rootStart,
        rootEnd,
        rootHasEntries,
        rootTrailingComma,
        instructions: null,
      };
    }
    const key = readString(text, i);
    i = skipTrivia(text, key.end);
    if (text[i] !== ":") throw new Error("Expected ':' in Kilo config.");
    const valueStart = skipTrivia(text, i + 1);
    rootHasEntries = true;

    if (key.value === "instructions") {
      if (text[valueStart] !== "[") {
        throw new Error("Kilo config 'instructions' must be an array of file paths.");
      }
      const end = matchingEnd(text, valueStart);
      return {
        rootStart,
        rootEnd,
        rootHasEntries,
        rootTrailingComma,
        instructions: {
          start: valueStart,
          end,
          ...parseStringArray(text, valueStart, end),
        },
      };
    }

    i = skipTrivia(text, skipValue(text, valueStart));
    if (text[i] === ",") {
      i = skipTrivia(text, i + 1);
      if (i === rootEnd) rootTrailingComma = true;
    } else if (i !== rootEnd) {
      throw new Error("Expected ',' or '}' in Kilo config.");
    }
  }
}

function addInstruction(text, instructionPath) {
  const location = locateInstructions(text);
  if (location.instructions) {
    const { start, end, items, trailingComma } = location.instructions;
    if (items.some((item) => item.value === instructionPath)) {
      return { text, added: false };
    }
    const separator = items.length && !trailingComma ? "," : "";
    return {
      text:
        text.slice(0, end) +
        `${separator} ${JSON.stringify(instructionPath)}` +
        text.slice(end),
      added: true,
    };
  }

  const separator = location.rootHasEntries && !location.rootTrailingComma ? "," : "";
  return {
    text:
      text.slice(0, location.rootEnd) +
      `${separator}\n  "instructions": [${JSON.stringify(instructionPath)}]\n` +
      text.slice(location.rootEnd),
    added: true,
  };
}

function removeInstruction(text, instructionPath) {
  const location = locateInstructions(text);
  const array = location.instructions;
  if (!array) return { text, removed: false };
  const index = array.items.findIndex((item) => item.value === instructionPath);
  if (index < 0) return { text, removed: false };
  const item = array.items[index];
  const comma =
    item.comma >= 0 ? item.comma : index > 0 ? array.items[index - 1].comma : -1;
  const removals = [{ start: item.start, end: item.end }];
  if (comma >= 0) removals.push({ start: comma, end: comma + 1 });
  let updated = text;
  for (const range of removals.sort((a, b) => b.start - a.start)) {
    updated = updated.slice(0, range.start) + updated.slice(range.end);
  }
  return { text: updated, removed: true };
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

function configPaths(configDir) {
  const rulePath = path.join(configDir, "rules", RULE_NAME).replace(/\\/g, "/");
  return {
    config: path.join(configDir, "kilo.jsonc"),
    rule: path.join(configDir, "rules", RULE_NAME),
    state: path.join(configDir, STATE_NAME),
    rulePath,
  };
}

function readState(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const state = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (typeof state.addedInstruction !== "boolean" || typeof state.createdRule !== "boolean") {
    throw new Error("Kilo QoL Patch ownership state is invalid; refusing to alter Kilo config.");
  }
  return state;
}

function enable(configDir) {
  const paths = configPaths(configDir);
  const previous = readState(paths.state);
  const ruleText = fs.readFileSync(RULE_SOURCE, "utf8");
  let configText = fs.existsSync(paths.config)
    ? fs.readFileSync(paths.config, "utf8")
    : "{}\n";
  const updated = addInstruction(configText, paths.rulePath);
  configText = updated.text;

  const ruleExisted = fs.existsSync(paths.rule);
  if (ruleExisted && fs.readFileSync(paths.rule, "utf8") !== ruleText) {
    throw new Error(`Refusing to overwrite existing Kilo rule file: ${paths.rule}`);
  }

  if (!ruleExisted) writeText(paths.rule, ruleText);
  if (configText !== (fs.existsSync(paths.config) ? fs.readFileSync(paths.config, "utf8") : "{}\n")) {
    writeText(paths.config, configText);
  }

  const state = {
    addedInstruction: previous.addedInstruction || updated.added,
    createdRule: previous.createdRule || !ruleExisted,
  };
  if (state.addedInstruction || state.createdRule) {
    writeText(paths.state, JSON.stringify(state, null, 2) + "\n");
  }
  return { changed: updated.added || !ruleExisted, rulePath: paths.rulePath };
}

function disable(configDir) {
  const paths = configPaths(configDir);
  if (!fs.existsSync(paths.state)) return { changed: false };
  const state = readState(paths.state);

  if (state.addedInstruction && fs.existsSync(paths.config)) {
    const original = fs.readFileSync(paths.config, "utf8");
    const updated = removeInstruction(original, paths.rulePath);
    if (updated.text !== original) writeText(paths.config, updated.text);
  }

  if (state.createdRule && state.addedInstruction && fs.existsSync(paths.rule)) {
    const expected = fs.readFileSync(RULE_SOURCE, "utf8");
    if (fs.readFileSync(paths.rule, "utf8") === expected) fs.unlinkSync(paths.rule);
  }
  fs.unlinkSync(paths.state);
  return { changed: true };
}

module.exports = { configDir, enable, disable };
