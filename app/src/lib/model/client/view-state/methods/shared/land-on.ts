import type { Subscreen } from "$representation/data/types/views/screens";
import type { TabRecord } from "$representation/data/types/views/tab";
import { SUBSCREENS } from "$representation/data/behavior/views/screens";
import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { landing } from "$model/client/view-state/methods/shared/landing";
import { perform } from "$model/client/view-state/methods/shared/perform";
import { defaultContext, offersContext } from "$model/client/view-state/methods/shared/rails";

export const landOn = (
  state: ViewStateData,
  record: TabRecord,
  subscreen: Subscreen,
  focus?: string
): void => {
  const offered: readonly string[] = SUBSCREENS[record.screen];
  if (!offered.includes(subscreen)) {
    throw new Error(`'${record.screen}' has no subscreen '${subscreen}'`);
  }

  const was = landing(state.views.of(record.id));
  const held = was.contextId;
  const contextId =
    held !== null && offersContext(record.screen, subscreen, held)
      ? held
      : (defaultContext(record.screen, subscreen) ?? null);

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
