import { errorFields, type Logger } from "#observability";
import { RichContentError } from "#rich-content/errors.js";
import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type { DisplayContent } from "#rich-content/types/display-content.js";
import type { RichContentId } from "#rich-content/types/ids.js";
import type {
  ApplyStyleInput,
  CombineAsListInput,
  RemoveLinkInput,
  RemoveListInput,
  RemoveStyleInput,
  ReplaceTextInput,
  SetLinkInput,
  SetListInput,
  SplitContentInput
} from "#rich-content/types/runtime-inputs.js";
import type {
  ContentMutationResult,
  SplitContentResult
} from "#rich-content/types/runtime-results.js";
import { applyStyle } from "#rich-content/runtime-api/apply-style/apply-style.js";
import { combineAsList } from "#rich-content/runtime-api/combine-as-list/combine-as-list.js";
import { create } from "#rich-content/runtime-api/create/create.js";
import { display } from "#rich-content/runtime-api/display/display.js";
import { removeLink } from "#rich-content/runtime-api/remove-link/remove-link.js";
import { removeList } from "#rich-content/runtime-api/remove-list/remove-list.js";
import { removeStyle } from "#rich-content/runtime-api/remove-style/remove-style.js";
import { replaceText } from "#rich-content/runtime-api/replace-text/replace-text.js";
import { setLink } from "#rich-content/runtime-api/set-link/set-link.js";
import { setList } from "#rich-content/runtime-api/set-list/set-list.js";
import { split } from "#rich-content/runtime-api/split/split.js";

export interface RichContentRuntime {
  create(initialText?: string): Promise<ContentMutationResult>;
  replaceText(input: ReplaceTextInput): Promise<ContentMutationResult>;
  applyStyle(input: ApplyStyleInput): Promise<ContentMutationResult>;
  removeStyle(input: RemoveStyleInput): Promise<ContentMutationResult>;
  setLink(input: SetLinkInput): Promise<ContentMutationResult>;
  removeLink(input: RemoveLinkInput): Promise<ContentMutationResult>;
  setList(input: SetListInput): Promise<ContentMutationResult>;
  removeList(input: RemoveListInput): Promise<ContentMutationResult>;
  split(input: SplitContentInput): Promise<SplitContentResult>;
  combineAsList(input: CombineAsListInput): Promise<ContentMutationResult>;
  display(id: RichContentId): Promise<DisplayContent>;
}

/**
 * Records one call: what it was asked for, and how it ended.
 *
 * **No text is recorded.** Rich Content holds authored prose, and a log is
 * copied, shipped, and kept far longer than the content it describes. What goes
 * in a record is identity, the revision a caller expected, sizes, and outcome
 * codes — enough to reconstruct which call happened and why it was refused,
 * without reproducing what someone wrote.
 */
const record = async <T>(
  logger: Logger,
  method: string,
  input: Record<string, unknown>,
  run: () => Promise<T>,
  output: (result: T) => Record<string, unknown>
): Promise<T> => {
  logger.debug(`rich-content.${method}.started`, input);

  try {
    const result = await run();
    logger.debug(`rich-content.${method}.completed`, { ...input, ...output(result) });
    return result;
  } catch (error) {
    // A stale version or an invalid range is an answer this capability chose and
    // states with a code. Anything else is a fault, and reads as one.
    if (error instanceof RichContentError) {
      logger.warn(`rich-content.${method}.rejected`, { ...input, errorCode: error.code });
    } else {
      logger.error(`rich-content.${method}.failed`, { ...input, ...errorFields(error) });
    }
    throw error;
  }
};

/** The identity and revision fields every mutation reports. */
const revisionOf = (result: ContentMutationResult): Record<string, unknown> => ({
  contentId: result.contentId,
  version: result.version
});

/**
 * Holds the dependencies every procedure needs and does nothing else. Each
 * method hands them to its `runtime-api` entry, which owns that method's whole
 * procedure; no algorithm, store query, or revision decision lives here.
 */
export class PersistedRichContentRuntime implements RichContentRuntime {
  constructor(
    private readonly store: RichContentStore,
    private readonly ids: RichContentIdFactory,
    private readonly logger: Logger
  ) {}

  create(initialText?: string): Promise<ContentMutationResult> {
    return record(
      this.logger,
      "create",
      { textLength: initialText?.length ?? 0 },
      () => create(this.store, this.ids, initialText),
      revisionOf
    );
  }

  replaceText(input: ReplaceTextInput): Promise<ContentMutationResult> {
    return record(
      this.logger,
      "replace-text",
      {
        contentId: input.contentId,
        expectedVersion: input.expectedVersion,
        atomId: input.atomId,
        textLength: input.text.length
      },
      () => replaceText(this.store, input),
      revisionOf
    );
  }

  applyStyle(input: ApplyStyleInput): Promise<ContentMutationResult> {
    return record(
      this.logger,
      "apply-style",
      {
        contentId: input.contentId,
        expectedVersion: input.expectedVersion,
        properties: Object.keys(input.properties)
      },
      () => applyStyle(this.store, this.ids, input),
      revisionOf
    );
  }

  removeStyle(input: RemoveStyleInput): Promise<ContentMutationResult> {
    return record(
      this.logger,
      "remove-style",
      {
        contentId: input.contentId,
        expectedVersion: input.expectedVersion,
        properties: input.properties
      },
      () => removeStyle(this.store, this.ids, input),
      revisionOf
    );
  }

  setLink(input: SetLinkInput): Promise<ContentMutationResult> {
    return record(
      this.logger,
      "set-link",
      {
        contentId: input.contentId,
        expectedVersion: input.expectedVersion,
        targets: input.targets.length
      },
      () => setLink(this.store, this.ids, input),
      revisionOf
    );
  }

  removeLink(input: RemoveLinkInput): Promise<ContentMutationResult> {
    return record(
      this.logger,
      "remove-link",
      { contentId: input.contentId, expectedVersion: input.expectedVersion },
      () => removeLink(this.store, this.ids, input),
      revisionOf
    );
  }

  setList(input: SetListInput): Promise<ContentMutationResult> {
    return record(
      this.logger,
      "set-list",
      {
        contentId: input.contentId,
        expectedVersion: input.expectedVersion,
        presentation: input.presentation.kind
      },
      () => setList(this.store, this.ids, input),
      revisionOf
    );
  }

  removeList(input: RemoveListInput): Promise<ContentMutationResult> {
    return record(
      this.logger,
      "remove-list",
      { contentId: input.contentId, expectedVersion: input.expectedVersion },
      () => removeList(this.store, input),
      revisionOf
    );
  }

  split(input: SplitContentInput): Promise<SplitContentResult> {
    return record(
      this.logger,
      "split",
      { contentId: input.contentId, expectedVersion: input.expectedVersion },
      () => split(this.store, this.ids, input),
      (result) => ({
        // The source is consumed; these are the two objects that replace it.
        leftContentId: result.left.contentId,
        rightContentId: result.right.contentId
      })
    );
  }

  combineAsList(input: CombineAsListInput): Promise<ContentMutationResult> {
    return record(
      this.logger,
      "combine-as-list",
      { items: input.items.length, presentation: input.presentation.kind },
      () => combineAsList(this.store, this.ids, input),
      revisionOf
    );
  }

  display(id: RichContentId): Promise<DisplayContent> {
    return record(
      this.logger,
      "display",
      { contentId: id },
      () => display(this.store, id),
      (content) => ({ version: content.version })
    );
  }
}
