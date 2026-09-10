#!/usr/bin/env node
/**
 * The file ledger behind /app/<project>/reference/templates/changes.
 *
 *     node scripts/generate-template-reference-inventory.mjs > \
 *       src/lib/development-views/template-reference/procedures/inventory.ts
 *
 * The baseline is where this branch meets the branch it sits on rather than that
 * branch's head, so the ledger keeps measuring this work as the base moves on.
 * `work/derived-output-architecture` is that branch, because prompt blocks live
 * there; TEMPLATE_FEATURES_BASE names another, and main is the fallback.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
const lines = (value) => value.split("\n").filter(Boolean);
const physicalLines = (buffer) => {
  if (!buffer?.length) return 0;
  const text = buffer.toString("utf8");
  return text.split(/\r?\n/).length - (text.endsWith("\n") ? 1 : 0);
};

const mergeBase = (ref) => {
  try {
    return git("merge-base", "HEAD", ref).trim();
  } catch {
    return "";
  }
};

const baseline =
  process.env.TEMPLATE_FEATURES_BASE ??
  (mergeBase("work/derived-output-architecture") || mergeBase("main"));

const kindOf = (path) => {
  if (path.includes("development-views/template-reference/") || path.includes("reference/templates")) return "reference";
  if (path.includes("/test/") || path.includes(".test.") || path.includes("playwright")) return "test";
  if (path.startsWith("app/seed/")) return "fixture";
  if (path.startsWith("docs/") || path.endsWith(".md")) return "documentation";
  if (path.endsWith(".mjs") || path.endsWith("package.json") || path.endsWith("vite.config.ts")) return "configuration";
  return "production";
};

const areaOf = (path) => {
  if (path.includes("development-views/template-reference/") || path.includes("reference/templates")) return "reference";
  if (path.startsWith("app/seed/") || path.startsWith("app/test/browser/")) return "evidence";
  if (path.startsWith("docs/")) return "documentation";
  if (path.includes("/representation/") || path.includes("/model/client/workspace-state/")) return "vocabulary";
  if (path.includes("/capabilities/templates/")) return "templates";
  if (path.includes("/capabilities/resource-sets/")) return "sets";
  if (
    path.includes("/capabilities/project-resources/") ||
    path.includes("/capabilities/comments/")
  ) return "neighbours";
  if (path.includes("/categories/templates/")) return "library";
  if (path.includes("/categories/project-overview/")) return "contexts";
  if (path.includes("/categories/document-editor/") || path.includes("/categories/slide-deck-editor/")) return "editors";
  return "cross-cutting";
};

const status = new Map();
for (const row of lines(git("diff", "--name-status", "--find-renames", baseline, "--"))) {
  const [raw, ...names] = row.split("\t");
  const code = raw[0];
  const path = code === "R" || code === "C" ? names.at(-1) : names[0];
  status.set(path, code === "R" || code === "C" ? "A" : code);
}
for (const path of lines(git("ls-files", "--others", "--exclude-standard"))) status.set(path, "A");

const numstat = new Map();
for (const row of lines(git("diff", "--text", "--numstat", baseline, "--"))) {
  const [added, deleted, path] = row.split("\t");
  if (added !== "-" && deleted !== "-") numstat.set(path, { added: Number(added) || 0, deleted: Number(deleted) || 0 });
}

const records = [...status]
  .filter(([path]) => path.startsWith("app/") && !path.startsWith("app/data/") && !path.endsWith(".log"))
  .map(([path, change]) => {
    const absolute = resolve(root, path);
    const currentBuffer = change === "D" || !existsSync(absolute) ? Buffer.alloc(0) : readFileSync(absolute);
    let baseBuffer = Buffer.alloc(0);
    if (change !== "A") {
      try {
        baseBuffer = execFileSync("git", ["show", `${baseline}:${path}`], { cwd: root, encoding: "buffer" });
      } catch {
        baseBuffer = Buffer.alloc(0);
      }
    }
    const current = physicalLines(currentBuffer);
    const base = physicalLines(baseBuffer);
    let delta = numstat.get(path);
    if (!delta && change === "M") {
      const patch = git("diff", "--text", "--no-ext-diff", "--unified=0", baseline, "--", path);
      delta = {
        added: patch.split("\n").filter((line) => line.startsWith("+") && !line.startsWith("+++")).length,
        deleted: patch.split("\n").filter((line) => line.startsWith("-") && !line.startsWith("---")).length
      };
    }
    delta ??= { added: change === "A" ? current : 0, deleted: change === "D" ? base : 0 };
    return {
      path,
      status: change,
      area: areaOf(path),
      kind: kindOf(path),
      current,
      base,
      added: delta.added,
      deleted: delta.deleted
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

const encoded = records.map((record) => JSON.stringify(record)).join(",\n  ");
process.stdout.write(
  `import type { FileRecord } from "$development-views/template-reference/types";\n\n` +
    `/**\n * Generated by scripts/generate-template-reference-inventory.mjs.\n` +
    ` * Comparison: ${baseline.slice(0, 7)} (branch point) → worktree.\n */\n` +
    `export const BASELINE = "${baseline.slice(0, 7)}";\n\n` +
    `export const FILES: FileRecord[] = [\n  ${encoded}\n];\n`
);
