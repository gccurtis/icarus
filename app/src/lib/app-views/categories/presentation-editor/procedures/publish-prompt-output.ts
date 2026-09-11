import { promptBlockIn, syncPromptBlockOps } from "$app-views/categories/presentation-editor/procedures/prompt-blocks";
import type { PresentationRuntime } from "$model/client/workspace-state";
import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";

const publicationChanged = (
  block: NonNullable<ReturnType<typeof promptBlockIn>>,
  output: DerivedOutput
): boolean =>
  !(block.state === "stale" && block.refreshedAt === output.refreshedAt) &&
  (block.state !== output.state ||
    block.refreshedAt !== output.refreshedAt ||
    block.error !== output.error);

/** Publishes a newly observed Derived Output through the presentation's ordinary op stream. */
export const publishPromptOutput = async ({
  blockId,
  output,
  runtime
}: {
  readonly blockId: string;
  readonly output: DerivedOutput;
  readonly runtime: PresentationRuntime;
}): Promise<void> => {
  const body = runtime.body;
  if (body === undefined) return;
  const block = promptBlockIn(body, blockId);
  if (block?.derivedOutputId !== output._id) return;
  if (!publicationChanged(block, output)) return;

  const ops = syncPromptBlockOps(block, output);
  if (ops.length === 0) return;
  runtime.apply(ops);
  await runtime.flush();
  if (runtime.sync === "error") throw new Error("The generated slide text could not be saved");
};
