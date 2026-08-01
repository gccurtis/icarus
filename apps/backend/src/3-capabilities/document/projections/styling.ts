import type {
  ResolvedStyling,
  RichText,
  TextStyleProperties
} from "#rich-text";
import type {
  BlockStyleProperties,
  DocumentBlock,
  DocumentSnapshot
} from "../domain/model.js";
import { resolveDocumentStyle } from "../domain/reducer.js";

export interface ResolvedDocumentBlockStyle {
  text: TextStyleProperties;
  block: BlockStyleProperties;
}

export type DocumentTextBearingBlock = Extract<
  DocumentBlock,
  { kind: "text" | "code" | "quote" }
>;

export interface ResolvedDocumentTextStyling {
  block: BlockStyleProperties;
  text: ResolvedStyling;
}

/**
 * Resolve the canonical whole-Block overlay without persisting an ephemeral
 * Rich Text mark: kind default, selected Style, then one-off presentation.
 */
export const projectDocumentBlockStyle = (
  snapshot: DocumentSnapshot,
  block: DocumentBlock
): ResolvedDocumentBlockStyle => {
  const defaultStyleId = snapshot.styles.defaultStyleIdByBlockKind[block.kind];
  const base = resolveDocumentStyle(snapshot, defaultStyleId);
  const selected = block.styleId === defaultStyleId
    ? base
    : resolveDocumentStyle(snapshot, block.styleId);

  return {
    text: {
      ...base.text,
      ...(block.styleId === defaultStyleId ? {} : selected.text)
    },
    block: {
      ...base.block,
      ...(block.styleId === defaultStyleId ? {} : selected.block),
      ...(block.presentation ?? {})
    }
  };
};

/**
 * Resolve the complete rendering projection for a text-bearing Block.
 *
 * Rich Text supplies runtime defaults. The resolved kind and selected
 * Document Styles become one authoritative, ephemeral full-range mark, while
 * persisted inline marks remain supplementary. Block presentation is returned
 * alongside the resolved Rich Text ranges and is never written into content.
 */
export const projectDocumentTextStyling = (
  snapshot: DocumentSnapshot,
  block: DocumentTextBearingBlock,
  richText: RichText
): ResolvedDocumentTextStyling => {
  const resolvedBlock = projectDocumentBlockStyle(snapshot, block);
  const blockStyle = richText.fullRangeStyle(
    resolvedBlock.text,
    block.content.atoms,
    `$document-block-style:${block.id}`,
  );
  const inlineLinks = block.content.marks.filter((mark) => mark.kind === "link");
  const supplementary = block.content.marks.filter((mark) => mark.kind !== "link");
  const marks = [
    ...richText.overlayMarks([blockStyle], supplementary, block.content.atoms),
    ...inlineLinks,
  ];

  return {
    block: resolvedBlock.block,
    text: richText.resolveStyling({
      atoms: block.content.atoms,
      marks,
    })
  };
};
