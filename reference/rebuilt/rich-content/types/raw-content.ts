/**
 * Raw Content: the canonical, **private** representation of a content object.
 *
 * **None of these types leave the capability.** `index.server.ts` deliberately
 * does not re-export them, and neither does `index.ts`.
 *
 * Two reasons, and the second is the one that matters. A consumer holding a
 * `RawAtom` or a `RawMark` would depend on a representation Rich Content
 * reserves the right to change — and, worse, would be able to construct a
 * `RawPosition` the runtime never validated, addressing an offset inside an atom
 * that does not exist or splitting a surrogate pair. Consumers get the derived
 * [`DisplayContent`](display-content.ts) projection and hand back opaque
 * handles, which are checked on the way in.
 *
 * A two-door split makes it easy to widen a door by accident, so this is
 * restated in `overview.md`.
 */
import type {
  LinkTarget,
  ListPresentation,
  StyleProperties
} from "$rich-content/types/formatting";
import type { AtomId, ListId, RichContentId } from "$rich-content/types/ids";

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

/**
 * Formatting is stored as marks over ranges rather than as nested spans, which
 * is what lets a bold range and a link range overlap partially without either
 * having to be split in storage. `render-display.ts` does the splitting, once,
 * on the way out.
 */
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
