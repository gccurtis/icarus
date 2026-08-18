import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { ScreenKind, Tab, TabTarget, WorkbenchViewState } from "$model/client/workbench/types";
import { DEFAULT_FRAME, screenKindOf } from "$model/client/workbench/types";

/**
 * The initial view state for a screen.
 *
 * A total switch rather than a `Record`, so a new screen kind fails to compile
 * here until it has been given a starting state. A partial map would hand a tab
 * `undefined` and fail during paint instead.
 *
 * `frame` is spread from the default rather than assigned, because
 * `$state(DEFAULT_FRAME)` would wrap the frozen constant itself and a later
 * resize would throw — or worse, reach every other tab.
 */
const initialViewState = (kind: ScreenKind): WorkbenchViewState => {
  const frame = { ...DEFAULT_FRAME };

  switch (kind) {
    case "project-overview":
    case "context":
      return { kind, frame };
    case "research":
    case "analysis":
    case "templates":
    case "personas":
    case "automations":
      return { kind, frame };
    case "document":
      return { kind, frame, zoom: 1, findQuery: "" };
    case "slides":
      return { kind, frame, zoom: 1 };
    case "spreadsheet":
      return { kind, frame };
    case "new-tab":
      return { kind, frame, query: "" };
  }
};

/**
 * Mints a tab. **The only place one is created.**
 *
 * One mint point is what makes every invariant about a tab hold by construction
 * rather than by everyone remembering: `viewState.kind` always equals
 * `screenKindOf(target)`, `frame` is always fully populated, and no tab ever
 * exists in a half-built state that a reader has to defend against.
 *
 * Shared because `open`, `resolveLauncher` and the constructor's singletons all
 * mint, and a second mint site is where the two would drift.
 */
export const adoptTarget = (state: WorkbenchState, target: TabTarget): Tab => ({
  id: state.nextId(),
  target,
  viewState: initialViewState(screenKindOf(target))
});
