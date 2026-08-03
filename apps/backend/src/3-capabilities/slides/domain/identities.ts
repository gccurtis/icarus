import type { DeckSnapshot, SlideElement, SlideTextSource } from "./model.js";
import { allContainers } from "./elements.js";

export type SlideIdentityKind =
  | "style"
  | "token"
  | "master"
  | "layout"
  | "slot"
  | "slide"
  | "element"
  | "table"
  | "table-row"
  | "table-column"
  | "table-cell"
  | "table-merge"
  | "chart-label"
  | "rich-text-atom"
  | "rich-text-mark";

export interface SlideIdentity {
  kind: SlideIdentityKind;
  id: string;
}

export interface SlideIdentityTransitions {
  added: SlideIdentity[];
  removed: SlideIdentity[];
}

export type SlideIdentityLedgerState = "active" | "tombstoned";

export interface SlideIdentityLedgerEntry extends SlideIdentity {
  deckId: string;
  state: SlideIdentityLedgerState;
  firstRevision: number;
  lastTransitionRevision: number;
  tombstonedRevision?: number;
}

export type SlideIdentityReactivation = "forbid" | "same-kind-compensation";

const compareIdentities = (left: SlideIdentity, right: SlideIdentity): number => {
  if (left.id !== right.id) return left.id < right.id ? -1 : 1;
  if (left.kind !== right.kind) return left.kind < right.kind ? -1 : 1;
  return 0;
};

const identityKey = (identity: SlideIdentity): string =>
  `${identity.id}\u0000${identity.kind}`;

/**
 * Collect every identity governed by the retained-history non-reuse rule.
 * References to external resources — Derived Output IDs and media file IDs —
 * are deliberately excluded, because Slides does not own their lifecycle.
 *
 * A `prompt` text source contributes no Rich Text identities: it holds a
 * reference, and the generated text never enters the snapshot.
 */
export const collectSlideIdentities = (snapshot: DeckSnapshot): SlideIdentity[] => {
  const identities: SlideIdentity[] = [];

  for (const style of snapshot.styles.styles) {
    identities.push({ kind: "style", id: style.id });
  }
  for (const tokenId of Object.keys(snapshot.theme.tokens)) {
    identities.push({ kind: "token", id: tokenId });
  }
  for (const masterId of Object.keys(snapshot.masters)) {
    identities.push({ kind: "master", id: masterId });
  }
  for (const layoutId of Object.keys(snapshot.layouts)) {
    identities.push({ kind: "layout", id: layoutId });
    for (const slotId of Object.keys(snapshot.layouts[layoutId].slots)) {
      identities.push({ kind: "slot", id: slotId });
    }
  }
  for (const slideId of Object.keys(snapshot.slides)) {
    identities.push({ kind: "slide", id: slideId });
  }

  const collectTextSource = (source: SlideTextSource): void => {
    if (source.kind !== "rich") return;
    for (const atom of source.content.atoms) {
      identities.push({ kind: "rich-text-atom", id: atom.id });
    }
    for (const mark of source.content.marks) {
      identities.push({ kind: "rich-text-mark", id: mark.id });
    }
  };

  const collectElement = (element: SlideElement): void => {
    identities.push({ kind: "element", id: element.id });

    if (element.kind === "text") {
      collectTextSource(element.body);
      return;
    }

    if (element.kind === "table") {
      identities.push({ kind: "table", id: element.table.id });
      for (const row of element.table.rows) {
        identities.push({ kind: "table-row", id: row.id });
      }
      for (const column of element.table.columns) {
        identities.push({ kind: "table-column", id: column.id });
      }
      for (const cell of element.table.cells) {
        identities.push({ kind: "table-cell", id: cell.id });
        collectTextSource(cell.body);
      }
      for (const merge of element.table.merges) {
        identities.push({ kind: "table-merge", id: merge.id });
      }
      return;
    }

    if (element.kind === "chart") {
      for (const label of element.chart.labels) {
        identities.push({ kind: "chart-label", id: label.id });
        for (const atom of label.content.atoms) {
          identities.push({ kind: "rich-text-atom", id: atom.id });
        }
        for (const mark of label.content.marks) {
          identities.push({ kind: "rich-text-mark", id: mark.id });
        }
      }
    }
  };

  for (const container of allContainers(snapshot)) {
    for (const elementId of Object.keys(container.elements)) {
      collectElement(container.elements[elementId]);
    }
  }
  for (const slideId of Object.keys(snapshot.slides)) {
    collectTextSource(snapshot.slides[slideId].notes);
  }

  return identities.sort(compareIdentities);
};

/** Compute the deterministic identity additions and removals for one mutation. */
export const computeSlideIdentityTransitions = (
  before: DeckSnapshot,
  after: DeckSnapshot
): SlideIdentityTransitions => {
  const beforeIdentities = collectSlideIdentities(before);
  const afterIdentities = collectSlideIdentities(after);
  const beforeKeys = new Set(beforeIdentities.map(identityKey));
  const afterKeys = new Set(afterIdentities.map(identityKey));

  return {
    added: afterIdentities.filter((identity) => !beforeKeys.has(identityKey(identity))),
    removed: beforeIdentities.filter((identity) => !afterKeys.has(identityKey(identity)))
  };
};
