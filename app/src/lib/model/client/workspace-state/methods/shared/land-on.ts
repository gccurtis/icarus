import type { Subscreen } from "$representation/data/types/workspace/categories";
import type { TabRecord } from "$representation/data/types/workspace/tab";
import { SUBSCREENS } from "$representation/data/behavior/workspace/categories";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { landing } from "$model/client/workspace-state/methods/shared/landing";
import { perform } from "$model/client/workspace-state/methods/shared/perform";
import { defaultContext, offersContext } from "$model/client/workspace-state/methods/shared/rails";

export const landOn = (
  state: WorkspaceStateData,
  record: TabRecord,
  subscreen: Subscreen,
  focus?: string
): void => {
  const offered: readonly string[] = SUBSCREENS[record.category];
  if (!offered.includes(subscreen)) {
    throw new Error(`'${record.category}' has no subscreen '${subscreen}'`);
  }

  const was = landing(state.views.of(record.id));
  const held = was.contextId;
  const contextId =
    held !== null && offersContext(record.category, subscreen, held)
      ? held
      : (defaultContext(record.category, subscreen) ?? null);

  perform(state, {
    op: "land",
    tab: record.id,
    was,
    now: {
      subscreen,
      focus: focus ?? null,
      contextId,
      inspected: "empty",
      selection: null
    }
  });
};
