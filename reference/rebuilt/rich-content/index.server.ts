/**
 * The server door for Rich Content.
 *
 * Reached by import, from load functions, form actions, and other capabilities.
 * Every function exported here has a directory under `api/`, and lint checks
 * both directions.
 *
 * **Raw Content is deliberately absent.** `RawAtom`, `RawMark`, `RawContent`,
 * `RawPosition`, `RawRange`, and `RawLine` are the private representation, and a
 * consumer holding one could construct positions the runtime never validated.
 * Consumers get `DisplayContent` and hand back opaque handles, which are checked
 * on the way in. A two-door split makes it easy to widen a door by accident, so
 * this is worth re-reading before adding a line here.
 */
export { RichContentError, type RichContentErrorCode } from "$rich-content/errors";
export { applyStyle } from "$rich-content/api/apply-style/apply-style";
export { combineAsList } from "$rich-content/api/combine-as-list/combine-as-list";
export { create } from "$rich-content/api/create/create";
export { display } from "$rich-content/api/display/display";
export { removeLink } from "$rich-content/api/remove-link/remove-link";
export { removeList } from "$rich-content/api/remove-list/remove-list";
export { removeStyle } from "$rich-content/api/remove-style/remove-style";
export { replaceText } from "$rich-content/api/replace-text/replace-text";
export { setLink } from "$rich-content/api/set-link/set-link";
export { setList } from "$rich-content/api/set-list/set-list";
export { split } from "$rich-content/api/split/split";
export type {
  AtomTextRange,
  DisplayContent,
  DisplayLine,
  DisplayListItem,
  DisplayPosition,
  DisplayRange,
  DisplaySegment,
  TextDisplaySegment
} from "$rich-content/types/display-content";
export type {
  LinkTarget,
  ListPresentation,
  ResolvedStyle,
  StyleProperties
} from "$rich-content/types/formatting";
export type { AtomId, RichContentId } from "$rich-content/types/ids";
export type {
  ApplyStyleInput,
  CombineAsListInput,
  ContentRevision,
  RemoveLinkInput,
  RemoveListInput,
  RemoveStyleInput,
  ReplaceTextInput,
  SetLinkInput,
  SetListInput,
  SplitContentInput
} from "$rich-content/types/inputs";
export type { ContentMutationResult, SplitContentResult } from "$rich-content/types/results";
export { initializeRichContent } from "$rich-content/persistence/initialize";
