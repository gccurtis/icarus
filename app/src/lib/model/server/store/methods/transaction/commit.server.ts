import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";

import type { StoreState } from "$model/server/store/definition";
import { persist } from "$model/server/store/methods/shared/persist.server";
import type { UnitOfWorkState } from "$model/server/store/methods/shared/state";
import {
  journalPath,
  removeJournal,
  writeJournal,
  type StoreJournal
} from "$model/server/store/methods/transaction/journal.server";

const adopt = (store: StoreState, unit: UnitOfWorkState): void => {
  for (const table of unit.changed) {
    store.tables.set(table, structuredClone(unit.tables.get(table) ?? []));
  }
};

/**
 * Makes the journal the commit decision, then materializes every table.
 * A post-decision failure leaves the Store unavailable and the journal present
 * so the next constructor can finish the same decision before serving reads.
 */
export const commit = (store: StoreState, unit: UnitOfWorkState): void => {
  const tables = [...unit.changed].sort();
  if (tables.length === 0) return;
  store.failpoint?.("transaction:before-journal");

  if (store.directory === undefined) {
    adopt(store, unit);
    return;
  }

  const journal: StoreJournal = {
    version: 1,
    transactionId: randomUUID(),
    state: "committed",
    changes: tables.map((table) => ({ table, rows: unit.tables.get(table) ?? [] }))
  };
  let decided = false;
  try {
    writeJournal(store.directory, journal);
    decided = true;
    store.failpoint?.("transaction:after-journal");
    for (const change of journal.changes) {
      persist(store.directory, change.table, change.rows);
      store.failpoint?.(`transaction:after-table:${change.table}`);
    }
    adopt(store, unit);
    store.failpoint?.("transaction:before-journal-remove");
    removeJournal(store.directory);
  } catch (error) {
    if (decided || existsSync(journalPath(store.directory))) store.available = false;
    throw error;
  }
};
