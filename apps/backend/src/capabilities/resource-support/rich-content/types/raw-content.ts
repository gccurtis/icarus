/**
 * Raw Content: the canonical, private representation of a content object.
 *
 * None of these types leave the capability. `index.ts` deliberately does not
 * re-export them, because a consumer holding a `RawAtom` or a `RawMark` would
 * be depending on a representation Rich Content reserves the right to change,
 * and would be able to construct positions the runtime never validated.
 * Consumers receive the derived `DisplayContent` projection instead.
 */
import type {
  LinkTarget,
  ListPresentation,
  StyleProperties
} from "#rich-content/types/formatting.js";
import type {
  AtomId,
  ListId,
  RichContentId
} from "#rich-content/types/ids.js";

export interface TextAtom {
  readonly id: AtomId;
  readonly kind: "text";
  readonly text: string;
}

export interface LineBreakAtom {
  readonly id: AtomId;
  readonly kind: "line-break";
}

export type RawAtom = TextAtom | LineBreakAtom;

export interface RawPosition {
  readonly atomId: AtomId;
  readonly offset: number;
}

export interface RawRange {
  readonly start: RawPosition;
  readonly end: RawPosition;
}

interface RawMarkBase {
  readonly id: string;
  readonly range: RawRange;
}

export interface StyleMark extends RawMarkBase {
  readonly kind: "style";
  readonly properties: StyleProperties;
}

export interface LinkMark extends RawMarkBase {
  readonly kind: "link";
  readonly targets: readonly LinkTarget[];
}

export interface ListItemMark extends RawMarkBase {
  readonly kind: "list-item";
  readonly listId: ListId;
  readonly presentation: ListPresentation;
}

export type RawMark = StyleMark | LinkMark | ListItemMark;

export interface RawContent {
  readonly id: RichContentId;
  readonly version: number;
  readonly atoms: readonly RawAtom[];
  readonly marks: readonly RawMark[];
}

/** One logical line, derived from atom order. Never stored. */
export interface RawLine {
  readonly index: number;
  readonly atoms: readonly TextAtom[];
}
