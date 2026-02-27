#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";

import {TreeFragment} from "@lezer/common";
import {parser} from "../dist/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const DEFAULT_MODE = "all";
const DEFAULT_MAX_FILES = 500;
const DEFAULT_FUZZ_CASES = 250;
const DEFAULT_INCREMENTAL_CASES = 150;
const DEFAULT_SEED = (Date.now() ^ (process.pid << 8)) >>> 0;
const MAX_EXAMPLES = 30;
const MAX_SEED_POOL = 300;

const INSERT_TOKENS = [
  "(",
  ")",
  "[",
  "]",
  "{",
  "}",
  "<",
  ">",
  "=>",
  "->",
  "=",
  ":",
  ";",
  "|",
  "~",
  "?",
  "@",
  "...",
  "dict{",
  "switch ",
  "type ",
  "module ",
  "let ",
];

function printHelp() {
  console.log(`Usage: node scripts/audit-grammar.mjs [options]

Runs grammar audit checks for rescript-lezer:
  - Differential parsing vs official ReScript parser
  - Mutation fuzzing and mismatch detection
  - Incremental parse consistency checks

Options:
  --mode <all|differential|fuzz|incremental>   Audit mode (default: ${DEFAULT_MODE})
  --rescript-root <path>                        Path to rescript monorepo (default: ../rescript)
  --corpus <path>                               Extra corpus directory (repeatable)
  --include-idempotency                         Include syntax_tests/data/idempotency corpus
  --include-resi                                Include .resi files (default: .res only)
  --max-files <n>                               Max corpus files for differential/fuzz seed pool (default: ${DEFAULT_MAX_FILES})
  --fuzz-cases <n>                              Number of mutation fuzz cases (default: ${DEFAULT_FUZZ_CASES})
  --incremental-cases <n>                       Number of incremental edit checks (default: ${DEFAULT_INCREMENTAL_CASES})
  --seed <n>                                    RNG seed (default: ${DEFAULT_SEED})
  --report <file>                               Write JSON report
  --fail-on-mismatch                            Exit non-zero on parser mismatches
  --fail-on-crash                               Exit non-zero on parser crashes
  --verbose                                     Print per-file progress
  --help                                        Show this help

Examples:
  node scripts/audit-grammar.mjs --mode all --max-files 800 --report /tmp/lezer-audit.json
  node scripts/audit-grammar.mjs --mode differential --fail-on-mismatch
  node scripts/audit-grammar.mjs --mode fuzz --seed 12345 --fuzz-cases 500
`);
}

function parseArgs(argv) {
  const options = {
    mode: DEFAULT_MODE,
    rescriptRoot: process.env.RESCRIPT_ROOT
      ? path.resolve(process.env.RESCRIPT_ROOT)
      : path.resolve(repoRoot, "../rescript"),
    corpus: [],
    includeIdempotency: false,
    includeResi: false,
    maxFiles: DEFAULT_MAX_FILES,
    fuzzCases: DEFAULT_FUZZ_CASES,
    incrementalCases: DEFAULT_INCREMENTAL_CASES,
    seed: DEFAULT_SEED,
    report: null,
    failOnMismatch: false,
    failOnCrash: false,
    verbose: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--mode" && next) {
      options.mode = next;
      i++;
      continue;
    }
    if (arg === "--rescript-root" && next) {
      options.rescriptRoot = path.resolve(next);
      i++;
      continue;
    }
    if (arg === "--corpus" && next) {
      options.corpus.push(path.resolve(next));
      i++;
      continue;
    }
    if (arg === "--max-files" && next) {
      options.maxFiles = Number(next);
      i++;
      continue;
    }
    if (arg === "--fuzz-cases" && next) {
      options.fuzzCases = Number(next);
      i++;
      continue;
    }
    if (arg === "--incremental-cases" && next) {
      options.incrementalCases = Number(next);
      i++;
      continue;
    }
    if (arg === "--seed" && next) {
      options.seed = Number(next);
      i++;
      continue;
    }
    if (arg === "--report" && next) {
      options.report = path.resolve(next);
      i++;
      continue;
    }
    if (arg === "--include-idempotency") {
      options.includeIdempotency = true;
      continue;
    }
    if (arg === "--include-resi") {
      options.includeResi = true;
      continue;
    }
    if (arg === "--fail-on-mismatch") {
      options.failOnMismatch = true;
      continue;
    }
    if (arg === "--fail-on-crash") {
      options.failOnCrash = true;
      continue;
    }
    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }
    if (arg === "--help") {
      options.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const validModes = new Set(["all", "differential", "fuzz", "incremental"]);
  if (!validModes.has(options.mode)) {
    throw new Error(`Invalid --mode "${options.mode}"`);
  }

  if (!Number.isFinite(options.maxFiles) || options.maxFiles <= 0) {
    throw new Error(`Invalid --max-files value "${options.maxFiles}"`);
  }
  if (!Number.isFinite(options.fuzzCases) || options.fuzzCases < 0) {
    throw new Error(`Invalid --fuzz-cases value "${options.fuzzCases}"`);
  }
  if (!Number.isFinite(options.incrementalCases) || options.incrementalCases < 0) {
    throw new Error(`Invalid --incremental-cases value "${options.incrementalCases}"`);
  }
  if (!Number.isFinite(options.seed)) {
    throw new Error(`Invalid --seed value "${options.seed}"`);
  }

  options.seed = options.seed >>> 0;
  return options;
}

function makeRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, maxExclusive) {
  if (maxExclusive <= 0) return 0;
  return Math.floor(rng() * maxExclusive);
}

function pick(rng, arr) {
  return arr[randInt(rng, arr.length)];
}

function walkFiles(rootDir, matcher) {
  const out = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const dir = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true});
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "_build") {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && matcher(fullPath)) {
        out.push(fullPath);
      }
    }
  }

  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function getCorpusDirectories(options) {
  const defaults = [
    path.join(options.rescriptRoot, "tests/syntax_tests/data/parsing/grammar"),
    path.join(options.rescriptRoot, "tests/syntax_tests/data/printer"),
  ];
  if (options.includeIdempotency) {
    defaults.push(path.join(options.rescriptRoot, "tests/syntax_tests/data/idempotency"));
  }

  const set = new Set([...defaults, ...options.corpus].map((dir) => path.resolve(dir)));
  return [...set].filter((dir) => fs.existsSync(dir));
}

function collectCorpusFiles(corpusDirs, options) {
  const allowedExt = options.includeResi ? new Set([".res", ".resi"]) : new Set([".res"]);
  const files = [];
  for (const dir of corpusDirs) {
    files.push(
      ...walkFiles(dir, (filePath) => {
        const ext = path.extname(filePath);
        return allowedExt.has(ext);
      }),
    );
  }
  files.sort((a, b) => a.localeCompare(b));
  return files.slice(0, options.maxFiles);
}

function sanitizeDiagnostic(msg) {
  if (!msg) return "";
  return msg
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function summarizeDiagnostic(msg) {
  const cleaned = sanitizeDiagnostic(msg);
  if (!cleaned) return "";
  return cleaned.split("\n").find((line) => line.trim().length > 0) || "";
}

function parseWithReScriptFile(filePath, toolchain) {
  const result = spawnSync(
    toolchain.bscExe,
    ["-only-parse", "-runtime-path", toolchain.runtimePath, filePath],
    {
      cwd: toolchain.rescriptRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      maxBuffer: 1024 * 1024 * 8,
    },
  );

  const status = result.status ?? 1;
  return {
    ok: status === 0,
    status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    crashed: Boolean(result.error),
    error: result.error ? String(result.error) : "",
  };
}

function parseWithReScriptText(text, extension, toolchain, tempDir, index) {
  const filePath = path.join(tempDir, `audit-case-${index}${extension}`);
  fs.writeFileSync(filePath, text, "utf8");
  return parseWithReScriptFile(filePath, toolchain);
}

function collectLezerErrors(tree, maxCount = 10) {
  const errors = [];
  const cursor = tree.cursor();
  do {
    if (cursor.type.isError || cursor.name === "⚠") {
      errors.push({from: cursor.from, to: cursor.to, name: cursor.name});
      if (errors.length >= maxCount) break;
    }
  } while (cursor.next());
  return errors;
}

function parseWithLezer(text) {
  try {
    const tree = parser.parse(text);
    const errors = collectLezerErrors(tree);
    return {
      ok: errors.length === 0,
      crashed: false,
      error: "",
      errors,
      tree,
    };
  } catch (error) {
    return {
      ok: false,
      crashed: true,
      error: String(error?.stack || error),
      errors: [],
      tree: null,
    };
  }
}

function classifyAgreement(lezerResult, rescriptResult) {
  if (lezerResult.crashed) return "lezer_crash";
  if (rescriptResult.crashed) return "rescript_crash";
  if (lezerResult.ok && rescriptResult.ok) return "both_accept";
  if (!lezerResult.ok && !rescriptResult.ok) return "both_reject";
  if (lezerResult.ok && !rescriptResult.ok) return "lezer_false_positive";
  return "lezer_false_negative";
}

function shortLezerErrorSummary(errors) {
  if (errors.length === 0) return "";
  return errors
    .slice(0, 3)
    .map((e) => `${e.name}@${e.from}-${e.to}`)
    .join(", ");
}

function summarizeTextPreview(text, maxLen = 140) {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLen) return compact;
  return `${compact.slice(0, maxLen - 1)}…`;
}

function runDifferentialAudit(files, toolchain, options) {
  const summary = {
    filesScanned: files.length,
    bothAccept: 0,
    bothReject: 0,
    lezerFalsePositive: 0,
    lezerFalseNegative: 0,
    lezerCrash: 0,
    rescriptCrash: 0,
    mismatches: [],
    seedPool: [],
  };

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const text = fs.readFileSync(filePath, "utf8");
    const lezerResult = parseWithLezer(text);
    const rescriptResult = parseWithReScriptFile(filePath, toolchain);
    const cls = classifyAgreement(lezerResult, rescriptResult);

    if (options.verbose && (i % 25 === 0 || i === files.length - 1)) {
      console.log(`[differential] ${i + 1}/${files.length} ${path.relative(repoRoot, filePath)}`);
    }

    switch (cls) {
      case "both_accept":
        summary.bothAccept++;
        if (summary.seedPool.length < MAX_SEED_POOL) {
          summary.seedPool.push({
            filePath,
            extension: path.extname(filePath) || ".res",
            text,
          });
        }
        break;
      case "both_reject":
        summary.bothReject++;
        break;
      case "lezer_false_positive":
        summary.lezerFalsePositive++;
        if (summary.mismatches.length < MAX_EXAMPLES) {
          summary.mismatches.push({
            kind: cls,
            filePath,
            lezerError: shortLezerErrorSummary(lezerResult.errors),
            rescriptError: summarizeDiagnostic(rescriptResult.stderr),
            preview: summarizeTextPreview(text),
          });
        }
        break;
      case "lezer_false_negative":
        summary.lezerFalseNegative++;
        if (summary.mismatches.length < MAX_EXAMPLES) {
          summary.mismatches.push({
            kind: cls,
            filePath,
            lezerError: shortLezerErrorSummary(lezerResult.errors),
            rescriptError: summarizeDiagnostic(rescriptResult.stderr),
            preview: summarizeTextPreview(text),
          });
        }
        break;
      case "lezer_crash":
        summary.lezerCrash++;
        if (summary.mismatches.length < MAX_EXAMPLES) {
          summary.mismatches.push({
            kind: cls,
            filePath,
            lezerError: lezerResult.error,
            rescriptError: summarizeDiagnostic(rescriptResult.stderr),
            preview: summarizeTextPreview(text),
          });
        }
        break;
      case "rescript_crash":
        summary.rescriptCrash++;
        if (summary.mismatches.length < MAX_EXAMPLES) {
          summary.mismatches.push({
            kind: cls,
            filePath,
            lezerError: shortLezerErrorSummary(lezerResult.errors),
            rescriptError: rescriptResult.error,
            preview: summarizeTextPreview(text),
          });
        }
        break;
      default:
        break;
    }
  }

  return summary;
}

function mutateText(source, rng) {
  const text = source.length > 0 ? source : "let x = 1";
  const op = randInt(rng, 7);
  const len = text.length;
  const insertToken = pick(rng, INSERT_TOKENS);

  if (op === 0 && len > 0) {
    const from = randInt(rng, len);
    const to = Math.min(len, from + 1 + randInt(rng, 4));
    return text.slice(0, from) + text.slice(to);
  }

  if (op === 1) {
    const pos = randInt(rng, len + 1);
    return text.slice(0, pos) + insertToken + text.slice(pos);
  }

  if (op === 2 && len > 0) {
    const from = randInt(rng, len);
    const to = Math.min(len, from + 1 + randInt(rng, 3));
    return text.slice(0, from) + insertToken + text.slice(to);
  }

  if (op === 3) {
    const lines = text.split("\n").filter((line) => line.length > 0);
    if (lines.length === 0) return `${text}\n${insertToken}`;
    const line = pick(rng, lines);
    const pos = randInt(rng, len + 1);
    return `${text.slice(0, pos)}${line}\n${text.slice(pos)}`;
  }

  if (op === 4) {
    return `${text}\nlet _audit =`;
  }

  if (op === 5) {
    const closeChars = [")", "]", "}", ">"];
    const candidates = [];
    for (let i = 0; i < len; i++) {
      if (closeChars.includes(text[i])) candidates.push(i);
    }
    if (candidates.length > 0) {
      const index = candidates[randInt(rng, candidates.length)];
      return text.slice(0, index) + text.slice(index + 1);
    }
  }

  const pos = randInt(rng, len + 1);
  return `${text.slice(0, pos)} ${insertToken} ${text.slice(pos)}`;
}

function runFuzzAudit(seedPool, toolchain, options, rng) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rescript-lezer-audit-"));
  const summary = {
    cases: options.fuzzCases,
    bothAccept: 0,
    bothReject: 0,
    lezerFalsePositive: 0,
    lezerFalseNegative: 0,
    lezerCrash: 0,
    rescriptCrash: 0,
    mismatches: [],
  };

  if (seedPool.length === 0 || options.fuzzCases === 0) {
    fs.rmSync(tempDir, {recursive: true, force: true});
    return summary;
  }

  for (let i = 0; i < options.fuzzCases; i++) {
    const seed = pick(rng, seedPool);
    const mutated = mutateText(seed.text, rng);
    const lezerResult = parseWithLezer(mutated);
    const rescriptResult = parseWithReScriptText(
      mutated,
      seed.extension || ".res",
      toolchain,
      tempDir,
      i + 1,
    );
    const cls = classifyAgreement(lezerResult, rescriptResult);

    switch (cls) {
      case "both_accept":
        summary.bothAccept++;
        break;
      case "both_reject":
        summary.bothReject++;
        break;
      case "lezer_false_positive":
        summary.lezerFalsePositive++;
        break;
      case "lezer_false_negative":
        summary.lezerFalseNegative++;
        break;
      case "lezer_crash":
        summary.lezerCrash++;
        break;
      case "rescript_crash":
        summary.rescriptCrash++;
        break;
      default:
        break;
    }

    if (
      cls !== "both_accept" &&
      cls !== "both_reject" &&
      summary.mismatches.length < MAX_EXAMPLES
    ) {
      summary.mismatches.push({
        kind: cls,
        seedFile: seed.filePath,
        lezerError: lezerResult.crashed
          ? lezerResult.error
          : shortLezerErrorSummary(lezerResult.errors),
        rescriptError: rescriptResult.crashed
          ? rescriptResult.error
          : summarizeDiagnostic(rescriptResult.stderr),
        preview: summarizeTextPreview(mutated),
      });
    }
  }

  fs.rmSync(tempDir, {recursive: true, force: true});
  return summary;
}

function randomEdit(text, rng) {
  const source = text.length > 0 ? text : "let x = 1";
  const len = source.length;
  const op = randInt(rng, 3);
  const token = pick(rng, INSERT_TOKENS);

  if (op === 0) {
    const pos = randInt(rng, len + 1);
    const nextText = source.slice(0, pos) + token + source.slice(pos);
    return {
      nextText,
      change: {
        fromA: pos,
        toA: pos,
        fromB: pos,
        toB: pos + token.length,
      },
    };
  }

  if (op === 1 && len > 0) {
    const from = randInt(rng, len);
    const to = Math.min(len, from + 1 + randInt(rng, 4));
    const nextText = source.slice(0, from) + source.slice(to);
    return {
      nextText,
      change: {
        fromA: from,
        toA: to,
        fromB: from,
        toB: from,
      },
    };
  }

  const from = len > 0 ? randInt(rng, len) : 0;
  const to = len > 0 ? Math.min(len, from + 1 + randInt(rng, 3)) : 0;
  const nextText = source.slice(0, from) + token + source.slice(to);
  return {
    nextText,
    change: {
      fromA: from,
      toA: to,
      fromB: from,
      toB: from + token.length,
    },
  };
}

function runIncrementalAudit(seedPool, options, rng) {
  const summary = {
    cases: options.incrementalCases,
    matched: 0,
    mismatched: 0,
    crashes: 0,
    mismatches: [],
  };

  if (seedPool.length === 0 || options.incrementalCases === 0) {
    return summary;
  }

  for (let i = 0; i < options.incrementalCases; i++) {
    const seed = pick(rng, seedPool);
    const source = seed.text;
    try {
      const originalTree = parser.parse(source);
      const {nextText, change} = randomEdit(source, rng);
      const fragments = TreeFragment.applyChanges(TreeFragment.addTree(originalTree), [change]);
      const incrementalTree = parser.parse(nextText, fragments);
      const freshTree = parser.parse(nextText);
      const equal = incrementalTree.toString() === freshTree.toString();
      if (equal) {
        summary.matched++;
      } else {
        summary.mismatched++;
        if (summary.mismatches.length < MAX_EXAMPLES) {
          summary.mismatches.push({
            seedFile: seed.filePath,
            preview: summarizeTextPreview(nextText),
          });
        }
      }
    } catch (error) {
      summary.crashes++;
      if (summary.mismatches.length < MAX_EXAMPLES) {
        summary.mismatches.push({
          seedFile: seed.filePath,
          preview: summarizeTextPreview(seed.text),
          error: String(error?.stack || error),
        });
      }
    }
  }

  return summary;
}

function printDifferentialSummary(summary) {
  console.log("\nDifferential audit");
  console.log(`  files:               ${summary.filesScanned}`);
  console.log(`  both accept:         ${summary.bothAccept}`);
  console.log(`  both reject:         ${summary.bothReject}`);
  console.log(`  lezer false+ :       ${summary.lezerFalsePositive}`);
  console.log(`  lezer false- :       ${summary.lezerFalseNegative}`);
  console.log(`  lezer crashes:       ${summary.lezerCrash}`);
  console.log(`  rescript crashes:    ${summary.rescriptCrash}`);

  if (summary.mismatches.length > 0) {
    console.log("  sample mismatches:");
    for (const mismatch of summary.mismatches.slice(0, 10)) {
      const rel = path.isAbsolute(mismatch.filePath)
        ? path.relative(repoRoot, mismatch.filePath)
        : mismatch.filePath;
      console.log(
        `    - [${mismatch.kind}] ${rel} | lezer: ${mismatch.lezerError || "-"} | rescript: ${
          summarizeDiagnostic(mismatch.rescriptError) || "-"
        }`,
      );
    }
  }
}

function printFuzzSummary(summary) {
  console.log("\nFuzz audit");
  console.log(`  cases:               ${summary.cases}`);
  console.log(`  both accept:         ${summary.bothAccept}`);
  console.log(`  both reject:         ${summary.bothReject}`);
  console.log(`  lezer false+ :       ${summary.lezerFalsePositive}`);
  console.log(`  lezer false- :       ${summary.lezerFalseNegative}`);
  console.log(`  lezer crashes:       ${summary.lezerCrash}`);
  console.log(`  rescript crashes:    ${summary.rescriptCrash}`);

  if (summary.mismatches.length > 0) {
    console.log("  sample mismatches:");
    for (const mismatch of summary.mismatches.slice(0, 10)) {
      const rel = path.relative(repoRoot, mismatch.seedFile || "");
      console.log(
        `    - [${mismatch.kind}] seed=${rel} | lezer: ${mismatch.lezerError || "-"} | rescript: ${
          summarizeDiagnostic(mismatch.rescriptError) || "-"
        } | ${mismatch.preview}`,
      );
    }
  }
}

function printIncrementalSummary(summary) {
  console.log("\nIncremental audit");
  console.log(`  cases:               ${summary.cases}`);
  console.log(`  matched trees:       ${summary.matched}`);
  console.log(`  mismatched trees:    ${summary.mismatched}`);
  console.log(`  crashes:             ${summary.crashes}`);
  if (summary.mismatches.length > 0) {
    console.log("  sample mismatches:");
    for (const mismatch of summary.mismatches.slice(0, 10)) {
      const rel = mismatch.seedFile ? path.relative(repoRoot, mismatch.seedFile) : "(unknown)";
      console.log(`    - seed=${rel} | ${mismatch.preview}`);
    }
  }
}

function ensureToolchain(options) {
  const toolchain = {
    rescriptRoot: options.rescriptRoot,
    bscExe: path.join(options.rescriptRoot, "_build/default/compiler/bsc/rescript_compiler_main.exe"),
    runtimePath: path.join(options.rescriptRoot, "packages/@rescript/runtime"),
  };

  if (!fs.existsSync(toolchain.bscExe)) {
    throw new Error(`ReScript compiler not found at ${toolchain.bscExe}. Run build in rescript repo.`);
  }
  if (!fs.existsSync(toolchain.runtimePath)) {
    throw new Error(`ReScript runtime not found at ${toolchain.runtimePath}`);
  }
  return toolchain;
}

function summarizeFindings(report) {
  let mismatches = 0;
  let crashes = 0;

  if (report.differential) {
    mismatches += report.differential.lezerFalsePositive + report.differential.lezerFalseNegative;
    crashes += report.differential.lezerCrash + report.differential.rescriptCrash;
  }
  if (report.fuzz) {
    mismatches += report.fuzz.lezerFalsePositive + report.fuzz.lezerFalseNegative;
    crashes += report.fuzz.lezerCrash + report.fuzz.rescriptCrash;
  }
  if (report.incremental) {
    mismatches += report.incremental.mismatched;
    crashes += report.incremental.crashes;
  }
  return {mismatches, crashes};
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  console.log("ReScript Lezer grammar audit");
  console.log(`  mode:      ${options.mode}`);
  console.log(`  seed:      ${options.seed}`);
  console.log(`  repo:      ${repoRoot}`);

  const report = {
    generatedAt: new Date().toISOString(),
    options: {
      ...options,
      corpus: [...options.corpus],
    },
  };

  const rng = makeRng(options.seed);

  let files = [];
  let seedPool = [];
  let toolchain = null;

  const needsRescriptComparator = options.mode === "all" || options.mode === "differential" || options.mode === "fuzz";
  if (needsRescriptComparator) {
    toolchain = ensureToolchain(options);
    const corpusDirs = getCorpusDirectories(options);
    if (corpusDirs.length === 0) {
      throw new Error("No corpus directories found. Pass --corpus or check --rescript-root.");
    }
    files = collectCorpusFiles(corpusDirs, options);
    if (files.length === 0) {
      throw new Error("No .res corpus files found with current options.");
    }
    console.log(`  corpus dirs: ${corpusDirs.length}`);
    console.log(`  corpus files considered: ${files.length}`);
  }

  if (options.mode === "all" || options.mode === "differential") {
    report.differential = runDifferentialAudit(files, toolchain, options);
    seedPool = report.differential.seedPool;
    printDifferentialSummary(report.differential);
  }

  if (options.mode === "fuzz") {
    const corpusDirs = getCorpusDirectories(options);
    files = collectCorpusFiles(corpusDirs, options);
    for (const filePath of files) {
      const text = fs.readFileSync(filePath, "utf8");
      const lezerResult = parseWithLezer(text);
      const rescriptResult = parseWithReScriptFile(filePath, toolchain);
      if (classifyAgreement(lezerResult, rescriptResult) === "both_accept") {
        seedPool.push({
          filePath,
          extension: path.extname(filePath) || ".res",
          text,
        });
        if (seedPool.length >= MAX_SEED_POOL) break;
      }
    }
  }

  if (options.mode === "all" || options.mode === "fuzz") {
    report.fuzz = runFuzzAudit(seedPool, toolchain, options, rng);
    printFuzzSummary(report.fuzz);
  }

  if (options.mode === "all" || options.mode === "incremental") {
    let incrementalSeeds = seedPool;
    if (incrementalSeeds.length === 0) {
      const testFiles = walkFiles(path.join(repoRoot, "test"), (filePath) => filePath.endsWith(".txt"));
      for (const filePath of testFiles.slice(0, 8)) {
        const raw = fs.readFileSync(filePath, "utf8");
        const snippets = raw.split(/\n==>\n/);
        for (const snippet of snippets) {
          const code = snippet
            .split("\n")
            .slice(1)
            .join("\n")
            .trim();
          if (code.length > 0) {
            incrementalSeeds.push({
              filePath,
              extension: ".res",
              text: code,
            });
            if (incrementalSeeds.length >= MAX_SEED_POOL) break;
          }
        }
        if (incrementalSeeds.length >= MAX_SEED_POOL) break;
      }
    }
    report.incremental = runIncrementalAudit(incrementalSeeds, options, rng);
    printIncrementalSummary(report.incremental);
  }

  if (options.report) {
    fs.mkdirSync(path.dirname(options.report), {recursive: true});
    fs.writeFileSync(options.report, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nWrote report: ${options.report}`);
  }

  const findings = summarizeFindings(report);
  console.log("\nFindings");
  console.log(`  mismatches: ${findings.mismatches}`);
  console.log(`  crashes:    ${findings.crashes}`);

  if ((options.failOnMismatch && findings.mismatches > 0) || (options.failOnCrash && findings.crashes > 0)) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(String(error?.stack || error));
  process.exit(1);
}
