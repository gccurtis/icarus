import { readDerivedOutput } from "$capabilities/derived-output/index.remote";
import type { Id } from "$app-views/categories/document-editor/procedures/prompt-blocks";

export const readPromptOutput = (derivedOutputId: Id<"derivedOutputs">) =>
  readDerivedOutput({ derivedOutputId });
