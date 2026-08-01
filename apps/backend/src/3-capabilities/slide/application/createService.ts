import type {
  DeckSnapshot,
  SlideCanvas,
  SlideOptions,
  SlideShapeKind,
  SlideStyle,
  SlideStyleRegistry
} from "../domain/model.js";
import { SlideValidationError } from "../domain/errors.js";
import { isSafeSlideIdentity } from "../domain/validation.js";

export const DEFAULT_SLIDE_CANVAS: SlideCanvas = {
  widthPt: 960,
  heightPt: 540
};

export const DEFAULT_SLIDE_OPTIONS: SlideOptions = {
  history: {
    retainedBaseCount: 5,
    retainedChangeSetCount: 1_000,
    retainedTerminalAttemptCount: 500
  },
  limits: {
    maxSlidesPerDeck: 500,
    maxElementsPerSlide: 1_000,
    maxGroupNestingDepth: 10,
    maxStylesPerDeck: 200,
    maxAtomsPerRichContent: 10_000,
    maxAcceptedValueNodes: 25_000,
    maxFrameDimensionPt: 10_000
  }
};

const style = (
  id: string,
  name: string,
  visual: SlideStyle["visual"],
  text: SlideStyle["text"],
  basedOnStyleId?: string
): SlideStyle => ({
  id,
  name,
  visual,
  text,
  ...(basedOnStyleId ? { basedOnStyleId } : {})
});

export const createDefaultSlideStyles = (): SlideStyleRegistry => {
  const text = "slide-style-text";
  const geometry = "slide-style-geometry";
  const line = "slide-style-line";
  const image = "slide-style-image";
  const table = "slide-style-table";
  const chart = "slide-style-chart";
  const styles: SlideStyle[] = [
    style(text, "Text", { opacity: 1, fill: { kind: "none" }, stroke: { kind: "none" } }, {
      fontFamily: "system-ui, sans-serif",
      fontSize: 1,
      color: "#000000ff",
      lineHeight: 1.2
    }),
    style(geometry, "Geometry", {
      opacity: 1,
      fill: { kind: "solid", color: "#ffffffff" },
      stroke: { kind: "stroke", color: "#000000ff", widthPt: 1, dash: "solid" }
    }, {}),
    style(line, "Line", {
      opacity: 1,
      fill: { kind: "none" },
      stroke: { kind: "stroke", color: "#000000ff", widthPt: 1, dash: "solid" }
    }, {}),
    style(image, "Image", { opacity: 1, fill: { kind: "none" }, stroke: { kind: "none" } }, {}),
    style(table, "Table", {
      opacity: 1,
      fill: { kind: "solid", color: "#ffffffff" },
      stroke: { kind: "stroke", color: "#000000ff", widthPt: 1, dash: "solid" }
    }, { fontFamily: "system-ui, sans-serif", fontSize: 0.85, color: "#000000ff" }),
    style(chart, "Chart", { opacity: 1, fill: { kind: "none" }, stroke: { kind: "none" } }, {
      fontFamily: "system-ui, sans-serif",
      fontSize: 0.85,
      color: "#000000ff"
    })
  ];
  const defaultStyleIdByShapeKind = {
    text,
    "prompt-content": text,
    geometry,
    line,
    image,
    table,
    chart
  } satisfies Record<SlideShapeKind, string>;
  return { defaultStyleIdByShapeKind, styles };
};

export const createBlankDeckSnapshot = (input: {
  title: string;
  initialSlideId: string;
  canvas?: SlideCanvas;
  styles?: SlideStyleRegistry;
}): DeckSnapshot => {
  if (!isSafeSlideIdentity(input.initialSlideId)) {
    throw new SlideValidationError([`initial Slide ID is not a safe record key: ${input.initialSlideId}`]);
  }
  return ({
  representationVersion: 1,
  revision: 0,
  title: input.title,
  lifecycle: "active",
  canvas: structuredClone(input.canvas ?? DEFAULT_SLIDE_CANVAS),
  styles: structuredClone(input.styles ?? createDefaultSlideStyles()),
  slideOrder: [input.initialSlideId],
  slides: {
    [input.initialSlideId]: {
      id: input.initialSlideId,
      background: { kind: "transparent" },
      notes: {
        atoms: [{ id: `${input.initialSlideId}-notes-atom`, kind: "text", text: "" }],
        marks: []
      },
      rootElementIds: [],
      elements: {}
    }
  }
  });
};
