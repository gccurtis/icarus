import { randomUUID } from "node:crypto";
import type { RichContentIdFactory } from "#rich-content/runtime-objects/id-factory/definition.js";
import type {
  AtomId,
  ListId,
  RichContentId
} from "#rich-content/types/ids.js";

export const createRichContentIdFactory = (): RichContentIdFactory => ({
  contentId: (): RichContentId => `content_${randomUUID()}`,
  atomId: (): AtomId => `atom_${randomUUID()}`,
  markId: (): string => `mark_${randomUUID()}`,
  listId: (): ListId => `list_${randomUUID()}`
});
