import type { RichText } from "#rich-text";
import type { DocumentSnapshot, DocumentSystemStyleRole } from "../domain/model.js";
import { forEachBlock } from "../domain/tree.js";

export interface DocumentOutlineItem {
  blockId: string;
  level: number;
  text: string;
}

const levelOf = (role?: DocumentSystemStyleRole): number | undefined =>
  role ? Number(role.slice("heading-".length)) : undefined;

export const projectDocumentOutline = (
  snapshot: DocumentSnapshot,
  richText: RichText
): DocumentOutlineItem[] => {
  const styles = new Map(snapshot.styles.styles.map((style) => [style.id, style]));
  const items: DocumentOutlineItem[] = [];
  forEachBlock(snapshot, (block) => {
    if (block.kind !== "text") return;
    const level = levelOf(styles.get(block.styleId)?.systemRole);
    if (!level) return;
    items.push({ blockId: block.id, level, text: richText.plainText(block.content.atoms) });
  });
  return items;
};
