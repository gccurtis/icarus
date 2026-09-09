import type { StoreModel } from "$model/server/store/index.server";
import { portableBodyOf } from "$representation/data/behavior/templates/portable";
import {
  mergedPromptHoles,
  promptHolesOf,
  withAsks,
  withPromptHoles
} from "$representation/data/behavior/templates/prompt-holes";
import type { TemplateHole } from "$representation/data/types/templates/template";

import { recordsIn } from "$capabilities/templates/api/shared/store";

type Fields = Record<string, unknown>;

const isRecord = (value: unknown): value is Fields =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * The question each prompt asks, read from the derived output it is linked to.
 *
 * The words are the output's, not the block's: the block holds the answer. A
 * template keeps neither the link nor the answer, so this is the one moment the
 * words can be taken, and it has to happen while the link is still there.
 */
const askedBy = (store: StoreModel, body: unknown): Readonly<Record<string, string>> => {
  const wanted = new Map<string, string>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }
    if (!isRecord(value)) return;
    if (value.type === "prompt" && typeof value.id === "string") {
      const linked = value.derivedOutputId;
      if (typeof linked === "string") wanted.set(linked, value.id);
      else if (typeof value.asks === "string") wanted.set(`self:${value.id}`, value.id);
    }
    for (const nested of Object.values(value)) walk(nested);
  };
  walk(body);
  if (wanted.size === 0) return {};

  const words: Record<string, string> = {};
  for (const row of recordsIn(store, "derivedOutputs")) {
    const id = typeof row._id === "string" ? row._id : undefined;
    const blockId = id === undefined ? undefined : wanted.get(id);
    if (blockId === undefined) continue;
    if (typeof row.prompt === "string") words[blockId] = row.prompt;
  }
  return words;
};

export type TemplatedBody<T> = {
  readonly body: T;
  readonly dropped: readonly string[];
  readonly holes: readonly TemplateHole[];
};

/**
 * A live body as a template holds it: portable, and asking rather than telling.
 *
 * The order matters. The holes are read first, because whether a prompt's scope
 * survives portability is exactly what decides whether its hole gets a default.
 * The words are copied next, while the link to the derived output still exists.
 * Only then is the body made portable and each prompt's scope replaced by the
 * hole that stands for it.
 */
export const templatedBodyOf = <T>(
  store: StoreModel,
  candidate: T,
  known: readonly TemplateHole[]
): TemplatedBody<T> => {
  const drafts = promptHolesOf(candidate);
  const asked = withAsks(candidate, askedBy(store, candidate));
  const portable = portableBodyOf(asked);
  return {
    body: withPromptHoles(portable.body, drafts),
    dropped: portable.dropped,
    holes: mergedPromptHoles(known, drafts)
  };
};
