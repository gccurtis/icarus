import { blockIn } from "$app-views/categories/document-editor/procedures/blocks";
import { syncPromptBlockOps } from "$app-views/categories/document-editor/procedures/prompt-blocks";
import type { DocumentRuntime } from "$model/client/workspace-state";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";

const publicationChanged = (
  block: NonNullable<ReturnType<typeof blockIn>>,
  output: DerivedOutput
): boolean =>
  block.type === "prompt" &&
  !(block.state === "stale" && block.refreshedAt === output.refreshedAt) &&
  (block.state !== output.state ||
    block.refreshedAt !== output.refreshedAt ||
    block.error !== output.error);

/** Publishes a newly observed Derived Output through the document's ordinary op stream. */
export const publishPromptOutput = async ({
  blockId,
  output,
  runtime
}: {
  readonly blockId: string;
  readonly output: DerivedOutput;
  readonly runtime: DocumentRuntime;
}): Promise<void> => {
  const body = runtime.body;
  if (body === undefined) return;
  const block = blockIn(body, blockId);
  if (block?.type !== "prompt" || block.derivedOutputId !== output._id) return;
  if (!publicationChanged(block, output)) return;

  const ops = syncPromptBlockOps(block, output);
  if (ops.length === 0) return;
  runtime.apply(ops);
  await runtime.flush();
  if (runtime.failure !== undefined) throw new Error(runtime.failure.detail);
};
