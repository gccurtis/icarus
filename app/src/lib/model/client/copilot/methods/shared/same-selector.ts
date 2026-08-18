import type { Selector } from "$shared/types/resource-set-expression";

/**
 * Whether two selectors name the same thing.
 *
 * **Identity, not deep equality.** Two `part` selectors on one path are the same
 * selector even if the user relabelled one, so `label` is excluded — otherwise
 * `dropSelector` would fail to find what a chip is showing the moment anything
 * regenerated the label.
 *
 * Shared because the three scope writers must agree exactly. A selector is in
 * `include`, in `exclude`, or in neither — and that invariant is only as good as
 * the comparison the three of them use to decide which list it is already in.
 *
 * ` ` separates the parts because none of them may contain one, so no two
 * different selectors can produce one key.
 */
export const selectorKey = (selector: Selector): string => {
  switch (selector.kind) {
    case "project":
      return "project";
    case "resourceKind":
      return `resourceKind ${selector.resourceKind}`;
    case "resource":
      return `resource ${selector.ref.kind} ${selector.ref.id}`;
    case "part":
      return `part ${selector.ref.kind} ${selector.ref.id} ${selector.scopePath}`;
    case "web":
      return "web";
  }
};

export const sameSelector = (a: Selector, b: Selector): boolean =>
  selectorKey(a) === selectorKey(b);
