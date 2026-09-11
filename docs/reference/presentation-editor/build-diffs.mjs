import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const baseline = process.env.SLIDE_EDITOR_BASE ?? "main";

const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const GROUPS = [
  { key: "model", title: "The element model and the applier", match: (p) => p.startsWith("app/src/lib/representation/data/types/presentations/") || p.startsWith("app/src/lib/representation/data/behavior/presentations/") || p.startsWith("app/src/lib/representation/data/types/content/") || p.startsWith("app/src/lib/representation/data/behavior/content/") || p.startsWith("app/src/lib/capabilities/presentation/") || p.startsWith("app/src/lib/capabilities/templates/") || p.startsWith("app/seed/") },
  { key: "workspace", title: "The workspace knows the presentation's views", match: (p) => p.startsWith("app/src/lib/representation/data/types/workspace/") || p.startsWith("app/src/lib/representation/data/behavior/workspace/") || p.startsWith("app/src/lib/surfaces/context/") },
  { key: "runtime", title: "The runtime", match: (p) => p.startsWith("app/src/lib/model/") },
  { key: "renderer", title: "The renderer: from Konva to a DOM surface", match: (p) => p.startsWith("app/src/lib/components/authored/slide-surface/") },
  { key: "vocabulary", title: "The panel vocabulary", match: (p) => p.startsWith("app/src/lib/components/authored/panel/") },
  { key: "procedures", title: "The editor's procedures", match: (p) => p.startsWith("app/src/lib/app-views/categories/presentation-editor/procedures/") },
  { key: "content", title: "The content surface", match: (p) => p.startsWith("app/src/lib/app-views/categories/presentation-editor/content/") },
  { key: "context", title: "The context panels", match: (p) => p.startsWith("app/src/lib/app-views/categories/presentation-editor/context/") },
  { key: "inspector", title: "The inspector lenses and their shared sections", match: (p) => p.startsWith("app/src/lib/app-views/categories/presentation-editor/inspector/") || p.startsWith("app/src/lib/app-views/categories/presentation-editor/components/") },
  { key: "comments", title: "Comments, end to end", match: (p) => p.startsWith("app/src/lib/capabilities/comments/") || p.startsWith("app/src/lib/app-views/general/comment/") }
];

const OVERRIDES = {
  "app/src/lib/app-views/categories/presentation-editor/procedures/tokens.ts": "renderer",
  "app/test/browser/presentation-editor.spec.ts": "content",
  "app/scripts/test/mutations.mjs": "workspace",
  "app/package.json": "renderer",
  "app/pnpm-lock.yaml": "renderer",
  "app/src/lib/model/client/workspace-state/methods/shared/shared.md": "workspace"
};

const groupOf = (path) => OVERRIDES[path] ?? GROUPS.find((group) => group.match(path))?.key ?? "other";

const titleOf = (key) => GROUPS.find((group) => group.key === key)?.title ?? "Other";

const STATUS = { M: "changed", D: "deleted", "??": "new", A: "new" };

const changed = git(["diff", "--name-status", baseline, "--", "app/"])
  .stdout.split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => {
    const [code, path] = line.split("\t");
    return { code, path };
  });

const untracked = git(["status", "--porcelain", "--untracked-files=all", "--", "app/"])
  .stdout.split("\n")
  .filter((line) => line.startsWith("?? "))
  .map((line) => ({ code: "??", path: line.slice(3).trim() }));

const files = [...new Map([...changed, ...untracked].map((file) => [file.path, file])).values()]
  .filter(({ path }) => !path.startsWith("app/data/") && !path.endsWith(".log"))
  .sort((a, b) => a.path.localeCompare(b.path));

const diffOf = ({ code, path }) => {
  if (code === "??") return git(["diff", "--no-index", "--", "/dev/null", path]).stdout;
  return git(["diff", baseline, "--", path]).stdout;
};

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const classOf = (line) => {
  if (line.startsWith("@@")) return "hunk";
  if (line.startsWith("+")) return "add";
  if (line.startsWith("-")) return "del";
  return "ctx";
};

const slugOf = (path) => path.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");

const shown = (path) => path.replace(/^app\//, "");

const rendered = files.map((file) => {
  const diff = diffOf(file);
  const lines = diff.split("\n");
  const added = lines.filter((line) => line.startsWith("+") && !line.startsWith("+++")).length;
  const removed = lines.filter((line) => line.startsWith("-") && !line.startsWith("---")).length;
  const body = lines
    .filter((line) => !/^(diff |index |new file|deleted file|--- |\+\+\+ )/.test(line))
    .map((line) => `<span class="${classOf(line)}">${escape(line)}</span>`)
    .join("");
  return { ...file, added, removed, slug: slugOf(file.path), group: groupOf(file.path), html: body };
});

const byPath = new Map(rendered.map((file) => [file.path, file]));

const findFile = (wanted) => byPath.get(wanted) ?? byPath.get(`app/${wanted}`);

const stat = (file) =>
  `<span class="stat"><span class="plus">+${file.added}</span> <span class="minus">−${file.removed}</span></span>`;

const badge = (file) => `<span class="badge ${STATUS[file.code] ?? "changed"}">${STATUS[file.code] ?? file.code}</span>`;

const detailsOf = (file, seen) => {
  if (seen.has(file.path)) {
    return `<p class="seen">${badge(file)} <code>${escape(shown(file.path))}</code> — its diff is <a href="#file-${file.slug}">shown above</a>.</p>`;
  }
  seen.add(file.path);
  return `<details class="change" id="file-${file.slug}">
  <summary>${badge(file)}<code>${escape(shown(file.path))}</code>${stat(file)}</summary>
  <pre class="diff"><code class="rows">${file.html}</code></pre>
</details>`;
};

const filesTable = (argument, pageName) => {
  const keys = argument === undefined ? undefined : new Set(argument.split(",").map((key) => key.trim()));
  const chosen = rendered.filter((file) => keys === undefined || keys.has(file.group));
  const onChanges = pageName === "04-changes.html";
  const rows = chosen
    .map((file) => {
      const target = onChanges ? `#file-${file.slug}` : `04-changes.html#file-${file.slug}`;
      return `<tr><td>${badge(file)}</td><td><a href="${target}"><code>${escape(shown(file.path))}</code></a></td><td class="num">+${file.added}</td><td class="num">−${file.removed}</td><td><a href="${onChanges ? "" : "04-changes.html"}#group-${file.group}">${titleOf(file.group)}</a></td></tr>`;
    })
    .join("\n");
  return `<div class="scroll"><table class="files"><thead><tr><th></th><th>File</th><th>+</th><th>−</th><th>Systematic change</th></tr></thead><tbody>\n${rows}\n</tbody></table></div>`;
};

const summary = () => {
  const created = rendered.filter((file) => file.code === "??" || file.code === "A").length;
  const deleted = rendered.filter((file) => file.code === "D").length;
  const changed = rendered.filter((file) => file.code === "M").length;
  const added = rendered.reduce((sum, file) => sum + file.added, 0);
  const removed = rendered.reduce((sum, file) => sum + file.removed, 0);
  return `${rendered.length} files against <code>${escape(baseline)}</code> — ${created} created, ${changed} changed, ${deleted} deleted — <span class="plus">+${added}</span> / <span class="minus">−${removed}</span> lines, measured from committed and working-tree changes when this page was built.`;
};

const replaceBetween = (source, begin, end, make) => {
  const pattern = new RegExp(`(<!-- ${begin}(?: ([^>]+?))? -->)([\\s\\S]*?)(<!-- ${end} -->)`, "g");
  return source.replace(pattern, (_, open, argument, __, close) => `${open}\n${make(argument?.trim())}\n${close}`);
};

const missing = new Map();

for (const name of readdirSync(here)) {
  if (!name.endsWith(".html")) continue;
  const path = join(here, name);
  const seen = new Set();
  let source = readFileSync(path, "utf8");
  source = replaceBetween(source, "files:begin", "files:end", (argument) => filesTable(argument, name));
  source = replaceBetween(source, "summary:begin", "summary:end", () => summary());
  source = replaceBetween(source, "diff:begin", "diff:end", (wanted) => {
    const file = findFile(wanted);
    if (file === undefined) {
      missing.set(name, [...(missing.get(name) ?? []), wanted]);
      return `<p class="missing">No change recorded for <code>${escape(wanted ?? "")}</code>.</p>`;
    }
    return detailsOf(file, seen);
  });
  source = replaceBetween(source, "group:begin", "group:end", (key) => {
    const rest = rendered.filter((file) => file.group === key && !seen.has(file.path));
    if (rest.length === 0) return "";
    return `<h4>Other files in this change</h4>\n${rest.map((file) => detailsOf(file, seen)).join("\n")}`;
  });
  writeFileSync(path, source);
  if (name === "04-changes.html") {
    const unplaced = rendered.filter((file) => !seen.has(file.path));
    if (unplaced.length > 0) console.log(`Not placed on 04-changes.html: ${unplaced.map((file) => file.path).join(", ")}`);
  }
}

for (const [page, wanted] of missing) console.log(`${page}: no change recorded for ${wanted.join(", ")}`);

console.log(summary().replace(/<[^>]+>/g, ""));
