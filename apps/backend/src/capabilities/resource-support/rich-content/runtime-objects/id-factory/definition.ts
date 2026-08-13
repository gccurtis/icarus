import type {
  AtomId,
  ListId,
  RichContentId
} from "#rich-content/types/ids.js";

/**
 * Allocates every identifier Rich Content owns. Internal: it is injected into
 * the Rich Content runtime and never leaves the capability, which is what lets
 * a test supply a deterministic factory in its place.
 */
export interface RichContentIdFactory {
  contentId(): RichContentId;
  atomId(): AtomId;
  markId(): string;
  listId(): ListId;
}
