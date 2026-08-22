/**
 * The door for view state.
 *
 * The composition root takes the constructor; the five shell surfaces take the
 * types and the vocabulary. The vocabulary is re-exported from here rather than
 * reached through `keys` directly, so a surface imports one path and the fact
 * that the keys are generated stays this object's business.
 */
export { createViewState } from "$model/client/view-state/constructor";

export type {
  ContextId,
  InspectionKey,
  Screen,
  Subscreen
} from "$model/client/view-state/methods/shared/keys";
export {
  CONTEXT_IDS,
  INSPECTION_KEYS,
  SCREENS,
  SUBSCREENS,
  isContextId,
  isInspectionKey,
  isScreen
} from "$model/client/view-state/methods/shared/keys";

export type {
  Frame,
  Inspected,
  Selection,
  Singleton,
  Tab,
  TabId,
  Target,
  ViewStateModel
} from "$model/client/view-state/types";
export { DEFAULT_FRAME, SINGLETONS, isSingleton } from "$model/client/view-state/types";

export {
  RAILS,
  defaultContext,
  offersContext,
  railFor
} from "$model/client/view-state/methods/shared/rails";
