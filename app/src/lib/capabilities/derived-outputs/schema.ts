import { defineTable } from "convex/server";
import { v } from "convex/values";
import { blockValidator } from "$content/types/block";
import {
  derivedInputValidator,
  derivedStateValidator,
  inputRevisionValidator
} from "$derived-outputs/types/derived-output";
import { actorValidator } from "$shared/types/actor";
import { setExpressionValidator } from "$shared/types/set-expression";

/**
 * Generated content that stays connected to what it was generated from.
 *
 * **`block` is one block, not a list.** An output fills the position a prompt
 * block occupies, and a position holds one block. Generation that produces a
 * whole section is a different thing — that is authoring a document, and it
 * should produce a document — and a list here would make every consumer handle a
 * variable-length insertion into a body it does not own. It is a block rather
 * than a string so generated content is edited in place with the same editor.
 *
 * **`inputs` and `inputsAt` are two lists on purpose.** The first is what this
 * is derived from, declared; the second is where each of those stood when the
 * content was generated. Staleness is the comparison between them, which is why
 * neither can be read off the other and why no timestamp substitutes for either.
 *
 * **No revision and no history.** A refresh replaces the content wholesale and
 * the generator emits ops for nothing, so there is no log to reconstruct a past
 * generation from — and a partial history, without the inputs and prompt that
 * produced it, could not be trusted to show what it was derived from.
 *
 * `by_project` is the only index because an output is reached by id, from the
 * prompt block that references it; the range read is the project's directory of
 * them.
 */
export const derivedOutputsTables = {
  derivedOutputs: defineTable({
    projectId: v.id("projects"),
    /** The whole instruction, and the only copy of it — a prompt block holds none. */
    prompt: v.string(),
    /** What retrieval may draw on. Absent means the whole project. */
    scope: v.optional(setExpressionValidator),
    inputs: v.array(derivedInputValidator),
    block: blockValidator,
    state: derivedStateValidator,
    /** Why the last attempt failed. The content beside it is what survived from before. */
    error: v.optional(v.string()),
    model: v.optional(v.string()),
    inputsAt: v.array(inputRevisionValidator),
    /** Which lattice a retrieval saw, so a passage can be found at the version it was read at. */
    latticeVersion: v.optional(v.number()),
    /** When this content was generated. `updatedAt` moves for a failed attempt; this does not. */
    refreshedAt: v.optional(v.number()),
    createdBy: actorValidator,
    updatedAt: v.number()
  }).index("by_project", ["projectId"])
};
