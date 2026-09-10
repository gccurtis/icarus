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

const kindOf = (path) => {
  if (
    path.includes("development-views/document-editor-") ||
    path.includes("routes/demo/document-editor-") ||
    path.includes("development-views/demo/components/demo-index.svelte")
  ) return "reference";
  if (path.includes("/test/") || path.includes(".test.") || path.includes("playwright")) return "test";
  if (path.includes("/seed/") || path.includes("/data/") && path.includes("fixture")) return "fixture";
  if (path.startsWith("docs/") || path.startsWith("wiki/") || path.endsWith(".md")) return "documentation";
  if (
    path === ".gitignore" ||
    path.endsWith("package.json") ||
    path.endsWith("pnpm-lock.yaml") ||
    path.endsWith("vite.config.ts") ||
    path.endsWith("playwright.config.ts") ||
    path.includes("/configuration/") ||
    path === "app/scripts/generate-document-editor-reference-inventory.mjs"
  ) return "configuration";
  return "production";
};

const areaOf = (path) => {
  if (
    path.includes("development-views/document-editor-") ||
    path.includes("routes/demo/document-editor-") ||
    path.includes("development-views/demo/components/demo-index.svelte") ||
    path.startsWith("docs/artifacts/") ||
    path.startsWith("app/test/browser/document-editor") ||
    path.includes("playwright.config") ||
    path.startsWith("app/seed/") ||
    path.includes("generate-document-editor-reference-inventory")
  ) return "evidence";
  if (path.includes("/document-editor/context/") || path.includes("/surfaces/context/")) return "context";
  if (
    path.includes("/document-editor/inspector/") ||
    path.includes("/surfaces/inspector/") ||
    path.includes("/app-views/general/comment/") ||
    path.includes("/components/authored/panel/")
  ) return "inspector";
  if (
    path.includes("/app-views/categories/document-editor/content/") ||
    path.includes("/app-views/categories/document-editor/procedures/")
  ) return "content";
  if (
    path.includes("/model/client/document-runtimes/") ||
    path.includes("/model/client/workspace-state/") ||
    path.includes("/runtime/client/")
  ) return "runtime";
  if (
    path.includes("/representation/") ||
    path.includes("/capabilities/document/")
  ) return "backend";
  return "cross-cutting";
};

const status = new Map();
for (const row of lines(git("diff", "--name-status", "--find-renames", "main", "--"))) {
  const [raw, ...names] = row.split("\t");
  const code = raw[0];
  const path = code === "R" || code === "C" ? names.at(-1) : names[0];
  status.set(path, code === "R" || code === "C" ? "A" : code);
}
for (const path of lines(git("ls-files", "--others", "--exclude-standard"))) status.set(path, "A");

const numstat = new Map();
for (const row of lines(git("diff", "--text", "--numstat", "main", "--"))) {
  const [added, deleted, path] = row.split("\t");
  if (added !== "-" && deleted !== "-") numstat.set(path, { added: Number(added) || 0, deleted: Number(deleted) || 0 });
}

const records = [...status].map(([path, change]) => {
  const absolute = resolve(root, path);
  const currentBuffer = change === "D" || !existsSync(absolute) ? Buffer.alloc(0) : readFileSync(absolute);
  let baseBuffer = Buffer.alloc(0);
  if (change !== "A") {
    try {
      baseBuffer = execFileSync("git", ["show", `main:${path}`], { cwd: root, encoding: "buffer" });
    } catch {
      baseBuffer = Buffer.alloc(0);
    }
  }
  const current = physicalLines(currentBuffer);
  const base = physicalLines(baseBuffer);
  let delta = numstat.get(path);
  if (!delta && change === "M") {
    const patch = git("diff", "--text", "--no-ext-diff", "--unified=0", "main", "--", path);
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
    deleted: delta.deleted,
    binary: currentBuffer.includes(0) || baseBuffer.includes(0)
  };
}).sort((a, b) => a.path.localeCompare(b.path));

const encoded = records.map((record) => JSON.stringify(record)).join(",\n  ");
process.stdout.write(`import type { FileRecord } from "$development-views/document-editor-reference/types";\n\n/**\n * Generated by scripts/generate-document-editor-reference-inventory.mjs.\n * Comparison: main → worktree at review time.\n */\nexport const FILES: FileRecord[] = [\n  ${encoded}\n];\n`);
