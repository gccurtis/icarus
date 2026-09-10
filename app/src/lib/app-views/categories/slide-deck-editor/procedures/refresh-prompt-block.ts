import {
  refreshDerivedOutput,
  updateDerivedOutput
} from "$capabilities/derived-output/index.remote";
import {
  promptBlockIn,
  syncPromptBlockOps,
  type Id,
  type LinkedPromptBlock
} from "$app-views/categories/slide-deck-editor/procedures/prompt-blocks";
import { announcePromptOutput } from "$app-views/categories/slide-deck-editor/procedures/prompt-output-events";
import type { PromptSettingsState } from "$app-views/categories/slide-deck-editor/components/prompt-settings.state.svelte";
import type { SlideDeckRuntime } from "$model/client/workspace-state";
import type { TableRow } from "$representation/store/tables";

const currentPrompt = (runtime: SlideDeckRuntime, blockId: string): LinkedPromptBlock => {
  const body = runtime.body;
  if (body === undefined) throw new Error("The slide deck is not loaded");
  const block = promptBlockIn(body, blockId);
  if (block?.derivedOutputId === undefined) {
    throw new Error("The Prompt Block is no longer linked in the slide deck");
  }
  return block as LinkedPromptBlock;
};

export const refreshPromptBlock = async ({
  busy,
  block,
  blockId,
  output,
  outputId,
  currentResponse,
  definitionChanged,
  responseChanged,
  runtime,
  state
}: {
  busy: boolean;
  block?: LinkedPromptBlock;
  blockId: string;
  output?: TableRow<"derivedOutputs">;
  outputId: Id<"derivedOutputs">;
  currentResponse: string;
  definitionChanged: boolean;
  responseChanged: boolean;
  runtime?: SlideDeckRuntime;
  state: PromptSettingsState;
}): Promise<void> => {
  const prompt = state.promptDraft.trim();
  if (busy || output === undefined || block === undefined || runtime === undefined || !prompt) return;

  state.begin();
  try {
    if (definitionChanged || responseChanged) {
      const changed = await updateDerivedOutput({
        derivedOutputId: outputId,
        prompt,
        ...(responseChanged
          ? { lastResponse: currentResponse.length === 0 ? null : currentResponse }
          : {})
      });
      if (changed === null) throw new Error("The Derived Output no longer exists");
    }
    const refreshed = await refreshDerivedOutput({ derivedOutputId: outputId });
    if (refreshed === null) throw new Error("The Derived Output no longer exists");
    const ops = syncPromptBlockOps(currentPrompt(runtime, blockId), refreshed.output);
    if (ops.length > 0) runtime.apply(ops);
    await runtime.flush();
    if (runtime.sync === "error") throw new Error("The refreshed slide text could not be saved");
    if (refreshed.outcome === "failed") {
      if (refreshed.output.state !== "error") {
        throw new Error("The failed refresh returned a non-error output");
      }
      throw new Error(refreshed.output.error);
    }
    state.promptDraft = refreshed.output.prompt;
    state.hydratedPrompt = refreshed.output.prompt;
  } catch (error) {
    state.fail(error);
  } finally {
    announcePromptOutput(outputId);
    state.finish();
  }
};
