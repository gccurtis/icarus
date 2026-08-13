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
 * Holds the two dependencies every procedure needs and does nothing else. Each
 * method hands them to its `runtime-api` entry, which owns that method's whole
 * procedure; no algorithm, store query, or revision decision lives here.
 */
export class PersistedRichContentRuntime implements RichContentRuntime {
  constructor(
    private readonly store: RichContentStore,
    private readonly ids: RichContentIdFactory
  ) {}

  create(initialText?: string): Promise<ContentMutationResult> {
    return create(this.store, this.ids, initialText);
  }

  replaceText(input: ReplaceTextInput): Promise<ContentMutationResult> {
    return replaceText(this.store, input);
  }

  applyStyle(input: ApplyStyleInput): Promise<ContentMutationResult> {
    return applyStyle(this.store, this.ids, input);
  }

  removeStyle(input: RemoveStyleInput): Promise<ContentMutationResult> {
    return removeStyle(this.store, this.ids, input);
  }

  setLink(input: SetLinkInput): Promise<ContentMutationResult> {
    return setLink(this.store, this.ids, input);
  }

  removeLink(input: RemoveLinkInput): Promise<ContentMutationResult> {
    return removeLink(this.store, this.ids, input);
  }

  setList(input: SetListInput): Promise<ContentMutationResult> {
    return setList(this.store, this.ids, input);
  }

  removeList(input: RemoveListInput): Promise<ContentMutationResult> {
    return removeList(this.store, input);
  }

  split(input: SplitContentInput): Promise<SplitContentResult> {
    return split(this.store, this.ids, input);
  }

  combineAsList(input: CombineAsListInput): Promise<ContentMutationResult> {
    return combineAsList(this.store, this.ids, input);
  }

  display(id: RichContentId): Promise<DisplayContent> {
    return display(this.store, id);
  }
}
