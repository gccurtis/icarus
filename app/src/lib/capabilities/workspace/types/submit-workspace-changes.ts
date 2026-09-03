import type { WorkspaceOp } from "$representation/data/types/workspace/op";

/**
 * A change set, as the client can state one: the ops, and the revision they
 * bridge from. A workspace does not lag — the client always holds the most
 * recent state it has seen — so the base is a claim the server can check.
 *
 * No snapshot travels. The server applies the ops to the leader itself, which is
 * what makes merging a change set onto newer state possible at all.
 */
export type WorkspaceChangeSetInput = {
  readonly baseRevision: number;
  readonly ops: readonly WorkspaceOp[];
};

export type SubmitWorkspaceChangesInput = {
  readonly changeSet: WorkspaceChangeSetInput;
};

/**
 * `conflict` — the change set reaches ground that has moved since its base.
 * `unresolved` — an op named a tab the workspace no longer holds.
 */
export type WorkspaceRefusal = "conflict" | "unresolved";

export type SubmitWorkspaceChangesResult =
  | { readonly accepted: true; readonly revision: number; readonly merged: boolean }
  | {
      readonly accepted: false;
      readonly reason: WorkspaceRefusal;
      readonly revision: number;
      readonly detail: string;
    };
