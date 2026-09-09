import { onMount } from "svelte";

import type { Id } from "$app-views/categories/slide-deck-editor/procedures/prompt-blocks";
import { observePromptOutput } from "$app-views/categories/slide-deck-editor/procedures/prompt-output-events";
import type { PromptSettingsState } from "$app-views/categories/slide-deck-editor/components/prompt-settings.state.svelte";

export const synchronizePromptSettings = ({
  outputId,
  state,
  prompt,
  refreshing,
  refresh
}: {
  outputId: () => Id<"derivedOutputs">;
  state: PromptSettingsState;
  prompt: () => string | undefined;
  refreshing: () => boolean;
  refresh: () => Promise<unknown>;
}): void => {
  $effect(() => state.hydrate(prompt()));

  onMount(() => {
    const stopObserving = observePromptOutput(outputId(), () => void refresh());
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (): void => {
      if (stopped) return;
      timer = setTimeout(async () => {
        try {
          await refresh();
        } catch {
          // The query owns transient transport errors; polling keeps observing collaborators.
        } finally {
          schedule();
        }
      }, refreshing() ? 600 : 1_500);
    };
    schedule();
    return () => {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      stopObserving();
    };
  });
};
