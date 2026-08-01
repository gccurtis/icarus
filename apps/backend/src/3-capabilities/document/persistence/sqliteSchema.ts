import { createHash } from "node:crypto";
import type { Database as DatabaseConnection } from "better-sqlite3";

export interface DocumentTableNames {
  documents: string;
  receipts: string;
  delegatedCommandClaims: string;
  identityLedger: string;
  bases: string;
  changeSets: string;
  activityOutbox: string;
  attempts: string;
  promptOutputs: string;
  stageReceipts: string;
}

const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

export const createDocumentTableNames = (
  projectId: string
): DocumentTableNames => {
  const root = `doc_${projectPrefix(projectId)}`;
  return {
    documents: `${root}_documents`,
    receipts: `${root}_command_receipts`,
    delegatedCommandClaims: `${root}_delegated_command_claims`,
    identityLedger: `${root}_identity_ledger`,
    bases: `${root}_bases`,
    changeSets: `${root}_change_sets`,
    activityOutbox: `${root}_activity_outbox`,
    attempts: `${root}_attempts`,
    promptOutputs: `${root}_prompt_outputs`,
    stageReceipts: `${root}_stage_receipts`
  };
};

export const initializeDocumentSchema = (
  db: DatabaseConnection,
  tables: DocumentTableNames
): void => {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tables.documents} (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL,
      lifecycle        TEXT NOT NULL
        CHECK (lifecycle IN ('active', 'archived', 'trashed')),
      revision         INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
      base_seq         INTEGER NOT NULL DEFAULT 0 CHECK (base_seq >= 0),
      semantic_digest  TEXT NOT NULL,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      CHECK (base_seq <= revision)
    );

    CREATE INDEX IF NOT EXISTS ${tables.documents}_lifecycle_updated
      ON ${tables.documents}(lifecycle, updated_at DESC, id);

    CREATE TABLE IF NOT EXISTS ${tables.receipts} (
      document_id      TEXT NOT NULL,
      request_id       TEXT NOT NULL,
      request_digest   TEXT NOT NULL,
      result_json      BLOB NOT NULL,
      created_at       TEXT NOT NULL,
      PRIMARY KEY (document_id, request_id),
      FOREIGN KEY (document_id) REFERENCES ${tables.documents}(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ${tables.delegatedCommandClaims} (
      document_id      TEXT NOT NULL,
      request_id       TEXT NOT NULL,
      request_digest   TEXT NOT NULL,
      command_kind     TEXT NOT NULL
        CHECK (command_kind = 'prompt.update-definition'),
      target_output_id TEXT NOT NULL,
      state            TEXT NOT NULL
        CHECK (state IN ('pending', 'completed')),
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      PRIMARY KEY (document_id, request_id),
      FOREIGN KEY (document_id) REFERENCES ${tables.documents}(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS ${tables.delegatedCommandClaims}_pending
      ON ${tables.delegatedCommandClaims}(state, updated_at, document_id, request_id)
      WHERE state = 'pending';

    CREATE TABLE IF NOT EXISTS ${tables.identityLedger} (
      document_id              TEXT NOT NULL,
      identity_id              TEXT NOT NULL,
      identity_kind            TEXT NOT NULL
        CHECK (identity_kind IN (
          'style', 'row', 'block', 'list', 'list-item', 'table',
          'table-row', 'table-column', 'table-cell', 'table-merge',
          'rich-text-atom', 'rich-text-mark'
        )),
      state                    TEXT NOT NULL
        CHECK (state IN ('active', 'tombstoned')),
      first_revision           INTEGER NOT NULL CHECK (first_revision >= 0),
      last_transition_revision INTEGER NOT NULL
        CHECK (last_transition_revision >= first_revision),
      tombstoned_revision      INTEGER CHECK (tombstoned_revision >= 0),
      PRIMARY KEY (document_id, identity_id),
      CHECK (
        (state = 'active' AND tombstoned_revision IS NULL) OR
        (state = 'tombstoned' AND tombstoned_revision IS NOT NULL)
      ),
      FOREIGN KEY (document_id) REFERENCES ${tables.documents}(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS ${tables.identityLedger}_state
      ON ${tables.identityLedger}(document_id, state, identity_id);

    CREATE TABLE IF NOT EXISTS ${tables.bases} (
      document_id            TEXT NOT NULL,
      base_seq               INTEGER NOT NULL CHECK (base_seq >= 0),
      representation_version INTEGER NOT NULL CHECK (representation_version = 1),
      snapshot_json          BLOB NOT NULL,
      semantic_digest        TEXT NOT NULL,
      created_at             TEXT NOT NULL,
      PRIMARY KEY (document_id, base_seq),
      FOREIGN KEY (document_id) REFERENCES ${tables.documents}(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS ${tables.bases}_lookup
      ON ${tables.bases}(document_id, base_seq DESC);

    CREATE TABLE IF NOT EXISTS ${tables.changeSets} (
      id                                 TEXT PRIMARY KEY,
      document_id                        TEXT NOT NULL,
      client_request_id                  TEXT NOT NULL,
      request_digest                     TEXT NOT NULL,
      authored_revision                  INTEGER NOT NULL CHECK (authored_revision >= 0),
      prior_revision                     INTEGER NOT NULL CHECK (prior_revision >= 0),
      revision                           INTEGER NOT NULL CHECK (revision > 0),
      seq                                INTEGER NOT NULL CHECK (seq > 0),
      origin                             TEXT NOT NULL
        CHECK (origin IN ('interactive', 'agent', 'automation')),
      operations_json                    BLOB NOT NULL,
      inverse_operations_json            BLOB NOT NULL,
      touched_ids_json                   BLOB NOT NULL,
      compensation_intent                TEXT
        CHECK (compensation_intent IN ('undo', 'redo')),
      compensation_target_change_set_id  TEXT,
      semantic_digest                    TEXT NOT NULL,
      created_at                         TEXT NOT NULL,
      UNIQUE (document_id, seq),
      UNIQUE (document_id, revision),
      CHECK (seq = revision),
      CHECK (revision = prior_revision + 1),
      FOREIGN KEY (document_id) REFERENCES ${tables.documents}(id)
        ON DELETE CASCADE,
      FOREIGN KEY (compensation_target_change_set_id)
        REFERENCES ${tables.changeSets}(id)
    );

    CREATE INDEX IF NOT EXISTS ${tables.changeSets}_recent
      ON ${tables.changeSets}(document_id, seq DESC);

    CREATE INDEX IF NOT EXISTS ${tables.changeSets}_compensation_target
      ON ${tables.changeSets}(compensation_target_change_set_id)
      WHERE compensation_target_change_set_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS ${tables.activityOutbox} (
      fact_id           TEXT PRIMARY KEY,
      fact_kind         TEXT NOT NULL
        CHECK (fact_kind IN ('document.created', 'document.changed', 'document.compensated')),
      document_id       TEXT NOT NULL,
      revision          INTEGER NOT NULL CHECK (revision >= 0),
      change_set_id     TEXT,
      actor_id          TEXT,
      origin            TEXT NOT NULL
        CHECK (origin IN ('interactive', 'agent', 'automation')),
      operation_types   BLOB NOT NULL,
      semantic_digest   TEXT NOT NULL,
      occurred_at       TEXT NOT NULL,
      published_at      TEXT,
      UNIQUE (document_id, revision),
      FOREIGN KEY (document_id) REFERENCES ${tables.documents}(id)
        ON DELETE CASCADE,
      FOREIGN KEY (change_set_id) REFERENCES ${tables.changeSets}(id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS ${tables.activityOutbox}_unpublished
      ON ${tables.activityOutbox}(occurred_at, fact_id)
      WHERE published_at IS NULL;

    CREATE TABLE IF NOT EXISTS ${tables.attempts} (
      id                        TEXT PRIMARY KEY,
      document_id               TEXT NOT NULL,
      kind                      TEXT NOT NULL
        CHECK (kind IN ('prompt-create', 'prompt-refresh', 'formula-evaluation')),
      client_request_id         TEXT NOT NULL,
      request_digest            TEXT NOT NULL,
      block_id                  TEXT NOT NULL,
      frozen_document_revision  INTEGER NOT NULL CHECK (frozen_document_revision >= 0),
      state                     TEXT NOT NULL
        CHECK (state IN (
          'requested', 'computing', 'proposed', 'settled',
          'unchanged', 'stale', 'failed'
        )),
      frozen_json               BLOB NOT NULL,
      candidate_json            BLOB,
      diagnostic_json           BLOB,
      settled_change_set_id     TEXT,
      created_at                TEXT NOT NULL,
      updated_at                TEXT NOT NULL,
      UNIQUE (document_id, kind, client_request_id),
      FOREIGN KEY (document_id) REFERENCES ${tables.documents}(id)
        ON DELETE CASCADE,
      FOREIGN KEY (settled_change_set_id) REFERENCES ${tables.changeSets}(id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS ${tables.attempts}_state
      ON ${tables.attempts}(kind, state, updated_at, id);

    CREATE INDEX IF NOT EXISTS ${tables.attempts}_block
      ON ${tables.attempts}(document_id, block_id, updated_at DESC);

    CREATE UNIQUE INDEX IF NOT EXISTS ${tables.attempts}_prompt_create_block
      ON ${tables.attempts}(document_id, block_id)
      WHERE kind = 'prompt-create';

    CREATE TABLE IF NOT EXISTS ${tables.promptOutputs} (
      output_id            TEXT PRIMARY KEY,
      document_id          TEXT NOT NULL,
      block_id             TEXT NOT NULL,
      creation_attempt_id  TEXT UNIQUE,
      state                TEXT NOT NULL
        CHECK (state IN ('pending', 'attached', 'detached')),
      attached_revision    INTEGER CHECK (attached_revision > 0),
      detached_revision    INTEGER CHECK (detached_revision > 0),
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL,
      UNIQUE (document_id, block_id),
      CHECK (state != 'attached' OR attached_revision IS NOT NULL),
      FOREIGN KEY (document_id) REFERENCES ${tables.documents}(id)
        ON DELETE CASCADE,
      FOREIGN KEY (creation_attempt_id) REFERENCES ${tables.attempts}(id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS ${tables.promptOutputs}_detached
      ON ${tables.promptOutputs}(state, updated_at, output_id)
      WHERE state = 'detached';

    CREATE TABLE IF NOT EXISTS ${tables.stageReceipts} (
      attempt_id       TEXT NOT NULL,
      stage            TEXT NOT NULL CHECK (stage IN ('compute', 'settle')),
      idempotency_key  TEXT NOT NULL UNIQUE,
      request_digest   TEXT NOT NULL,
      state            TEXT NOT NULL
        CHECK (state IN ('running', 'completed', 'failed')),
      result_json      BLOB,
      diagnostic_json  BLOB,
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      PRIMARY KEY (attempt_id, stage),
      FOREIGN KEY (attempt_id) REFERENCES ${tables.attempts}(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS ${tables.stageReceipts}_state
      ON ${tables.stageReceipts}(state, updated_at, attempt_id);
  `);
};
