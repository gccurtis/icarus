import type { Kysely } from "kysely";
import type { BackendDatabase } from "#persistence";
import { PGliteRichContentStore } from "#rich-content/persistence/store.js";
import { createRichContentIdFactory } from "#rich-content/runtime-objects/id-factory/constructor.js";
import {
  PersistedRichContentRuntime,
  type RichContentRuntime
} from "#rich-content/runtime-objects/rich-content/definition.js";

export const createRichContentRuntime = async (
  database: Kysely<BackendDatabase>
): Promise<RichContentRuntime> => {
  const store = new PGliteRichContentStore(database);
  await store.initialize();
  return new PersistedRichContentRuntime(store, createRichContentIdFactory());
};
