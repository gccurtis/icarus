import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import browserTrees from "../browser-trees.json";
import { Chip, Page } from "../components/common";
import { fileRoute, files, TREE_TITLES, type FileEntry } from "../data";
import { NotFound } from "./NotFound";

type Node = { name: string; path: string; files: FileEntry[]; children: Map<string, Node> };

const ROOTS: Record<string, string> = { routes: "src/routes", root: "src", test: "src/test" };

const rootOf = (tree: string): string => ROOTS[tree] ?? `src/lib/${tree}`;

const build = (tree: string, entries: FileEntry[]): Node => {
  const root: Node = { name: rootOf(tree), path: "", files: [], children: new Map() };
  for (const entry of entries) {
    const relative = entry.app.startsWith(`${rootOf(tree)}/`) ? entry.app.slice(rootOf(tree).length + 1) : entry.app;
    const segments = relative.split("/");
    let node = root;
    for (const segment of segments.slice(0, -1)) {
      let child = node.children.get(segment);
      if (!child) {
        child = { name: segment, path: node.path ? `${node.path}/${segment}` : segment, files: [], children: new Map() };
        node.children.set(segment, child);
      }
      node = child;
    }
    node.files.push(entry);
  }
  return root;
};

const countOf = (node: Node): number => node.files.length + [...node.children.values()].reduce((sum, child) => sum + countOf(child), 0);

const Directory = ({ node, open, toggle, depth, active, filter }: { node: Node; open: Set<string>; toggle: (path: string) => void; depth: number; active: string; filter: string }) => {
  const isOpen = filter.length > 0 || depth === 0 || open.has(node.path);
  const children = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name));
  const shown = node.files.filter((entry) => filter.length === 0 || entry.app.toLowerCase().includes(filter)).sort((a, b) => a.name.localeCompare(b.name));
  const holds = countOf(node);
  return (
    <li>
      {depth > 0 && (
        <button type="button" className="dir-name" onClick={() => toggle(node.path)} aria-expanded={isOpen}>
          <span className="chevron">{isOpen ? "▾" : "▸"}</span>
          {node.name}/ <span style={{ color: "var(--token-ink-muted)" }}>{holds}</span>
        </button>
      )}
      {isOpen && (
        <ul>
          {children.map((child) => (
            <Directory key={child.path} node={child} open={open} toggle={toggle} depth={depth + 1} active={active} filter={filter} />
          ))}
          {shown.map((entry) => (
            <li key={entry.id}>
              <Link className={`file-link ${entry.id === active ? "is-active" : ""}`} to={fileRoute(entry.id)} title={`${entry.role} · ${entry.lines} lines`}>
                {entry.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

const STORAGE = "icarus-wiki.browse";

export const Browse = () => {
  const { tree = "" } = useParams();
  const location = useLocation();
  const valid = (browserTrees.trees as string[]).includes(tree);
  const entries = useMemo(() => files.filter((entry) => entry.tree === tree), [tree]);
  const root = useMemo(() => build(tree, entries), [tree, entries]);
  const [open, setOpen] = useState<Set<string>>(() => {
    const firstLevel = new Set([...root.children.keys()]);
    if (typeof window === "undefined") return firstLevel;
    try {
      const held = JSON.parse(localStorage.getItem(`${STORAGE}.${tree}`) ?? "null");
      if (Array.isArray(held)) return new Set(held);
    } catch {
      return firstLevel;
    }
    return firstLevel;
  });
  const [filter, setFilter] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE}.${tree}`, JSON.stringify([...open]));
    } catch {
      return;
    }
  }, [open, tree]);

  if (!valid) return <NotFound />;

  const toggle = (path: string) =>
    setOpen((held) => {
      const next = new Set(held);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const everything = () => {
    const all = new Set<string>();
    const walk = (node: Node) => {
      if (node.path) all.add(node.path);
      node.children.forEach(walk);
    };
    walk(root);
    setOpen(all);
  };

  const roles = [...new Set(entries.map((entry) => entry.role))].sort();

  return (
    <Page crumbs={[{ label: "Browse" }]} title={TREE_TITLES[tree] ?? tree} lede={<code>app/{rootOf(tree)}</code>}>
      <p>
        {entries.length} files. {(tree === "routes" || tree === "root" || tree === "test") ? null : <Link to={`/trees/${tree}`}>Read about the tree →</Link>}
      </p>
      <div className="demo-row">
        <input type="search" placeholder="filter by path" value={filter} onChange={(event) => setFilter(event.target.value.toLowerCase())} aria-label="Filter files" style={{ padding: "calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2.5)", border: "1px solid var(--token-border-subtle)", borderRadius: "var(--token-radius-control)", background: "var(--token-surface-elevated)", color: "var(--token-ink-primary)", font: "inherit" }} />
        <button type="button" className="theme-toggle" onClick={everything}>
          expand all
        </button>
        <button type="button" className="theme-toggle" onClick={() => setOpen(new Set())}>
          collapse all
        </button>
      </div>
      <div className="chips">
        {roles.map((role) => (
          <Chip key={role}>
            {role} · {entries.filter((entry) => entry.role === role).length}
          </Chip>
        ))}
      </div>
      <ul className="dir">
        <Directory node={root} open={open} toggle={toggle} depth={0} active={location.pathname.startsWith("/files/") ? `app/${location.pathname.slice("/files/".length)}` : ""} filter={filter} />
      </ul>
    </Page>
  );
};
