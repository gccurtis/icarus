import type { ComponentSource, StackNode } from "$development-views/stack-builder/types";

export const insertAt = (nodes: StackNode[], node: StackNode, at: number): StackNode[] => {
  const index = Math.max(0, Math.min(at, nodes.length));
  return [...nodes.slice(0, index), node, ...nodes.slice(index)];
};

export const findById = (nodes: StackNode[], id: string): StackNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.kind === "substack") {
      const inside = findById(node.children, id);
      if (inside) return inside;
    }
  }
  return undefined;
};

export const removeById = (nodes: StackNode[], id: string): StackNode[] => {
  if (!findById(nodes, id)) return nodes;
  return nodes
    .filter((node) => node.id !== id)
    .map((node) =>
      node.kind === "substack" ? { ...node, children: removeById(node.children, id) } : node
    );
};

export const describeById = (nodes: StackNode[], id: string, description: string): StackNode[] =>
  nodes.map((node) => {
    if (node.id === id) return { ...node, description };
    if (node.kind === "substack") {
      return { ...node, children: describeById(node.children, id, description) };
    }
    return node;
  });

export const renameById = (nodes: StackNode[], id: string, name: string): StackNode[] =>
  nodes.map((node) => {
    if (node.id === id) return { ...node, name };
    if (node.kind === "substack") return { ...node, children: renameById(node.children, id, name) };
    return node;
  });

export const insertInto = (
  nodes: StackNode[],
  parentId: string | null,
  node: StackNode,
  at: number
): StackNode[] => {
  if (parentId === null) return insertAt(nodes, node, at);

  return nodes.map((held) => {
    if (held.kind !== "substack") return held;
    if (held.id === parentId) return { ...held, children: insertAt(held.children, node, at) };
    return { ...held, children: insertInto(held.children, parentId, node, at) };
  });
};

export const isDescendant = (nodes: StackNode[], id: string, ofId: string): boolean => {
  const held = findById(nodes, ofId);
  if (!held || held.kind !== "substack") return false;
  return findById(held.children, id) !== undefined;
};

export const moveInto = (
  nodes: StackNode[],
  id: string,
  parentId: string | null,
  at: number
): StackNode[] => {
  if (id === parentId) return nodes;
  if (parentId !== null && isDescendant(nodes, parentId, id)) return nodes;

  const node = findById(nodes, id);
  if (!node) return nodes;
  if (parentId === null && nodes[Math.max(0, Math.min(at, nodes.length))]?.id === id) return nodes;

  return insertInto(removeById(nodes, id), parentId, node, at);
};

export const moveTo = (nodes: StackNode[], id: string, at: number): StackNode[] =>
  moveInto(nodes, id, null, at);

export const componentSources = (nodes: StackNode[]): ComponentSource[] => {
  const seen = new Set<string>();
  const found: ComponentSource[] = [];

  const walk = (held: StackNode[]): void => {
    for (const node of held) {
      if (node.kind === "substack") {
        walk(node.children);
        continue;
      }
      if (node.kind !== "component" || seen.has(node.path)) continue;
      seen.add(node.path);
      found.push({ name: node.name, path: node.path });
    }
  };

  walk(nodes);
  return found;
};
