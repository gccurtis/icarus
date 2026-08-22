/**
 * The door for view state.
 *
 * The composition root takes the constructor; the five shell surfaces take the
 * types and the vocabulary. The vocabulary is re-exported from here rather than
 * reached through `keys` directly, so a surface imports one path and the fact
 * that the keys are generated stays this object's business.
 */
import { getContext, hasContext, setContext } from "svelte";

import { createViewState } from "$model/client/view-state/constructor";
import type { ViewStateModel } from "$model/client/view-state/types";

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

/**
 * How a surface reaches the instance, and why it is context rather than
 * `clientModel()`.
 *
 * The four panel trees hold 197 components and every one of them renders on its
 * own — a test proves it by server-rendering each with nothing but a prop bag.
 * That property is what makes the review pages possible and what makes a panel
 * testable at all. `clientModel()` refuses outside a browser and before the
 * layout has run, so routing panels through it would end that for all of them.
 *
 * So the shell provides the instance the client graph already built, a review
 * page provides one of its own, and a panel with no provider gets one to itself.
 *
 * This lives in the door rather than in `methods/` because it is not a step any
 * method takes — it is how the object is reached, which is what a door is for.
 */
const KEY = Symbol.for("icarus.view-state");

/**
 * Hand the instance down.
 *
 * The shell's job and nobody else's: it has to run during component
 * initialisation, so it belongs to whatever mounts the surfaces, and a second
 * caller underneath would silently shadow the first for everything below it.
 */
export const provideViewState = (model: ViewStateModel): ViewStateModel => {
  setContext(KEY, model);
  return model;
};

/**
 * The view state this component is inside.
 *
 * **The fallback is per reader, not a module singleton.** Two panels rendered
 * with no provider between them are two unrelated things, and one shared object
 * would make a stray click in one move the other. Under a provider — every case
 * that matters — they share the one the shell built.
 *
 * Read during initialisation, like any context. A component that calls this in
 * an event handler gets the fallback instead, which is the one way to misuse it:
 * read it once at the top and hold it.
 */
export const viewState = (): ViewStateModel =>
  hasContext(KEY) ? getContext<ViewStateModel>(KEY) : createViewState("dev-project");
