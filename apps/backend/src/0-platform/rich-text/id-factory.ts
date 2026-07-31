// RichTextIdFactory — generates stable IDs for atoms and marks.

import { randomUUID } from "node:crypto";
import type { RichTextIdFactory } from "./types.js";

export function createRichTextIdFactory(): RichTextIdFactory {
  return {
    atomId: () => randomUUID(),
    markId: () => randomUUID(),
  };
}