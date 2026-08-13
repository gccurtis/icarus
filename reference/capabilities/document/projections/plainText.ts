import type { RichText } from "#rich-text";
import type { DocumentSnapshot } from "../domain/model.js";
import { forEachBlock } from "../domain/tree.js";

export const projectDocumentPlainText = (
  snapshot: DocumentSnapshot,
  richText: RichText
): string => {
  const parts: string[] = [];
  forEachBlock(snapshot, (block) => {
    if (block.kind === "text" || block.kind === "quote" || block.kind === "code") {
      parts.push(richText.plainText(block.content.atoms));
    } else if (block.kind === "image" && block.image.alt) {
      parts.push(block.image.alt);
    } else if (block.kind === "chart" && block.chart.alt) {
      parts.push(block.chart.alt);
    }
  });
  return parts.filter(Boolean).join("\n");
};
