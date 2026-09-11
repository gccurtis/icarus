import { updateDerivedOutput } from "$capabilities/derived-output/index.remote";
import { readableScope } from "$app-views/categories/presentation-editor/procedures/templating";
import { announcePromptOutput } from "$app-views/categories/presentation-editor/procedures/prompt-output-events";
import type { Id } from "$app-views/categories/presentation-editor/procedures/prompt-blocks";
import type { PromptSettingsState } from "$app-views/categories/presentation-editor/components/prompt-settings.state.svelte";

export const setPromptScope = async ({
  busy,
  outputId,
  outputPrompt,
  next,
  state,
  refresh
}: {
  busy: boolean;
  outputId: Id<"derivedOutputs">;
  outputPrompt?: string;
  next: unknown;
  state: PromptSettingsState;
  refresh: () => Promise<unknown>;
}): Promise<void> => {
  if (busy || outputPrompt === undefined) return;
  const scope = readableScope(next);
  if (scope === undefined) return;
  state.begin();
  try {
    const changed = await updateDerivedOutput({
      derivedOutputId: outputId,
      prompt: state.promptDraft.trim() || outputPrompt,
      scope
    });
    if (changed === null) throw new Error("The Derived Output no longer exists");
    await refresh();
  } catch (error) {
    state.fail(error);
  } finally {
    announcePromptOutput(outputId);
    state.finish();
  }
};
