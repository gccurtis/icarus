import { createHash } from "node:crypto";
import type { Database as DatabaseConnection } from "better-sqlite3";
import { initializeResourceHistorySchema } from "#utils/persistence/resourceHistory.js";

export interface SlideTableNames {
  resources: string;
  decks: string;
  history: string;
  identityLedger: string;
  bases: string;
  changeSets: string;
  transactionOutbox: string;
  retainedOutputs: string;
  attempts: string;
  promptOutputs: string;
  stageReceipts: string;
}

const projectPrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

export const createSlideTableNames = (projectId: string): SlideTableNames => {
  const root = `slides_${projectPrefix(projectId)}`;
  return {
    resources: `${root}_resources`,
    decks: `${root}_decks`,
    history: `${root}_history`,
    identityLedger: `${root}_identity_ledger`,
    bases: `${root}_bases`,
    changeSets: `${root}_change_sets`,
    transactionOutbox: `${root}_transaction_outbox`,
    retainedOutputs: `${root}_retained_outputs`,
    attempts: `${root}_attempts`,
    promptOutputs: `${root}_prompt_outputs`,
    stageReceipts: `${root}_stage_receipts`
  };
};

export const initializeSlidesSchema = (
  db: DatabaseConnection,
  tables: SlideTableNames
): void => {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    -- The stable root. A Deck row is current operational state and is removed by
    -- logical deletion; this row survives it, so retained history and the
    -- identity ledger keep something to hang from.
    CREATE TABLE IF NOT EXISTS ${tables.resources} (
      id         TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ${tables.decks} (
      id               TEXT PRIMARY KEY,
      title            TEXT NOT NULL,
      lifecycle        TEXT NOT NULL
        CHECK (lifecycle IN ('active', 'archived', 'trashed')),
      revision         INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
      base_seq         INTEGER NOT NULL DEFAULT 1 CHECK (base_seq >= 1),
      created_at       TEXT NOT NULL,
      updated_at       TEXT NOT NULL,
      CHECK (base_seq <= revision),
      FOREIGN KEY (id) REFERENCES ${tables.resources}(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS ${tables.decks}_lifecycle_updated
      ON ${tables.decks}(lifecycle, updated_at DESC, id);

    -- Permanent identity non-reuse across retained history. The kind list is the
    -- SlideIdentityKind union; a mismatch between the two is caught by a test
    -- rather than left to drift.
    CREATE TABLE IF NOT EXISTS ${tables.identityLedger} (
      deck_id                  TEXT NOT NULL,
      identity_id              TEXT NOT NULL,
      identity_kind            TEXT NOT NULL
        CHECK (identity_kind IN (
          'style', 'token', 'master', 'layout', 'slot', 'slide', 'element',
          'table', 'table-row', 'table-column', 'table-cell', 'table-merge',
          'chart-label', 'rich-text-atom', 'rich-text-mark'
        )),
      state                    TEXT NOT NULL
        CHECK (state IN ('active', 'tombstoned')),
      first_revision           INTEGER NOT NULL CHECK (first_revision >= 1),
      last_transition_revision INTEGER NOT NULL
        CHECK (last_transition_revision >= first_revision),
      tombstoned_revision      INTEGER CHECK (tombstoned_revision >= 1),
      PRIMARY KEY (deck_id, identity_id),
      CHECK (
        (state = 'active' AND tombstoned_revision IS NULL) OR
        (state = 'tombstoned' AND tombstoned_revision IS NOT NULL)
      ),
      FOREIGN KEY (deck_id) REFERENCES ${tables.resources}(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS ${tables.identityLedger}_state
      ON ${tables.identityLedger}(deck_id, state, identity_id);

    CREATE TABLE IF NOT EXISTS ${tables.bases} (
      deck_id                TEXT NOT NULL,
      base_seq               INTEGER NOT NULL CHECK (base_seq >= 1),
      representation_version INTEGER NOT NULL CHECK (representation_version = 1),
      snapshot_json          BLOB NOT NULL,
      created_at             TEXT NOT NULL,
      PRIMARY KEY (deck_id, base_seq),
      FOREIGN KEY (deck_id) REFERENCES ${tables.resources}(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS ${tables.bases}_lookup
      ON ${tables.bases}(deck_id, base_seq DESC);

    CREATE TABLE IF NOT EXISTS ${tables.changeSets} (
      id                                 TEXT PRIMARY KEY,
      deck_id                            TEXT NOT NULL,
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
      created_at                         TEXT NOT NULL,
      UNIQUE (deck_id, seq),
      UNIQUE (deck_id, revision),
      CHECK (seq = revision),
      CHECK (revision = prior_revision + 1),
      FOREIGN KEY (deck_id) REFERENCES ${tables.resources}(id) ON DELETE CASCADE,
      FOREIGN KEY (compensation_target_change_set_id)
        REFERENCES ${tables.changeSets}(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS ${tables.changeSets}_recent
      ON ${tables.changeSets}(deck_id, seq DESC);

    CREATE INDEX IF NOT EXISTS ${tables.changeSets}_compensation_target
      ON ${tables.changeSets}(compensation_target_change_set_id)
      WHERE compensation_target_change_set_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS ${tables.transactionOutbox} (
      source_transaction_id TEXT PRIMARY KEY,
      transaction_kind      TEXT NOT NULL
        CHECK (transaction_kind IN ('deck.created', 'deck.changed',
                                    'deck.compensated', 'deck.deleted')),
      deck_id               TEXT NOT NULL,
      -- Structural attachment while retained; SET NULL lets the immutable
      -- transaction survive resource purge as ledger retention requires.
      resource_root_id      TEXT,
      revision              INTEGER NOT NULL CHECK (revision >= 1),
      -- This historical link may be cleared by ChangeSet compaction.
      change_set_id         TEXT,
      -- This copied source value must survive history compaction.
      source_change_set_id  TEXT,
      actor_id              TEXT,
      origin                TEXT NOT NULL
        CHECK (origin IN ('interactive', 'agent', 'automation')),
      operation_types       BLOB NOT NULL,
      compensation_intent   TEXT
        CHECK (compensation_intent IN ('undo', 'redo')),
      compensation_target_change_set_id TEXT,
      occurred_at           TEXT NOT NULL,
      published_at          TEXT,
      UNIQUE (deck_id, revision),
      FOREIGN KEY (resource_root_id) REFERENCES ${tables.resources}(id)
        ON DELETE SET NULL,
      FOREIGN KEY (change_set_id) REFERENCES ${tables.changeSets}(id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS ${tables.transactionOutbox}_unpublished
      ON ${tables.transactionOutbox}(occurred_at, source_transaction_id)
      WHERE published_at IS NULL;

    CREATE TABLE IF NOT EXISTS ${tables.retainedOutputs} (
      deck_id   TEXT NOT NULL,
      output_id TEXT NOT NULL,
      PRIMARY KEY (deck_id, output_id),
      FOREIGN KEY (deck_id) REFERENCES ${tables.resources}(id) ON DELETE CASCADE
    );

    -- A prompt site is a container plus an element, so the address is wider than
    -- Document's single block id. It is stored decomposed rather than as opaque
    -- JSON so the uniqueness constraint below can be expressed in SQL.
    CREATE TABLE IF NOT EXISTS ${tables.attempts} (
      id                     TEXT PRIMARY KEY,
      deck_id                TEXT NOT NULL,
      kind                   TEXT NOT NULL
        CHECK (kind IN ('prompt-create', 'prompt-refresh', 'formula-evaluation')),
      site_key               TEXT NOT NULL,
      frozen_deck_revision   INTEGER NOT NULL CHECK (frozen_deck_revision >= 0),
      state                  TEXT NOT NULL
        CHECK (state IN (
          'requested', 'computing', 'proposed', 'settled',
          'unchanged', 'stale', 'failed'
        )),
      frozen_json            BLOB NOT NULL,
      candidate_json         BLOB,
      diagnostic_json        BLOB,
      settled_change_set_id  TEXT,
      created_at             TEXT NOT NULL,
      updated_at             TEXT NOT NULL,
      FOREIGN KEY (deck_id) REFERENCES ${tables.decks}(id) ON DELETE CASCADE,
      FOREIGN KEY (settled_change_set_id) REFERENCES ${tables.changeSets}(id)
        ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS ${tables.attempts}_state
      ON ${tables.attempts}(kind, state, updated_at, id);

    CREATE INDEX IF NOT EXISTS ${tables.attempts}_site
      ON ${tables.attempts}(deck_id, site_key, updated_at DESC);

    -- One *live* prompt-create attempt per site. Partial for the same reason
    -- the prompt-output index is: a terminal attempt is history, and a site
    -- whose creation failed — or whose prompt was later undone — has to be
    -- promptable again. Reusing the finished row instead would leave its stage
    -- receipts behind, and a completed receipt makes the next claim a no-op.
    CREATE UNIQUE INDEX IF NOT EXISTS ${tables.attempts}_prompt_create_site
      ON ${tables.attempts}(deck_id, site_key)
      WHERE kind = 'prompt-create'
        AND state NOT IN ('settled', 'unchanged', 'stale', 'failed');

    CREATE TABLE IF NOT EXISTS ${tables.promptOutputs} (
      output_id            TEXT PRIMARY KEY,
      deck_id              TEXT NOT NULL,
      site_key             TEXT NOT NULL,
      site_json            BLOB NOT NULL,
      creation_attempt_id  TEXT UNIQUE,
      state                TEXT NOT NULL
        CHECK (state IN ('pending', 'attached', 'detached')),
      attached_revision    INTEGER CHECK (attached_revision > 0),
      detached_revision    INTEGER CHECK (detached_revision > 0),
      created_at           TEXT NOT NULL,
      updated_at           TEXT NOT NULL,
      CHECK (state != 'attached' OR attached_revision IS NOT NULL),
      FOREIGN KEY (deck_id) REFERENCES ${tables.decks}(id) ON DELETE CASCADE,
      FOREIGN KEY (creation_attempt_id) REFERENCES ${tables.attempts}(id)
        ON DELETE SET NULL
    );

    -- One dedicated Derived Output per *live* prompt site, in SQL rather than in
    -- the service, so a concurrent settle cannot double-bind a site. Partial on
    -- purpose: a detached row is a record of an output that was given back, and
    -- it must not reserve the site forever. Undoing a prompt creation detaches,
    -- and the site has to be promptable again afterwards.
    CREATE UNIQUE INDEX IF NOT EXISTS ${tables.promptOutputs}_live_site
      ON ${tables.promptOutputs}(deck_id, site_key)
      WHERE state != 'detached';

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
      FOREIGN KEY (attempt_id) REFERENCES ${tables.attempts}(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS ${tables.stageReceipts}_state
      ON ${tables.stageReceipts}(state, updated_at, attempt_id);
  `);
  initializeResourceHistorySchema(db, tables.history);
};
