import type { WorkspaceStateModel } from "$model/client/workspace-state";

import { createAutomation } from "$app-views/categories/agents/procedures/create-automation";
import { nextName } from "$app-views/categories/agents/procedures/naming";

/**
 * A blank rule, named so it does not collide with one already on the screen.
 *
 * The name is decided here rather than by the capability because the surface is
 * the only place that knows which names a person is currently looking at.
 */
export const makeAutomation = (
  view: WorkspaceStateModel,
  personaId: string,
  taken: readonly string[]
) => createAutomation(view, { personaId, name: nextName("Untitled automation", taken) });
