import type { Database as DatabaseConnection } from "better-sqlite3";

export type ResourceHistoryRecordType = "snapshot" | "deleted";

export interface ResourceHistoryRecord<TSnapshot = unknown> {
  readonly resourceKind: string;
  readonly resourceId: string;
  readonly revision: number;
  readonly recordType: ResourceHistoryRecordType;
  readonly snapshot?: TSnapshot;
  readonly recordedAt: string;
}

interface HistoryRow {
  resource_kind: string;
  resource_id: string;
  revision: number;
  record_type: ResourceHistoryRecordType;
  snapshot_json: string | null;
  recorded_at: string;
}

export class ResourceNotDeletedError extends Error {
  constructor(
    public readonly resourceKind: string,
    public readonly resourceId: string
  ) {
    super(`${resourceKind} is still current: ${resourceId}`);
    this.name = "ResourceNotDeletedError";
  }
}

export class ResourceHistoryNotFoundError extends Error {
  constructor(
    public readonly resourceKind: string,
    public readonly resourceId: string
  ) {
    super(`${resourceKind} history not found: ${resourceId}`);
    this.name = "ResourceHistoryNotFoundError";
  }
}

export const initializeResourceHistorySchema = (
  db: DatabaseConnection,
  tableName: string
): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      resource_kind TEXT NOT NULL,
      resource_id   TEXT NOT NULL,
      revision      INTEGER NOT NULL CHECK (revision >= 1),
      record_type   TEXT NOT NULL CHECK (record_type IN ('snapshot', 'deleted')),
      snapshot_json TEXT,
      recorded_at   TEXT NOT NULL,
      PRIMARY KEY (resource_kind, resource_id, revision),
      CHECK (
        (record_type = 'snapshot' AND snapshot_json IS NOT NULL) OR
        (record_type = 'deleted' AND snapshot_json IS NULL)
      )
    );

    CREATE INDEX IF NOT EXISTS ${tableName}_recorded
      ON ${tableName}(recorded_at, resource_kind, resource_id);
  `);
};

export const insertHistorySnapshot = <TSnapshot>(
  db: DatabaseConnection,
  tableName: string,
  input: {
    readonly resourceKind: string;
    readonly resourceId: string;
    readonly revision: number;
    readonly snapshot: TSnapshot;
    readonly recordedAt: string;
  }
): void => {
  db.prepare(`
    INSERT INTO ${tableName}
      (resource_kind, resource_id, revision, record_type, snapshot_json, recorded_at)
    VALUES (?, ?, ?, 'snapshot', ?, ?)
  `).run(
    input.resourceKind,
    input.resourceId,
    input.revision,
    JSON.stringify(input.snapshot),
    input.recordedAt
  );
};

export const insertHistoryDeletion = (
  db: DatabaseConnection,
  tableName: string,
  input: {
    readonly resourceKind: string;
    readonly resourceId: string;
    readonly revision: number;
    readonly recordedAt: string;
  }
): void => {
  db.prepare(`
    INSERT INTO ${tableName}
      (resource_kind, resource_id, revision, record_type, snapshot_json, recorded_at)
    VALUES (?, ?, ?, 'deleted', NULL, ?)
  `).run(
    input.resourceKind,
    input.resourceId,
    input.revision,
    input.recordedAt
  );
};

const rowToHistory = <TSnapshot>(row: HistoryRow): ResourceHistoryRecord<TSnapshot> => ({
  resourceKind: row.resource_kind,
  resourceId: row.resource_id,
  revision: Number(row.revision),
  recordType: row.record_type,
  ...(row.snapshot_json !== null
    ? { snapshot: JSON.parse(row.snapshot_json) as TSnapshot }
    : {}),
  recordedAt: row.recorded_at
});

export const getResourceHistory = <TSnapshot>(
  db: DatabaseConnection,
  tableName: string,
  resourceKind: string,
  resourceId: string
): ResourceHistoryRecord<TSnapshot>[] => {
  const rows = db.prepare(`
    SELECT * FROM ${tableName}
    WHERE resource_kind = ? AND resource_id = ?
    ORDER BY revision ASC
  `).all(resourceKind, resourceId) as HistoryRow[];
  return rows.map(rowToHistory<TSnapshot>);
};

export const getLatestHistoryRecord = (
  db: DatabaseConnection,
  tableName: string,
  resourceKind: string,
  resourceId: string
): ResourceHistoryRecord | undefined => {
  const row = db.prepare(`
    SELECT * FROM ${tableName}
    WHERE resource_kind = ? AND resource_id = ?
    ORDER BY revision DESC
    LIMIT 1
  `).get(resourceKind, resourceId) as HistoryRow | undefined;
  return row ? rowToHistory(row) : undefined;
};

export const nextRevisionAfterHistory = (
  db: DatabaseConnection,
  tableName: string,
  resourceKind: string,
  resourceId: string
): number => {
  const row = db.prepare(`
    SELECT MAX(revision) AS revision
    FROM ${tableName}
    WHERE resource_kind = ? AND resource_id = ?
  `).get(resourceKind, resourceId) as { revision: number | null };
  return row.revision === null ? 1 : Number(row.revision) + 1;
};

export const purgeResourceHistory = (
  db: DatabaseConnection,
  tableName: string,
  resourceKind: string,
  resourceId: string
): boolean => {
  const latest = getLatestHistoryRecord(
    db,
    tableName,
    resourceKind,
    resourceId
  );
  if (!latest || latest.recordType !== "deleted") return false;
  const result = db.prepare(`
    DELETE FROM ${tableName}
    WHERE resource_kind = ? AND resource_id = ?
  `).run(resourceKind, resourceId);
  return result.changes > 0;
};

export const pruneHistoryBefore = (
  db: DatabaseConnection,
  tableName: string,
  cutoff: string,
  isCurrent?: (resourceKind: string, resourceId: string) => boolean
): number => db.prepare(`
  DELETE FROM ${tableName}
  WHERE recorded_at < ?
    AND NOT (
      record_type = 'deleted'
      AND revision = (
        SELECT MAX(latest.revision)
        FROM ${tableName} AS latest
        WHERE latest.resource_kind = ${tableName}.resource_kind
          AND latest.resource_id = ${tableName}.resource_id
      )
    )
`).run(cutoff).changes + (isCurrent
  ? listExpiredDeletedResources(db, tableName, cutoff).reduce((count, resource) => {
      if (!isCurrent(resource.resourceKind, resource.resourceId)) return count;
      return count + db.prepare(`
        DELETE FROM ${tableName}
        WHERE resource_kind = ? AND resource_id = ?
          AND record_type = 'deleted' AND recorded_at < ?
      `).run(resource.resourceKind, resource.resourceId, cutoff).changes;
    }, 0)
  : 0);

export const listExpiredDeletedResources = (
  db: DatabaseConnection,
  tableName: string,
  cutoff: string
): Array<{ resourceKind: string; resourceId: string }> => {
  const rows = db.prepare(`
    SELECT history.resource_kind, history.resource_id
    FROM ${tableName} AS history
    WHERE history.record_type = 'deleted'
      AND history.recorded_at < ?
      AND history.revision = (
        SELECT MAX(latest.revision)
        FROM ${tableName} AS latest
        WHERE latest.resource_kind = history.resource_kind
          AND latest.resource_id = history.resource_id
      )
    ORDER BY history.resource_kind, history.resource_id
  `).all(cutoff) as Array<{ resource_kind: string; resource_id: string }>;
  return rows.map((row) => ({
    resourceKind: row.resource_kind,
    resourceId: row.resource_id
  }));
};

export interface ResourceRetentionPort {
  readonly capability: string;
  pruneHistory(cutoff: string): Promise<number> | number;
  purgeExpired(cutoff: string): Promise<number> | number;
}
