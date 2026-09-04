import type { CatalogueEntry } from "$development-views/stack-builder/types";

export const VENDORED: readonly { name: string; reason: string }[] = [
  { name: "accordion", reason: "a disclosure list; PanelBranch is a tree node, not this" },
  { name: "checkbox", reason: "PanelToggle is a switch, PanelMarks is independent marks" },
  { name: "pagination", reason: "nothing in either family pages a list" },
  { name: "separator", reason: "real structure in a stack" },
  { name: "tabs", reason: "no authored word at all" },
  { name: "toggle", reason: "a pressed state, distinct from a switch" }
];

const familyOf = (key: string): string => key.split("/").slice(-2)[0] ?? "";

const trimmed = (key: string): string => key.replace(/^\//, "");

export const catalogueFrom = (
  indexes: Record<string, Record<string, unknown>>,
  files: Record<string, unknown>
): CatalogueEntry[] => {
  const pathOf = new Map<unknown, string>();
  for (const [key, value] of Object.entries(files)) {
    if (value !== undefined && value !== null && !pathOf.has(value)) pathOf.set(value, trimmed(key));
  }

  const authored: CatalogueEntry[] = [];
  const claimed = new Set<string>();

  for (const [key, module] of Object.entries(indexes)) {
    const family = familyOf(key);
    for (const name of Object.keys(module).sort()) {
      const path = pathOf.get(module[name]);
      if (!path || claimed.has(path)) continue;
      claimed.add(path);
      authored.push({ id: `authored/${name}`, source: "authored", name, family, path, reason: "" });
    }
  }

  authored.sort((a, b) => a.name.localeCompare(b.name));

  const vendored = VENDORED.map(({ name, reason }) => ({
    id: `vendored/${name}`,
    source: "vendored" as const,
    name,
    family: "vendored",
    path: `src/lib/components/vendored/${name}/index.ts`,
    reason
  }));

  return [...authored, ...vendored];
};
