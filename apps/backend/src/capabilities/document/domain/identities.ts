import type {
  DocumentBlock,
  DocumentRow,
  DocumentSnapshot,
  ListItem
} from "./model.js";

export type DocumentIdentityKind =
  | "style"
  | "row"
  | "block"
  | "list"
  | "list-item"
  | "table"
  | "table-row"
  | "table-column"
  | "table-cell"
  | "table-merge"
  | "rich-text-atom"
  | "rich-text-mark";

export interface DocumentIdentity {
  kind: DocumentIdentityKind;
  id: string;
}

export interface DocumentIdentityTransitions {
  added: DocumentIdentity[];
  removed: DocumentIdentity[];
}

export type DocumentIdentityLedgerState = "active" | "tombstoned";

export interface DocumentIdentityLedgerEntry extends DocumentIdentity {
  documentId: string;
  state: DocumentIdentityLedgerState;
  firstRevision: number;
  lastTransitionRevision: number;
  tombstonedRevision?: number;
}

export type DocumentIdentityReactivation =
  | "forbid"
  | "same-kind-compensation";

const compareIdentities = (
  left: DocumentIdentity,
  right: DocumentIdentity
): number => {
  if (left.id !== right.id) return left.id < right.id ? -1 : 1;
  if (left.kind !== right.kind) return left.kind < right.kind ? -1 : 1;
  return 0;
};

const identityKey = (identity: DocumentIdentity): string =>
  `${identity.id}\u0000${identity.kind}`;

/**
 * Collect every identity governed by Document's retained-history non-reuse
 * rule. References to external resources (for example Derived Output and media
 * IDs) are deliberately excluded.
 */
export const collectDocumentIdentities = (
  snapshot: DocumentSnapshot
): DocumentIdentity[] => {
  const identities: DocumentIdentity[] = snapshot.styles.styles.map((style) => ({
    kind: "style",
    id: style.id
  }));

  const collectRows = (rows: DocumentRow[]): void => {
    for (const row of rows) {
      identities.push({ kind: "row", id: row.id });
      for (const block of row.blocks) collectBlock(block);
    }
  };

  const collectListItems = (items: ListItem[]): void => {
    for (const item of items) {
      identities.push({ kind: "list-item", id: item.id });
      collectRows(item.rows);
      collectListItems(item.children);
    }
  };

  const collectBlock = (block: DocumentBlock): void => {
    identities.push({ kind: "block", id: block.id });

    if (block.kind === "text" || block.kind === "code" || block.kind === "quote") {
      for (const atom of block.content.atoms) {
        identities.push({ kind: "rich-text-atom", id: atom.id });
      }
      for (const mark of block.content.marks) {
        identities.push({ kind: "rich-text-mark", id: mark.id });
      }
      return;
    }

    if (block.kind === "callout") {
      collectRows(block.rows);
      return;
    }

    if (block.kind === "list") {
      identities.push({ kind: "list", id: block.list.id });
      collectListItems(block.list.items);
      return;
    }

    if (block.kind === "table") {
      identities.push({ kind: "table", id: block.table.id });
      for (const row of block.table.rows) {
        identities.push({ kind: "table-row", id: row.id });
      }
      for (const column of block.table.columns) {
        identities.push({ kind: "table-column", id: column.id });
      }
      for (const cell of block.table.cells) {
        identities.push({ kind: "table-cell", id: cell.id });
        collectRows(cell.rows);
      }
      for (const merge of block.table.merges) {
        identities.push({ kind: "table-merge", id: merge.id });
      }
    }
  };

  collectRows(snapshot.rows);
  return identities.sort(compareIdentities);
};

/** Compute the deterministic identity additions and removals for one mutation. */
export const computeDocumentIdentityTransitions = (
  before: DocumentSnapshot,
  after: DocumentSnapshot
): DocumentIdentityTransitions => {
  const beforeIdentities = collectDocumentIdentities(before);
  const afterIdentities = collectDocumentIdentities(after);
  const beforeKeys = new Set(beforeIdentities.map(identityKey));
  const afterKeys = new Set(afterIdentities.map(identityKey));

  return {
    added: afterIdentities.filter((identity) => !beforeKeys.has(identityKey(identity))),
    removed: beforeIdentities.filter((identity) => !afterKeys.has(identityKey(identity)))
  };
};
