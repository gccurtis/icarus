import {
  refreshDerivedOutput,
  updateDerivedOutput
} from "$capabilities/derived-output/index.remote";
import { blockIn } from "$app-views/categories/document-editor/procedures/blocks";
import {
  syncPromptBlockOps,
  type Id,
  type LinkedPromptBlock
} from "$app-views/categories/document-editor/procedures/prompt-blocks";
import { announcePromptOutput } from "$app-views/categories/document-editor/procedures/prompt-output-events";
import type { PromptSettingsState } from "$app-views/categories/document-editor/components/prompt-settings.state.svelte";
import type { DocumentRuntime } from "$model/client/workspace-state";
import type { TableRow } from "$representation/store/tables";

const currentPrompt = (runtime: DocumentRuntime, blockId: string): LinkedPromptBlock => {
  const body = runtime.body;
  if (body === undefined) throw new Error("The document is not loaded");
  const block = blockIn(body, blockId);
  if (block?.type !== "prompt" || block.derivedOutputId === undefined) {
    throw new Error("The Prompt Block is no longer linked in the document");
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
  runtime?: DocumentRuntime;
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
    if (runtime.failure !== undefined) throw new Error(runtime.failure.detail);
    if (refreshed.outcome === "failed") {
      throw new Error(refreshed.output.error ?? "The response could not be generated");
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
