import { requiredString, type Configuration } from "$model/server/configuration/index.server";

import { defineStore } from "$model/server/store/definition";
import type { StoreModel } from "$model/server/store/types";

const DIRECTORY = "representation.store.directory";

export const createStore = (
  configuration: Configuration,
  directoryOverride?: string
): StoreModel =>
  defineStore({
    directory:
      directoryOverride?.trim().length
        ? directoryOverride.trim()
        : requiredString(configuration, DIRECTORY)
  });
