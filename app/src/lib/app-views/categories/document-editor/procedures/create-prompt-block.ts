import {
  createDerivedOutput,
  refreshDerivedOutput,
  updateDerivedOutput
} from "$capabilities/derived-output/index.remote";
import { blockIn } from "$app-views/categories/document-editor/procedures/blocks";
import {
  linkPromptBlockOps,
  syncPromptBlockOps,
  type Id,
  type PromptBlock
} from "$app-views/categories/document-editor/procedures/prompt-blocks";
import { readableScope } from "$app-views/categories/document-editor/procedures/templating";
import { announcePromptOutput } from "$app-views/categories/document-editor/procedures/prompt-output-events";
import type { PromptBlockState } from "$app-views/categories/document-editor/inspector/prompt-block.state.svelte";
import type { DocumentRuntime } from "$model/client/workspace-state";

const currentPrompt = (runtime: DocumentRuntime, blockId: string): PromptBlock => {
  const body = runtime.body;
  if (body === undefined) throw new Error("The document is not loaded");
  const block = blockIn(body, blockId);
  if (block?.type !== "prompt") throw new Error("The Prompt Block is no longer in the document");
  return block;
};

export const createPromptBlock = async ({
  blockId,
  documentId,
  runtime,
  state
}: {
  blockId: string;
  documentId?: string;
  runtime?: DocumentRuntime;
  state: PromptBlockState;
}): Promise<void> => {
  const prompt = state.promptDraft.trim();
  if (runtime === undefined || documentId === undefined || !prompt || state.phase !== undefined) return;
  const previous = currentPrompt(runtime, blockId).display;
  state.phase = "creating";
  state.actionError = undefined;
  let outputId: Id<"derivedOutputs"> | undefined;
  try {
    const scope = readableScope(currentPrompt(runtime, blockId).scope);
    const created = await createDerivedOutput({
      prompt,
      origin: { kind: "document", id: documentId },
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
    const linkFailure = runtime.failure as { readonly detail: string } | undefined;
    if (linkFailure !== undefined) throw new Error(linkFailure.detail);

    state.phase = "generating";
    const refreshed = await refreshDerivedOutput({ derivedOutputId: created._id });
    if (refreshed === null) throw new Error("The Derived Output disappeared during generation");
    const ops = syncPromptBlockOps(currentPrompt(runtime, blockId), refreshed.output);
    if (ops.length > 0) runtime.apply(ops);
    await runtime.flush();
    const responseFailure = runtime.failure as { readonly detail: string } | undefined;
    if (responseFailure !== undefined) throw new Error(responseFailure.detail);
    if (refreshed.outcome === "failed") {
      if (refreshed.output.state !== "error") {
        throw new Error("The failed refresh returned a non-error output");
      }
      throw new Error(refreshed.output.error);
    }
  } catch (error) {
    state.fail(error);
  } finally {
    if (outputId !== undefined) announcePromptOutput(outputId);
    state.phase = undefined;
  }
};
