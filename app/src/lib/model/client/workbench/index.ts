/**
 * The door for Workbench.
 *
 * The composition root takes the constructor; every other object and every view
 * takes the types. `isPermanent` and `screenKindOf` cross too: both are
 * derivations over a target that four surfaces ask for, and four spellings of
 * one predicate is three chances to get it wrong.
 *
 * `SINGLETON_SCREENS` and `DEFAULT_FRAME` cross because views need them — the
 * strip labels the singletons, and the layout seeds its CSS custom properties
 * from the widths so something can paint before the model is consulted.
 */
export { createWorkbench } from "$model/client/workbench/constructor";
export {
  DEFAULT_FRAME,
  SINGLETON_SCREENS,
  SINGLETON_TARGETS,
  isPermanent,
  screenKindOf
} from "$model/client/workbench/types";
export type {
  Frame,
  InspectionKey,
  ScreenKind,
  Selection,
  SingletonScreen,
  Tab,
  TabId,
  TabTarget,
  ViewStateFor,
  ViewStatePatch,
  WorkbenchModel,
  WorkbenchViewState
} from "$model/client/workbench/types";
