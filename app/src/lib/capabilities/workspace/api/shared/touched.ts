import type { WorkspaceOp } from "$representation/data/types/workspace/op";

/**
 * What a change set reaches, as scopes two sets can be compared on.
 *
 * `tabs` is the list itself — what exists and in what order. `active` is which
 * one is in front. `tab:<id>` is one tab's own view. Nothing finer: two people
 * resizing one tab's panels are in conflict whichever field each of them moved,
 * and pretending otherwise would merge one drag into the middle of another.
 */
export const scopesOf = (op: WorkspaceOp): readonly string[] => {
  switch (op.op) {
    case "open":
    case "close":
      return ["tabs", `tab:${op.tab}`];

    case "activate":
      return ["active"];

    case "land":
    case "context":
    case "inspect":
    case "resize":
    case "zoom":
      return [`tab:${op.tab}`];
  }
};

export const touched = (ops: readonly WorkspaceOp[]): ReadonlySet<string> =>
  new Set(ops.flatMap(scopesOf));

export const overlap = (
  left: ReadonlySet<string>,
  right: ReadonlySet<string>
): readonly string[] => [...left].filter((scope) => right.has(scope));
