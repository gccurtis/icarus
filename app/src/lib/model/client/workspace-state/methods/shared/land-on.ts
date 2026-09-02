import type { ContentView } from "$representation/data/types/workspace/categories";
import type { TabRecord } from "$representation/data/types/workspace/tab";
import { isContentView } from "$representation/data/behavior/workspace/categories";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { landing } from "$model/client/workspace-state/methods/shared/landing";
import { perform } from "$model/client/workspace-state/methods/shared/perform";
import { defaultContext, offersContext } from "$model/client/workspace-state/methods/shared/rails";

export const landOn = (
  state: WorkspaceStateData,
  record: TabRecord,
  content: ContentView,
  focus?: string
): void => {
  if (!isContentView(content) || !content.startsWith(`${record.category}.`)) {
    throw new Error(`'${record.category}' has no content view '${content}'`);
  }

  const was = landing(state.views.of(record.id));
  const held = was.contextId;
  const contextId =
    held !== null && offersContext(record.category, held)
      ? held
      : (defaultContext(record.category) ?? null);

  perform(state, {
    op: "land",
    tab: record.id,
    was,
    now: {
      content,
      focus: focus ?? null,
      contextId,
      inspected: "empty",
      selection: null
    }
  });
};
