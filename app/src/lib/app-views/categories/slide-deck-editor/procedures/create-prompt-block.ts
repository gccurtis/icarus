import {
  createDerivedOutput,
  refreshDerivedOutput,
  updateDerivedOutput
} from "$capabilities/derived-output/index.remote";
import {
  linkPromptBlockOps,
  promptBlockIn,
  syncPromptBlockOps,
  type Id
} from "$app-views/categories/slide-deck-editor/procedures/prompt-blocks";
import { readableScope } from "$app-views/categories/slide-deck-editor/procedures/templating";
import { announcePromptOutput } from "$app-views/categories/slide-deck-editor/procedures/prompt-output-events";
import type { PromptBlockState } from "$app-views/categories/slide-deck-editor/inspector/prompt-block.state.svelte";
import type { SlideDeckRuntime } from "$model/client/workspace-state";

const currentPrompt = (runtime: SlideDeckRuntime, blockId: string) => {
  const body = runtime.body;
  if (body === undefined) throw new Error("The slide deck is not loaded");
  const block = promptBlockIn(body, blockId);
  if (block === undefined) throw new Error("The Prompt Block is no longer in the slide deck");
  return block;
};

export const createPromptBlock = async ({
  blockId,
  deckId,
  runtime,
  state
}: {
  blockId: string;
  deckId?: string;
  runtime?: SlideDeckRuntime;
  state: PromptBlockState;
}): Promise<void> => {
  const prompt = state.promptDraft.trim();
  if (runtime === undefined || deckId === undefined || !prompt || state.phase !== undefined) return;
  const previous = currentPrompt(runtime, blockId).display;
  state.phase = "creating";
  state.actionError = undefined;
  let outputId: Id<"derivedOutputs"> | undefined;
  try {
    const scope = readableScope(currentPrompt(runtime, blockId).scope);
    const created = await createDerivedOutput({
      prompt,
      origin: { kind: "slides", id: deckId },
      ...(scope === undefined ? {} : { scope })
    });
    outputId = created._id;
    const seeded = previous.length === 0
      ? created
      : await updateDerivedOutput({
          derivedOutputId: created._id,
          prompt,
          lastResponse: previous
        });
    if (seeded === null) throw new Error("The Derived Output disappeared during creation");

    state.phase = "saving";
    const before = currentPrompt(runtime, blockId);
    runtime.apply([
      ...linkPromptBlockOps(before, created._id),
      ...syncPromptBlockOps(before, seeded)
    ]);
    await runtime.flush();
    if ((runtime.sync as string) === "error") {
      throw new Error("The Prompt Block link could not be saved");
    }

    state.phase = "generating";
    const refreshed = await refreshDerivedOutput({ derivedOutputId: created._id });
    if (refreshed === null) throw new Error("The Derived Output disappeared during generation");
    const ops = syncPromptBlockOps(currentPrompt(runtime, blockId), refreshed.output);
    if (ops.length > 0) runtime.apply(ops);
    await runtime.flush();
    if ((runtime.sync as string) === "error") {
      throw new Error("The generated slide text could not be saved");
    }
    if (refreshed.outcome === "failed") {
      throw new Error(refreshed.output.error ?? "The response could not be generated");
    }
  } catch (error) {
    state.fail(error);
  } finally {
    if (outputId !== undefined) announcePromptOutput(outputId);
    state.phase = undefined;
  }
};
