/**
 * The entry for ResourceRuntimes.
 *
 * The composition root takes the constructor; every other object takes the
 * types. The workbench takes `ResourceRuntimesModel` to attach and release, and
 * a screen takes `ResourceRuntime` to read and write one resource.
 *
 * `Runtime` and `ResourceRuntimesState` do not cross. They are the definition's,
 * and a consumer holding one could hold a runtime past its release.
 */
export { createResourceRuntimes } from "$model/client/resource-runtimes/constructor";
export type {
  BodyFor,
  DocumentBody,
  ResourceRuntime,
  ResourceRuntimesModel,
  SlideDeckBody,
  SpreadsheetBody,
  SyncState
} from "$model/client/resource-runtimes/types";
