import type {
  ResolvedStyling,
  RichText,
  TextStyleProperties
} from "#rich-text";
import type {
  DeckSnapshot,
  SlideShape,
  SlideVisualStyleProperties,
  TextShape
} from "../domain/model.js";
import { resolveSlideStyle } from "../domain/reducer.js";

export interface ResolvedSlideShapeStyle {
  visual: SlideVisualStyleProperties;
  text: TextStyleProperties;
}

export interface ResolvedSlideTextStyling {
  visual: SlideVisualStyleProperties;
  text: ResolvedStyling;
}

/** Kind default, selected Style, then the Shape's local presentation overlay. */
export const projectSlideShapeStyle = (
  snapshot: DeckSnapshot,
  shape: SlideShape
): ResolvedSlideShapeStyle => {
  const defaultStyleId = snapshot.styles.defaultStyleIdByShapeKind[shape.shapeKind];
  const kindDefault = resolveSlideStyle(snapshot, defaultStyleId);
  const selected = shape.styleId === defaultStyleId
    ? { visual: {}, text: {} }
    : resolveSlideStyle(snapshot, shape.styleId);
  return {
    visual: {
      ...kindDefault.visual,
      ...selected.visual,
      ...(shape.presentation?.visual ?? {})
    },
    text: {
      ...kindDefault.text,
      ...selected.text,
      ...(shape.presentation?.text ?? {})
    }
  };
};

/**
 * Produces the complete authored-text rendering projection. The Shape overlay
 * is authoritative; persisted inline marks supplement properties it leaves
 * open, while link marks retain their independent targets.
 */
export const projectSlideTextStyling = (
  snapshot: DeckSnapshot,
  shape: TextShape,
  richText: RichText
): ResolvedSlideTextStyling => {
  const resolved = projectSlideShapeStyle(snapshot, shape);
  const shapeStyle = richText.fullRangeStyle(
    resolved.text,
    shape.content.atoms,
    `$slide-shape-style:${shape.id}`
  );
  const links = shape.content.marks.filter((mark) => mark.kind === "link");
  const supplementary = shape.content.marks.filter((mark) => mark.kind !== "link");
  const marks = [
    ...richText.overlayMarks([shapeStyle], supplementary, shape.content.atoms),
    ...links
  ];
  return {
    visual: resolved.visual,
    text: richText.resolveStyling({ atoms: shape.content.atoms, marks })
  };
};
