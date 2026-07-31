// Name Manager types.
// projectId is implicit — it's in the runtime object and the underlying store prefix.

export type NameKind = "variable" | "function";

export interface NameEntry {
  readonly id: string;           // stable UUID — never changes
  readonly kind: NameKind;
  readonly scopeId: string;      // project-global, document id, sheet id, etc.
  readonly displayName: string;  // current user-visible name
  readonly body: string;         // formula source text — expression or lambda
  readonly revision: number;     // increments on every rename or body update; starts at 1
  readonly createdAt: string;    // ISO-8601
  readonly updatedAt: string;    // ISO-8601
  readonly deletedAt?: string;   // soft delete — present means deleted
}

export interface NameManagerSnapshot {
  readonly id: string;
  readonly scopeId: string;
  readonly entries: ReadonlyMap<string, NameEntry>;   // keyed by displayName
  readonly snapshotRevision: number;                  // max revision across entries
  readonly createdAt: string;
}

export interface SnapshotRequest {
  readonly scopeId: string;
}

export interface ResolveRequest {
  readonly scopeId: string;
  readonly displayName: string;
}

export interface NameResolution {
  readonly found: boolean;
  readonly entry?: NameEntry;
  readonly ambiguous?: boolean;
  readonly candidates?: NameEntry[];
}

export interface ListRequest {
  readonly scopeId: string;
  readonly kind?: NameKind;
}

export interface DeclareNameRequest {
  readonly scopeId: string;
  readonly kind: NameKind;
  readonly displayName: string;
  readonly body: string;
}

export interface RenameRequest {
  readonly id: string;
  readonly newDisplayName: string;
  readonly expectedRevision: number;
}

export interface UpdateBodyRequest {
  readonly id: string;
  readonly body: string;
  readonly expectedRevision: number;
}

export class StaleRevisionError extends Error {
  constructor(
    public readonly id: string,
    public readonly currentRevision: number,
    public readonly expectedRevision: number
  ) {
    super(`Stale revision for ${id}: expected ${expectedRevision}, current ${currentRevision}`);
    this.name = "StaleRevisionError";
  }
}

export class NameConflictError extends Error {
  constructor(public readonly displayName: string, public readonly scopeId: string) {
    super(`Name '${displayName}' already exists in scope '${scopeId}'`);
    this.name = "NameConflictError";
  }
}

export class NameNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Name not found: ${id}`);
    this.name = "NameNotFoundError";
  }
}
