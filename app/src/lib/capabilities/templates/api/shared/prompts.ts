import type { StoreModel } from "$model/server/store/index.server";
import { asId } from "$representation/data/behavior/core/id";
import { needsRow } from "$representation/data/behavior/core/scope-draft";
import { portableBodyOf } from "$representation/data/behavior/templates/portable";
import type { Actor } from "$representation/data/types/core/actor";
import {
  mergedPromptHoles,
  promptHolesOf,
  textHolesOf,
  withAsks,
  withPromptHoles
} from "$representation/data/behavior/templates/prompt-holes";
import type { TemplateHole } from "$representation/data/types/templates/template";

import { normalizeScope } from "$capabilities/templates/api/shared/scopes";
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

/**
 * A placed copy's prompts, linked to derived outputs of their own.
 *
 * A template carries a prompt's definition and not the row that holds it, the
 * way it carries a formula's expression and not its instance. Placing one makes
 * a fresh derived output from the definition and links the copy's block to it,
 * so the copy is a working prompt from the moment it lands rather than words
 * somebody has to type again.
 */
export const withFreshOutputs = <T>(
  store: StoreModel,
  projectId: string,
  actor: Actor,
  origin: { kind: string; id: string },
  body: T,
  at: number
): { readonly body: T; readonly written: readonly string[] } => {
  const written: string[] = [];
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(walk);
    if (!isRecord(value)) return value;
    const next: Fields = {};
    for (const [field, nested] of Object.entries(value)) next[field] = walk(nested);
    if (value.type !== "prompt") return next;
    const asks = typeof value.asks === "string" ? value.asks.trim() : "";
    if (asks === "") return next;
    const id = store.create("derivedOutputs", {
      projectId: asId<"projects">(projectId),
      prompt: asks,
      definitionRevision: 1,
      origin,
      ...(isRecord(value.scope) ? { scope: value.scope } : {}),
      queries: [],
      evidence: [],
      state: "idle",
      createdBy: actor,
      updatedAt: at
    });
    written.push(id);
    return { ...next, derivedOutputId: id };
  };
  return { body: walk(body) as T, written };
};

export type TemplatedBody<T> = {
  readonly body: T;
  readonly dropped: readonly string[];
  readonly holes: readonly TemplateHole[];
};

/**
 * A live body as a template holds it: portable, and asking rather than telling.
 *
 * The order matters. The holes are read first, so a hole's default is the scope
 * as the prompt actually reads it. The question is copied next, while the link
 * to the derived output still exists. Only then is the body made portable, and
 * each templated prompt's scope replaced by the hole that stands for it.
 */
/**
 * A hole's default, once the template it belongs to has an identity.
 *
 * The default is whatever the prompt read, and what a prompt reads can name
 * particular resources — which the templated vocabulary has no term for. Those
 * are written as a `resourceSets` row owned by the hole and pointed at by a
 * single `set` term, the same way a default built in the scope builder is. It
 * has to happen after the template row exists, because the row is owned by it.
 */
export const settledHoleDefaults = (
  store: StoreModel,
  projectId: string,
  actor: Actor,
  templateId: string,
  holes: readonly TemplateHole[],
  at: number
): readonly TemplateHole[] =>
  holes.map((hole) => {
    if (hole.default === undefined || !needsRow(hole.default)) return hole;
    const written = normalizeScope(
      store,
      projectId,
      actor,
      { kind: "hole", templateId: asId<"templates">(templateId), hole: hole.name },
      hole.default,
      at
    );
    return written === undefined ? hole : { ...hole, default: written.term };
  });

export const templatedBodyOf = <T>(
  store: StoreModel,
  candidate: T,
  known: readonly TemplateHole[]
): TemplatedBody<T> => {
  const drafts = promptHolesOf(candidate);
  const asked = withAsks(candidate, askedBy(store, candidate));
  const portable = portableBodyOf(asked);
  const body = withPromptHoles(portable.body, drafts);
  const fresh = [...drafts.map((draft) => draft.hole), ...textHolesOf(body)];
  return { body, dropped: portable.dropped, holes: mergedPromptHoles(known, fresh) };
};
