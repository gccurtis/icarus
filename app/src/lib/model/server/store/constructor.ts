import { requiredString, type Configuration } from "$model/server/configuration/index.server";

import { JsonStore } from "$model/server/store/definition";
import { load } from "$model/server/store/methods/shared/load.server";
import { recoverJournal } from "$model/server/store/methods/transaction/recover.server";
import type { StoreFailpoint, StoreInput, StoreModel } from "$model/server/store/types";

const DIRECTORY = "representation.store.directory";

/** Recovers any decided transaction before the first table can be read. */
export const defineStore = ({
  directory,
  now = Date.now,
  failpoint
}: StoreInput = {}): StoreModel => {
  recoverJournal(directory, failpoint);
  return new JsonStore({
    kind: "store",
    directory,
    now,
    tables: load(directory),
    failpoint,
    transactionOpen: false,
    available: true
  });
};

export const createStore = (
  configuration: Configuration,
  directoryOverride?: string,
  failpoint?: (point: StoreFailpoint) => void
): StoreModel =>
  defineStore({
    directory:
      directoryOverride?.trim().length
        ? directoryOverride.trim()
        : requiredString(configuration, DIRECTORY),
    failpoint
  });
