import { persist } from "$model/server/store/methods/shared/persist.server";
import {
  discardUndecidedJournal,
  readJournal,
  removeJournal
} from "$model/server/store/methods/transaction/journal.server";
import type { StoreFailpoint } from "$model/server/store/types";

/** Replays an irrevocably committed journal before the Store becomes readable. */
export const recoverJournal = (
  directory: string | undefined,
  failpoint?: (point: StoreFailpoint) => void
): void => {
  if (directory === undefined) return;
  discardUndecidedJournal(directory);
  const journal = readJournal(directory);
  if (journal === undefined) return;
  for (const change of journal.changes) {
    persist(directory, change.table, change.rows);
    failpoint?.(`recovery:after-table:${change.table}`);
  }
  failpoint?.("recovery:before-journal-remove");
  removeJournal(directory);
};
