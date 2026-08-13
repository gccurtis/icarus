import type { RichContentStore } from "#rich-content/persistence/store.js";
import type { ReplaceTextInput } from "#rich-content/types/runtime-inputs.js";
import type { ContentMutationResult } from "#rich-content/types/runtime-results.js";
import { replaceAtomText } from "#rich-content/runtime-api/replace-text/replace-atom-text.js";
import {
  commit,
  currentContent,
  nextRevision
} from "#rich-content/runtime-api/shared/revisions.js";

export const replaceText = async (
  store: RichContentStore,
  input: ReplaceTextInput
): Promise<ContentMutationResult> => {
  const current = await currentContent(store, input.contentId, input.expectedVersion);
  return commit(store, current, nextRevision(current, replaceAtomText(current, input)));
};
