/**
 * The entry for DocumentRuntimes.
 *
 * The composition root takes the constructor; every other object takes the
 * types. `Runtime` and `DocumentRuntimesState` do not cross — they are the
 * definition's, and a consumer holding one could hold a runtime past its
 * release.
 */
export { createDocumentRuntimes } from "$model/client/document-runtimes/constructor";
export type {
  DocumentRuntime,
  DocumentRuntimesModel,
  SyncState
} from "$model/client/document-runtimes/types";
