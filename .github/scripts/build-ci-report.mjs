#!/usr/bin/env node
// Builds the sticky PR comment (pr-comment.md) from CI step outcomes and test output.
// Reads its inputs entirely from environment variables set by .github/workflows/ci.yml.

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const env = process.env;

function readIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function outcomeBadge(outcome) {
  if (outcome === "success") return "✅ Passed";
  if (outcome === "skipped") return "⏭️ Skipped";
  if (!outcome) return "⚠️ Unknown";
  return "❌ Failed";
}

function pct(value) {
  return value === undefined || value === null ? "—" : `${value}%`;
}

// ---- Parse `node --test --experimental-test-coverage` output (apps/api) ----
function parseApiOutput(text) {
  const last = (regex) => {
    const matches = [...text.matchAll(regex)];
    return matches.length ? matches[matches.length - 1] : null;
  };

  const tests = last(/^# tests (\d+)/gm)?.[1];
  const pass = last(/^# pass (\d+)/gm)?.[1];
  const fail = last(/^# fail (\d+)/gm)?.[1];
  const skipped = last(/^# skipped (\d+)/gm)?.[1];
  const durationMs = last(/^# duration_ms ([\d.]+)/gm)?.[1];

  const coverageMatch = text.match(
    /^# all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/m
  );

  return {
    tests: tests ? Number(tests) : undefined,
    pass: pass ? Number(pass) : undefined,
    fail: fail ? Number(fail) : undefined,
    skipped: skipped ? Number(skipped) : undefined,
    durationMs: durationMs ? Number(durationMs) : undefined,
    coverage: coverageMatch
      ? {
          lines: coverageMatch[1],
          branches: coverageMatch[2],
          funcs: coverageMatch[3],
        }
      : null,
  };
}

// ---- Parse `vitest run --coverage` output (apps/web) ----
function parseWebOutput(text) {
  const testFiles = text.match(
    /^\s*Test Files\s+(\d+) passed(?:, (\d+) failed)?\s*\((\d+)\)/m
  );
  const tests = text.match(
    /^\s*Tests\s+(\d+) passed(?:, (\d+) failed)?\s*\((\d+)\)/m
  );
  const duration = text.match(/^\s*Duration\s+([\d.]+\S*)/m);

  const stmts = text.match(/Statements\s*:\s*([\d.]+)%/);
  const branches = text.match(/Branches\s*:\s*([\d.]+)%/);
  const funcs = text.match(/Functions\s*:\s*([\d.]+)%/);
  const lines = text.match(/Lines\s*:\s*([\d.]+)%/);

  return {
    testFiles: testFiles
      ? {
          passed: Number(testFiles[1]),
          failed: Number(testFiles[2] || 0),
          total: Number(testFiles[3]),
        }
      : null,
    tests: tests
      ? {
          passed: Number(tests[1]),
          failed: Number(tests[2] || 0),
          total: Number(tests[3]),
        }
      : null,
    duration: duration?.[1],
    coverage:
      stmts || lines
        ? {
            lines: lines?.[1] ?? stmts?.[1],
            branches: branches?.[1],
            funcs: funcs?.[1],
          }
        : null,
  };
}

// ---- New tests added in this PR (best-effort, via git diff) ----
function countNewTests(baseSha, headSha) {
  if (!baseSha) return null;

  let changedFiles;
  try {
    changedFiles = execSync(`git diff --name-only ${baseSha}...${headSha}`, {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean)
      .filter((f) => /\.(test|spec)\.[jt]sx?$/.test(f));
  } catch {
    return null;
  }

  const testCallPattern = /\b(test|it)(\.each)?\s*\(/;
  const rows = [];
  let totalAdded = 0;
  let totalRemoved = 0;

  for (const file of changedFiles) {
    let diff;
    try {
      diff = execSync(
        `git diff ${baseSha}...${headSha} -- ${JSON.stringify(file)}`,
        {
          encoding: "utf8",
          maxBuffer: 10 * 1024 * 1024,
        }
      );
    } catch {
      continue;
    }

    let added = 0;
    let removed = 0;
    for (const line of diff.split("\n")) {
      if (line.startsWith("+++") || line.startsWith("---")) continue;
      if (line.startsWith("+") && testCallPattern.test(line)) added++;
      if (line.startsWith("-") && testCallPattern.test(line)) removed++;
    }

    if (added || removed) {
      rows.push({
        file,
        added,
        removed,
        isNewFile: !existsSync(file) ? false : diff.includes("new file mode"),
      });
      totalAdded += added;
      totalRemoved += removed;
    }
  }

  return { rows, totalAdded, totalRemoved };
}

// ---- Gather everything ----
const apiOutput = readIfExists(
  env.API_TEST_OUTPUT_FILE || "api-test-output.txt"
);
const webOutput = readIfExists(
  env.WEB_TEST_OUTPUT_FILE || "web-test-output.txt"
);
const api = parseApiOutput(apiOutput);
const web = parseWebOutput(webOutput);
const newTests = countNewTests(env.BASE_SHA, env.HEAD_SHA || "HEAD");

const outcomes = {
  lint: env.LINT_OUTCOME,
  format: env.FORMAT_OUTCOME,
  apiTests: env.API_TESTS_OUTCOME,
  webTests: env.WEB_TESTS_OUTCOME,
};

const allPassed = Object.values(outcomes).every((o) => o === "success");

// ---- Build the markdown report ----
const lines = [];

lines.push(`# ${allPassed ? "✅" : "❌"} CI Report`);
lines.push("");
lines.push(
  allPassed
    ? "All automated checks passed."
    : "One or more automated checks failed — see below."
);
lines.push("");

lines.push("## Summary");
lines.push("");
lines.push("| Check | Status |");
lines.push("| --- | --- |");
lines.push(`| Lint | ${outcomeBadge(outcomes.lint)} |`);
lines.push(`| Format | ${outcomeBadge(outcomes.format)} |`);
lines.push(`| API tests | ${outcomeBadge(outcomes.apiTests)} |`);
lines.push(`| Web tests | ${outcomeBadge(outcomes.webTests)} |`);
lines.push("");

lines.push("## Test Results");
lines.push("");
lines.push("| Workspace | Test Files | Tests | Passed | Failed | Duration |");
lines.push("| --- | --- | --- | --- | --- | --- |");
lines.push(
  `| API | — | ${api.tests ?? "—"} | ${api.pass ?? "—"} | ${api.fail ?? "—"} | ${
    api.durationMs ? `${Math.round(api.durationMs)}ms` : "—"
  } |`
);
lines.push(
  `| Web | ${web.testFiles ? `${web.testFiles.passed}/${web.testFiles.total}` : "—"} | ${
    web.tests?.total ?? "—"
  } | ${web.tests?.passed ?? "—"} | ${web.tests?.failed ?? "—"} | ${web.duration ?? "—"} |`
);
lines.push("");

lines.push("## Coverage");
lines.push("");
lines.push("| Workspace | Lines | Branches | Functions |");
lines.push("| --- | --- | --- | --- |");
lines.push(
  `| API | ${pct(api.coverage?.lines)} | ${pct(api.coverage?.branches)} | ${pct(api.coverage?.funcs)} |`
);
lines.push(
  `| Web | ${pct(web.coverage?.lines)} | ${pct(web.coverage?.branches)} | ${pct(web.coverage?.funcs)} |`
);
lines.push("");

lines.push("## New Tests in This PR");
lines.push("");
if (newTests === null) {
  lines.push(
    "_Not available (not a pull request run, or diff could not be computed)._"
  );
} else if (newTests.rows.length === 0) {
  lines.push("No test cases were added or removed in this PR.");
} else {
  lines.push("| File | Added | Removed |");
  lines.push("| --- | --- | --- |");
  for (const row of newTests.rows) {
    lines.push(`| \`${row.file}\` | +${row.added} | -${row.removed} |`);
  }
  lines.push("");
  lines.push(
    `**Total:** +${newTests.totalAdded} / -${newTests.totalRemoved} test case(s)`
  );
}
lines.push("");

lines.push("<details><summary>Raw test output</summary>");
lines.push("");
lines.push("**API**");
lines.push("");
lines.push("```text");
lines.push(apiOutput.trim() || "(no output captured)");
lines.push("```");
lines.push("");
lines.push("**Web**");
lines.push("");
lines.push("```text");
lines.push(webOutput.trim() || "(no output captured)");
lines.push("```");
lines.push("");
lines.push("</details>");
lines.push("");

writeFileSync("pr-comment.md", lines.join("\n"));
