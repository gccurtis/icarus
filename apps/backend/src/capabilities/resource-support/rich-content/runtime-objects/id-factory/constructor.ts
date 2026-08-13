import type { IdFactory } from "#id-factory";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type {
  AtomId,
  ListId,
  RichContentId
} from "#rich-content/types/ids.js";

/**
 * Builds the capability's semantic factory over the shared generator.
 *
 * The values come from Platform ID Factory; the four kinds, their names, and
 * their prefixes are Rich Content's and stay here. The prefixes are what make
 * an ID self-describing in a stored JSONB row and in a log line.
 */
export const createRichContentIdFactory = (
  ids: IdFactory
): RichContentIdFactory => ({
  contentId: (): RichContentId => `content_${ids.create()}`,
  atomId: (): AtomId => `atom_${ids.create()}`,
  markId: (): string => `mark_${ids.create()}`,
  listId: (): ListId => `list_${ids.create()}`
});
