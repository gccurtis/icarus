import { messageOf } from "$app-views/categories/agents/procedures/agents";

/**
 * What a command needs of the surface that asked for it.
 *
 * Structural on purpose: a content surface's own state owner satisfies it, and
 * so does a panel holding three bindings, without either knowing about the other.
 */
export type Working = {
  /** False once the surface is gone, so a late answer writes nothing. */
  mounted: boolean;
  /** What is in flight, named so a surface can say which control is busy. */
  busy: string | undefined;
  failure: string | undefined;
};

const detailOf = (result: { readonly accepted: boolean }): string => {
  const detail = (result as { readonly detail?: unknown }).detail;
  return typeof detail === "string" ? detail : "That did not go through.";
};

/**
 * One durable command, with the surface's account of it.
 *
 * Every write in this category refuses rather than throws, so a refusal is a
 * message to read and a thrown error is a fault. Both end up in the same place,
 * and neither is written back to a surface that has already gone.
 */
export const run = async <T extends { readonly accepted: boolean }>(
  state: Working,
  label: string,
  command: () => Promise<T>,
  then?: (result: Extract<T, { readonly accepted: true }>) => void
): Promise<void> => {
  if (state.busy !== undefined) return;
  state.busy = label;
  state.failure = undefined;
  try {
    const result = await command();
    if (!state.mounted) return;
    if (result.accepted) then?.(result as Extract<T, { readonly accepted: true }>);
    else state.failure = detailOf(result);
  } catch (error) {
    if (state.mounted) state.failure = messageOf(error);
  } finally {
    if (state.mounted) state.busy = undefined;
  }
};
