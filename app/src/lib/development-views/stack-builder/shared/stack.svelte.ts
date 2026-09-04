import { getContext, setContext } from "svelte";

import {
  describeById,
  findById,
  insertInto,
  moveInto,
  removeById,
  renameById
} from "$development-views/stack-builder/procedures/manifest";
import type { CatalogueEntry, StackNode } from "$development-views/stack-builder/types";

export type Stack = ReturnType<typeof createStack>;

const KEY = Symbol("stack-builder-stack");

export const createStack = (entries: CatalogueEntry[]) => {
  let nodes = $state<StackNode[]>([]);
  let selectedId = $state("");
  let title = $state("Untitled stack");
  let minted = 0;

  const mint = (): string => {
    minted += 1;
    return `n${minted}`;
  };

  return {
    entries,

    get nodes(): StackNode[] {
      return nodes;
    },

    get title(): string {
      return title;
    },

    set title(next: string) {
      title = next;
    },

    get selectedId(): string {
      return selectedId;
    },

    get selected(): StackNode | undefined {
      return findById(nodes, selectedId);
    },

    select(id: string): void {
      selectedId = id;
    },

    add(entryId: string, parentId: string | null = null, at = Number.MAX_SAFE_INTEGER): void {
      const entry = entries.find((found) => found.id === entryId);
      if (!entry) return;
      const node: StackNode = {
        kind: "component",
        id: mint(),
        source: entry.source,
        name: entry.name,
        path: entry.path,
        description: ""
      };
      nodes = insertInto(nodes, parentId, node, at);
      selectedId = node.id;
    },

    addCustom(name: string, parentId: string | null = null): void {
      const node: StackNode = { kind: "custom", id: mint(), name, description: "" };
      nodes = insertInto(nodes, parentId, node, Number.MAX_SAFE_INTEGER);
      selectedId = node.id;
    },

    addSubstack(name: string, parentId: string | null = null): void {
      const node: StackNode = {
        kind: "substack",
        id: mint(),
        name,
        description: "",
        children: []
      };
      nodes = insertInto(nodes, parentId, node, Number.MAX_SAFE_INTEGER);
      selectedId = node.id;
    },

    remove(id: string): void {
      nodes = removeById(nodes, id);
      if (!findById(nodes, selectedId)) selectedId = nodes[0]?.id ?? "";
    },

    move(id: string, parentId: string | null, at: number): void {
      nodes = moveInto(nodes, id, parentId, at);
    },

    describe(id: string, description: string): void {
      nodes = describeById(nodes, id, description);
    },

    rename(id: string, name: string): void {
      nodes = renameById(nodes, id, name);
    },

    load(next: { title: string; nodes: StackNode[] }): void {
      title = next.title;
      nodes = next.nodes;
      selectedId = next.nodes[0]?.id ?? "";
      for (const node of next.nodes) {
        const seen = Number(node.id.replace(/^n/, ""));
        if (Number.isFinite(seen) && seen > minted) minted = seen;
      }
    }
  };
};

export const provideStack = (stack: Stack): void => {
  setContext(KEY, stack);
};

export const stackOf = (): Stack => getContext<Stack>(KEY);
