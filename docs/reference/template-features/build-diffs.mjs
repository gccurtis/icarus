import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const git = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const mergeBase = (ref) => git(["merge-base", "HEAD", ref]).stdout.trim();
const branchPoint = mergeBase("work/derived-output-architecture") || mergeBase("main");
const baseline = process.env.TEMPLATE_FEATURES_BASE ?? (branchPoint === "" ? "main" : branchPoint);

const GROUPS = [
  { key: "representation", title: "The vocabulary: one table, five functions, one field", match: (p) => p.startsWith("app/src/lib/representation/") || p.startsWith("app/src/lib/model/client/workspace-state/") },
  { key: "templates", title: "The templates capability", match: (p) => p.startsWith("app/src/lib/capabilities/templates/") },
  { key: "resource-sets", title: "The resource-sets capability", match: (p) => p.startsWith("app/src/lib/capabilities/resource-sets/") },
  {
    key: "project-resources",
    title: "What the other capabilities changed",
    match: (p) =>
      p.startsWith("app/src/lib/capabilities/project-resources/") ||
      p.startsWith("app/src/lib/capabilities/comments/") ||
      p.startsWith("app/src/lib/capabilities/store/")
  },
  { key: "library", title: "The template library, editor door, and inspector", match: (p) => p.startsWith("app/src/lib/app-views/categories/templates/") },
  { key: "document", title: "The document editor's Templates panel", match: (p) => p.startsWith("app/src/lib/app-views/categories/document-editor/") },
  { key: "presentation", title: "The presentation editor's Templates panel", match: (p) => p.startsWith("app/src/lib/app-views/categories/presentation-editor/") },
  { key: "contexts", title: "Project Overview's Contexts panel", match: (p) => p.startsWith("app/src/lib/app-views/categories/project-overview/") },
  { key: "seed", title: "The seeded one-slide template", match: (p) => p.startsWith("app/seed/") },
  { key: "browser", title: "Browser evidence", match: (p) => p.startsWith("app/test/browser/") },
  {
    key: "other",
    title: "The reference pages, and the one shared component they moved",
    match: (p) =>
      p.startsWith("app/src/lib/development-views/") ||
      p.startsWith("app/src/routes/") ||
      p.startsWith("app/scripts/") ||
      p.startsWith("app/src/lib/components/")
  }
];

const groupOf = (path) => GROUPS.find((group) => group.match(path))?.key ?? "other";

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
  const kept = lines.filter((line) => !/^(diff |index |new file|deleted file|--- |\+\+\+ )/.test(line));
  const body = kept.map((line) => `<span class="${classOf(line)}">${escape(line)}</span>`).join("");
  return { ...file, added, removed, slug: slugOf(file.path), group: groupOf(file.path), html: body, text: kept.join("\n").trimEnd() };
});

const docsChanged = git(["diff", "--numstat", baseline, "--", "docs/"])
  .stdout.split("\n")
  .filter((line) => line.trim() !== "")
  .map((line) => {
    const [added, removed, path] = line.split("\t");
    return { code: "M", path, added: Number(added) || 0, removed: Number(removed) || 0 };
  });

const docsUntracked = git(["status", "--porcelain", "--untracked-files=all", "--", "docs/"])
  .stdout.split("\n")
  .filter((line) => line.startsWith("?? "))
  .map((line) => {
    const path = line.slice(3).trim();
    return { code: "??", path, added: readFileSync(resolve(root, path), "utf8").split("\n").length, removed: 0 };
  });

const docsFiles = [...new Map([...docsChanged, ...docsUntracked].map((file) => [file.path, file])).values()].sort((a, b) =>
  a.path.localeCompare(b.path)
);

const docsTable = () => {
  const rows = docsFiles
    .map(
      (file) =>
        `<tr><td>${badge(file)}</td><td><code>${escape(file.path)}</code></td><td class="num">+${file.added}</td><td class="num">−${file.removed}</td></tr>`
    )
    .join("\n");
  return `<div class="scroll"><table class="files"><thead><tr><th></th><th>File</th><th>+</th><th>−</th></tr></thead><tbody>\n${rows}\n</tbody></table></div>`;
};

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

const CHANGES_PAGE = "05-changes.html";

const filesTable = (argument, pageName) => {
  const keys = argument === undefined ? undefined : new Set(argument.split(",").map((key) => key.trim()));
  const chosen = rendered.filter((file) => keys === undefined || keys.has(file.group));
  const onChanges = pageName === CHANGES_PAGE;
  const rows = chosen
    .map((file) => {
      const target = onChanges ? `#file-${file.slug}` : `${CHANGES_PAGE}#file-${file.slug}`;
      return `<tr><td>${badge(file)}</td><td><a href="${target}"><code>${escape(shown(file.path))}</code></a></td><td class="num">+${file.added}</td><td class="num">−${file.removed}</td><td><a href="${onChanges ? "" : CHANGES_PAGE}#group-${file.group}">${titleOf(file.group)}</a></td></tr>`;
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
  return `${rendered.length} files under <code>app/</code> against <code>${escape(baseline.slice(0, 7))}</code>, the commit this branch sits on — ${created} created, ${changed} changed, ${deleted} deleted — <span class="plus">+${added}</span> / <span class="minus">−${removed}</span> lines, measured from committed and working-tree changes when this page was built.`;
};

const replaceBetween = (source, begin, end, make) => {
  const pattern = new RegExp(`(<!-- ${begin}(?: ([^>]+?))? -->)([\\s\\S]*?)(<!-- ${end} -->)`, "g");
  return source.replace(pattern, (_, open, argument, __, close) => `${open}\n${make(argument?.trim())}\n${close}`);
};

const missing = new Map();

const mirror = resolve(root, "docs/artifacts/template-features-changes");
const pages = [
  ...readdirSync(here).filter((name) => name.endsWith(".html")).map((name) => join(here, name)),
  ...(existsSync(mirror)
    ? readdirSync(mirror).filter((name) => name.endsWith(".html")).map((name) => join(mirror, name))
    : [])
];

for (const path of pages) {
  const name = path.startsWith(mirror) ? CHANGES_PAGE : path.slice(here.length + 1);
  const seen = new Set();
  let source = readFileSync(path, "utf8");
  source = replaceBetween(source, "files:begin", "files:end", (argument) => filesTable(argument, name));
  source = replaceBetween(source, "summary:begin", "summary:end", () => summary());
  source = replaceBetween(source, "docs:begin", "docs:end", () => docsTable());
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
    return `<h4>Every file in this change</h4>\n${rest.map((file) => detailsOf(file, seen)).join("\n")}`;
  });
  writeFileSync(path, source);
  if (name === CHANGES_PAGE) {
    const unplaced = rendered.filter((file) => !seen.has(file.path));
    if (unplaced.length > 0) console.log(`Not placed on ${CHANGES_PAGE}: ${unplaced.map((file) => file.path).join(", ")}`);
  }
}

if (existsSync(mirror)) {
  const fence = "~~~~";
  const plain = (html) => html.replace(/<[^>]+>/g, "");
  const status = (file) => STATUS[file.code] ?? file.code;
  const lines = [
    "# Template Features Change Set",
    "",
    plain(summary()),
    "",
    "| Status | File | + | − | Systematic change |",
    "| --- | --- | --- | --- | --- |",
    ...rendered.map((file) => `| ${status(file)} | \`${shown(file.path)}\` | +${file.added} | −${file.removed} | ${titleOf(file.group)} |`),
    "",
    "## Outside app/",
    "",
    "| Status | File | + | − |",
    "| --- | --- | --- | --- |",
    ...docsFiles.map((file) => `| ${status(file)} | \`${file.path}\` | +${file.added} | −${file.removed} |`),
    ""
  ];
  for (const group of GROUPS) {
    const members = rendered.filter((file) => file.group === group.key);
    if (members.length === 0) continue;
    lines.push(`## ${group.title}`, "");
    for (const file of members) {
      lines.push(`### ${status(file)} · \`${shown(file.path)}\` (+${file.added} / −${file.removed})`, "", `${fence}diff`, file.text, fence, "");
    }
  }
  writeFileSync(join(mirror, "index.md"), `${lines.join("\n")}\n`);
}

for (const [page, wanted] of missing) console.log(`${page}: no change recorded for ${wanted.join(", ")}`);

console.log(summary().replace(/<[^>]+>/g, ""));
