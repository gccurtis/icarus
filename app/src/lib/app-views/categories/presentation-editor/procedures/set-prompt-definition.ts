import type { PresentationRuntime } from "$model/client/workspace-state";
import type { PromptBlock } from "$representation/data/types/content/content-block";
import { promptDefinitionOps } from "$app-views/categories/presentation-editor/procedures/prompt-definition";

/** Keep an unlinked Prompt Block's authored question in represented presentation state. */
export const setPromptDefinition = ({
  block,
  prompt,
  runtime
}: {
  block: PromptBlock;
  prompt: string;
  runtime: PresentationRuntime;
}): void => {
  if (block.derivedOutputId !== undefined) return;
  const ops = promptDefinitionOps(block, prompt);
  if (ops.length > 0) runtime.apply(ops);
};
