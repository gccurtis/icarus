/**
 * The inputs accepted by `RichContentRuntime`. Every mutation carries the
 * revision the caller believes it is editing, so a stale edit is rejected
 * rather than applied on top of someone else's commit.
 */
import type {
  AtomTextRange,
  DisplayPosition,
  DisplayRange
} from "#rich-content/types/display-content.js";
import type {
  LinkTarget,
  ListPresentation,
  StyleProperties
} from "#rich-content/types/formatting.js";
import type {
  AtomId,
  RichContentId
} from "#rich-content/types/ids.js";

/** One content object at the revision the caller expects it to be at. */
export interface ContentRevision {
  readonly contentId: RichContentId;
  readonly expectedVersion: number;
}

/** A revision-gated mutation over a display selection. */
interface VersionedDisplayMutation {
  readonly contentId: RichContentId;
  readonly expectedVersion: number;
  readonly range: DisplayRange;
}

export interface ReplaceTextInput {
  readonly contentId: RichContentId;
  readonly expectedVersion: number;
  readonly atomId: AtomId;
  readonly range: AtomTextRange;
  readonly text: string;
}

export interface ApplyStyleInput extends VersionedDisplayMutation {
  readonly properties: StyleProperties;
}

export interface RemoveStyleInput extends VersionedDisplayMutation {
  readonly properties: readonly (keyof StyleProperties)[];
}

export interface SetLinkInput extends VersionedDisplayMutation {
  readonly targets: readonly LinkTarget[];
}

export type RemoveLinkInput = VersionedDisplayMutation;

export interface SetListInput extends VersionedDisplayMutation {
  readonly presentation: ListPresentation;
}

export type RemoveListInput = VersionedDisplayMutation;

export interface SplitContentInput extends ContentRevision {
  readonly at: DisplayPosition;
}

export interface CombineAsListInput {
  readonly items: readonly ContentRevision[];
  readonly presentation: ListPresentation;
}
