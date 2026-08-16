import { v, type Infer } from "convex/values";
import type { ContentBlock, TextBlock } from "$content/types/block";
import type { Id } from "$convex/_generated/dataModel";
import { DerivedOutputsError } from "$derived-outputs/errors";
import { resourceTypeValidator } from "$revisions/types/change";
import type { Actor } from "$shared/types/actor";
import { resourceKindValidator } from "$shared/types/resource";
import type { SetExpression } from "$shared/types/set-expression";

/**
 * What an output is derived from, declared rather than inferred.
 *
 * **Nothing here is read off the prompt, and nothing is "whatever the model
 * happened to retrieve".** Declaring the set is what makes staleness
 * computable: without it there is no way to say what would have to change for
 * this output to be wrong, and every output would either refresh constantly or
 * never.
 *
 * A `resource` input names the whole key, because two resources of different
 * kinds may carry the same id. A `question` optionally pulls the findings
 * hanging off it — the question itself is the asking, and its findings are the
 * material.
 *
 * **`lattice` is the exception, and it is a query rather than a set.** "The top
 * passages about pricing" resolves differently over time by design, so an output
 * with only lattice inputs is refreshed on request rather than on a change
 * signal.
 */
export const derivedInputValidator = v.union(
  v.object({ kind: v.literal("file"), fileId: v.id("externalFiles") }),
  v.object({
    kind: v.literal("resource"),
    resourceType: resourceTypeValidator,
    /** `v.string()` because three tables answer to it and a union of id types would make every reader choose. */
    resourceId: v.string()
  }),
  v.object({
    kind: v.literal("question"),
    questionId: v.id("questions"),
    includeFindings: v.optional(v.boolean())
  }),
  v.object({ kind: v.literal("finding"), findingId: v.id("findings") }),
  v.object({ kind: v.literal("lattice"), query: v.string(), limit: v.optional(v.number()) })
);

export type DerivedInput = Infer<typeof derivedInputValidator>;

/**
 * Where an input stood when the content was generated.
 *
 * **Staleness is this compared against the same reading taken now, never a
 * timestamp.** An input whose current revision exceeds the one recorded here is
 * what makes an output `stale`; a row touched without producing a new revision
 * changes nothing.
 *
 * The three members record what each kind of input actually has to compare:
 *
 * - A **resource** is edited in place, so its revision is the comparison. Its
 *   kind is the whole `ResourceKind` union rather than the three general
 *   resources, because a finding is recorded here too — it is durable content
 *   whose writeup is revised in place.
 * - A **file** has no revision and needs none: bytes are immutable and a
 *   replacement is a different row, so the id *is* the revision.
 * - A **finding** recorded by id alone is one a *question* carried. What a
 *   question input contributes is which findings hang off it, so what is
 *   recorded is that membership, and a finding arriving that way is compared as
 *   a set rather than a number.
 *
 * A lattice input records nothing at all, which is why a lattice-only output
 * never goes stale on its own.
 */
export const inputRevisionValidator = v.union(
  v.object({
    kind: v.literal("resource"),
    resourceType: resourceKindValidator,
    /** A string for the reason the input above is: the pair is the key, not the id. */
    resourceId: v.string(),
    revision: v.number()
  }),
  v.object({ kind: v.literal("file"), fileId: v.id("externalFiles") }),
  v.object({ kind: v.literal("finding"), findingId: v.id("findings") })
);

export type InputRevision = Infer<typeof inputRevisionValidator>;

/**
 * Where a generation stands.
 *
 * **`stale` and `error` are not the same thing, and the difference is what a
 * reader is shown.** `stale` means the content is still correct as of its last
 * refresh and its inputs have since moved — perfectly displayable, with a
 * marker. `error` means the last attempt failed and what is shown is whatever
 * survived from before. Neither clears the block.
 *
 * `idle` is a declaration nothing has been asked of yet.
 */
export const derivedStateValidator = v.union(
  v.literal("idle"),
  v.literal("generating"),
  v.literal("fresh"),
  v.literal("stale"),
  v.literal("error")
);

export type DerivedState = Infer<typeof derivedStateValidator>;

/**
 * Generated content that stays connected to what it was generated from.
 *
 * `state` is what a reader is shown, folded: the stored lifecycle state, except
 * that a `fresh` output whose inputs have moved reads as `stale`.
 */
export type DerivedOutput = {
  readonly id: Id<"derivedOutputs">;
  readonly prompt: string;
  readonly scope?: SetExpression;
  readonly inputs: DerivedInput[];
  readonly block: ContentBlock;
  readonly state: DerivedState;
  readonly error?: string;
  readonly model?: string;
  readonly inputsAt: InputRevision[];
  readonly latticeVersion?: number;
  readonly refreshedAt?: number;
  readonly createdBy: Actor;
  readonly updatedAt: number;
};

/**
 * An output as a list renders it — without the content.
 *
 * The block is read through the prompt block presenting it, never through a
 * directory of outputs, and a list is where "which of these need refreshing" is
 * asked.
 */
export type DerivedOutputSummary = Omit<DerivedOutput, "block" | "inputs" | "inputsAt"> & {
  readonly inputCount: number;
};

/**
 * What an author declares. No project and no attribution: both come from the
 * scope, and no `model` — that field says what produced the content, and a
 * declaration has produced nothing.
 */
export type DerivedOutputDraft = {
  readonly prompt: string;
  readonly inputs: DerivedInput[];
  readonly scope?: SetExpression;
};

/**
 * What a generator is given.
 *
 * **`shaping` is the presented copy, passed in and never stored here.** It is
 * the prompt block's own text — edited by whoever is reading it — and it goes to
 * the generator as the shape to preserve, so a refresh updates the facts without
 * discarding the phrasing someone chose.
 */
export type GenerationRequest = {
  readonly outputId: Id<"derivedOutputs">;
  readonly prompt: string;
  readonly scope?: SetExpression;
  readonly inputs: DerivedInput[];
  readonly shaping?: ContentBlock;
};

/** What a generator produced. `inputsAt` is not here: it is read, never reported. */
export type Generation = {
  readonly block: ContentBlock | ContentBlock[];
  readonly model?: string;
  readonly latticeVersion?: number;
};

/** A generator's answer before it has been checked to be one block. */
export type ContentBlockOrList = ContentBlock | ContentBlock[];

/**
 * The one block's id, in the output's own id space.
 *
 * One block means one id, and nothing addresses it — a comment anchors to the
 * prompt block presenting this, and no change set edits an output. A
 * generator-chosen id would look like an identity surviving a refresh, and none
 * does.
 */
export const GENERATED_BLOCK_ID = "generated";

/** What an output shows before anything has been generated into it. */
export const emptyBlock = (): TextBlock => ({
  id: GENERATED_BLOCK_ID,
  type: "text",
  variant: "paragraph",
  atoms: [],
  display: "",
  marks: []
});

/**
 * The stored form of a prompt: trimmed, and never empty.
 *
 * It lives only here — a prompt block does not carry a copy, because two prompts
 * can disagree about what produced the text — so an empty one is a declaration
 * nothing can ever generate from.
 */
export const derivedPrompt = (prompt: string): string => {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    throw new DerivedOutputsError("empty-prompt", "A derived output has to say what to generate");
  }
  return trimmed;
};

/**
 * The stored form of a declared input set.
 *
 * An empty set is legal: a prompt over no declared material is still a prompt,
 * and it is refreshed on request like a lattice-only one. What is refused is a
 * lattice input that cannot retrieve anything — a blank query, or a limit that
 * admits nothing — because both would be silently ignored at generation time.
 */
export const derivedInputs = (inputs: DerivedInput[]): DerivedInput[] =>
  inputs.map((input) => {
    if (input.kind !== "lattice") return input;
    const query = input.query.trim();
    if (query.length === 0) {
      throw new DerivedOutputsError("empty-query", "A lattice input has to say what to search for");
    }
    if (input.limit !== undefined && input.limit < 1) {
      throw new DerivedOutputsError(
        "lattice-limit",
        `A lattice input asking for ${input.limit} passages would retrieve nothing`
      );
    }
    return { ...input, query };
  });

/**
 * The stored form of a generation's content: exactly one block.
 *
 * **A list is refused rather than truncated or spread.** The output fills the
 * position a prompt block occupies and a position holds one block; generation
 * that produces a whole section is authoring a document, and should produce a
 * document. The check is here rather than only at the door because the block is
 * parsed out of a model's answer, where several is exactly what will sometimes
 * come back.
 */
export const derivedBlock = (block: ContentBlockOrList): ContentBlock => {
  if (Array.isArray(block)) {
    throw new DerivedOutputsError(
      "block-list",
      `A derived output holds one block, and this generation produced ${block.length}`
    );
  }
  return { ...block, id: GENERATED_BLOCK_ID };
};
