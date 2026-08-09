import type {
  DeckSnapshot,
  DeckTheme,
  Layout,
  Master,
  Slide,
  SlideCanvas,
  SlideElementKind,
  SlideStyle,
  SlideStyleRegistry
} from "../domain/model.js";

/**
 * Widescreen at 96 dpi: 13⅓ × 7½ inches. The number a client needs to lay the
 * Deck out, held as data — what it draws with it is not our concern.
 */
export const DEFAULT_SLIDE_CANVAS: SlideCanvas = {
  widthPt: 960,
  heightPt: 540
};

/**
 * Identities in a blank Deck are fixed rather than generated, exactly as
 * Document's style IDs are. They only have to be unique within one Deck, and
 * the identity ledger is keyed `(deck_id, identity_id)` — so a constant is
 * enough, and it makes a fresh Deck reproducible in a test without threading an
 * ID factory through creation.
 */
export const INITIAL_MASTER_ID = "slides-master-default";
export const INITIAL_LAYOUT_ID = "slides-layout-title-and-body";
export const INITIAL_TITLE_SLOT_ID = "slides-slot-title";
export const INITIAL_BODY_SLOT_ID = "slides-slot-body";
export const INITIAL_SLIDE_ID = "slides-slide-1";

const INK_TOKEN = "slides-token-ink";
const PAPER_TOKEN = "slides-token-paper";
const ACCENT_TOKEN = "slides-token-accent";
const SURFACE_TOKEN = "slides-token-surface";
const HEADING_FONT_TOKEN = "slides-token-heading-font";
const BODY_FONT_TOKEN = "slides-token-body-font";
const BASE_SIZE_TOKEN = "slides-token-base-size";

const NORMAL_STYLE = "slides-style-normal";
const TITLE_STYLE = "slides-style-title";
const BODY_STYLE = "slides-style-body";
const VISUAL_STYLE = "slides-style-visual";

export const createDefaultDeckTheme = (): DeckTheme => ({
  name: "Default",
  tokens: {
    [INK_TOKEN]: { id: INK_TOKEN, kind: "color", name: "Ink", value: "#111418" },
    [PAPER_TOKEN]: { id: PAPER_TOKEN, kind: "color", name: "Paper", value: "#ffffff" },
    [SURFACE_TOKEN]: { id: SURFACE_TOKEN, kind: "color", name: "Surface", value: "#f4f5f7" },
    [ACCENT_TOKEN]: { id: ACCENT_TOKEN, kind: "color", name: "Accent", value: "#2563eb" },
    [HEADING_FONT_TOKEN]: {
      id: HEADING_FONT_TOKEN,
      kind: "font",
      name: "Heading",
      family: "system-ui, sans-serif"
    },
    [BODY_FONT_TOKEN]: {
      id: BODY_FONT_TOKEN,
      kind: "font",
      name: "Body",
      family: "system-ui, sans-serif"
    },
    [BASE_SIZE_TOKEN]: {
      id: BASE_SIZE_TOKEN,
      kind: "length",
      name: "Base size",
      valuePt: 18
    }
  },
  palette: {
    background: { kind: "token", tokenId: PAPER_TOKEN },
    surface: { kind: "token", tokenId: SURFACE_TOKEN },
    text: { kind: "token", tokenId: INK_TOKEN },
    accent: { kind: "token", tokenId: ACCENT_TOKEN }
  },
  typography: {
    headingFontFamily: { kind: "token", tokenId: HEADING_FONT_TOKEN },
    bodyFontFamily: { kind: "token", tokenId: BODY_FONT_TOKEN },
    baseFontSizePt: { kind: "token", tokenId: BASE_SIZE_TOKEN }
  }
});

const style = (
  id: string,
  name: string,
  text: SlideStyle["text"],
  box: SlideStyle["box"] = {},
  systemRole?: SlideStyle["systemRole"]
): SlideStyle => ({
  id,
  name,
  text,
  box,
  ...(systemRole ? { systemRole } : {})
});

export const createDefaultSlideStyles = (): SlideStyleRegistry => {
  const styles: SlideStyle[] = [
    // `normal` is the only protected role. Document also protects its six
    // heading roles because outline level derives from them; Slides has no
    // outline, so nothing else is load-bearing yet.
    style(NORMAL_STYLE, "Normal", { fontSize: 1 }, { verticalAlign: "top" }, "normal"),
    style(
      TITLE_STYLE,
      "Title",
      { fontSize: 2.4, fontWeight: 700 },
      { verticalAlign: "middle" }
    ),
    style(BODY_STYLE, "Body", { fontSize: 1.1 }, { verticalAlign: "top", paddingPt: 4 }),
    style(VISUAL_STYLE, "Visual", {}, { textAlign: "center", verticalAlign: "middle" })
  ];

  const defaultStyleIdByElementKind = {
    group: NORMAL_STYLE,
    text: BODY_STYLE,
    table: NORMAL_STYLE,
    chart: VISUAL_STYLE,
    image: VISUAL_STYLE,
    geometry: VISUAL_STYLE,
    line: NORMAL_STYLE
  } satisfies Record<SlideElementKind, string>;

  return { defaultStyleIdByElementKind, styles };
};

const createInitialMaster = (): Master => ({
  id: INITIAL_MASTER_ID,
  name: "Default",
  background: { kind: "solid", color: { kind: "token", tokenId: PAPER_TOKEN } },
  elements: {}
});

/**
 * One Layout with a title and a body slot. Slots carry placement only and are
 * never painted, so an empty Layout still gives a Slide somewhere to put things.
 */
const createInitialLayout = (canvas: SlideCanvas): Layout => {
  const margin = Math.round(canvas.widthPt * 0.06);
  const titleHeight = Math.round(canvas.heightPt * 0.18);
  return {
    id: INITIAL_LAYOUT_ID,
    name: "Title and Body",
    masterId: INITIAL_MASTER_ID,
    elements: {},
    slots: {
      [INITIAL_TITLE_SLOT_ID]: {
        id: INITIAL_TITLE_SLOT_ID,
        name: "Title",
        frame: {
          xPt: margin,
          yPt: margin,
          widthPt: canvas.widthPt - margin * 2,
          heightPt: titleHeight
        },
        accepts: ["text"]
      },
      [INITIAL_BODY_SLOT_ID]: {
        id: INITIAL_BODY_SLOT_ID,
        name: "Body",
        frame: {
          xPt: margin,
          yPt: margin * 2 + titleHeight,
          widthPt: canvas.widthPt - margin * 2,
          heightPt: canvas.heightPt - titleHeight - margin * 3
        },
        // Empty means any kind: a body slot takes a table or a chart as
        // readily as text.
        accepts: []
      }
    }
  };
};

const createInitialSlide = (): Slide => ({
  id: INITIAL_SLIDE_ID,
  layoutId: INITIAL_LAYOUT_ID,
  // Authored only, and empty. Rich Content requires at least one atom, so the
  // empty state is a single empty text atom rather than an empty atom list.
  notes: { atoms: [{ id: `${INITIAL_SLIDE_ID}-notes-atom`, kind: "text", text: "" }], marks: [] },
  elements: {}
});

/**
 * A Deck that satisfies every snapshot invariant on its first revision: one
 * canvas, one theme, one style registry with exactly one `normal`, at least one
 * Master, at least one Layout, and at least one Slide bound to it.
 */
export const createBlankDeckSnapshot = (input: {
  title: string;
  canvas?: SlideCanvas;
}): DeckSnapshot => {
  const canvas = structuredClone(input.canvas ?? DEFAULT_SLIDE_CANVAS);
  return {
    representationVersion: 1,
    revision: 1,
    title: input.title,
    lifecycle: "active",
    canvas,
    theme: createDefaultDeckTheme(),
    styles: createDefaultSlideStyles(),
    masters: { [INITIAL_MASTER_ID]: createInitialMaster() },
    layouts: { [INITIAL_LAYOUT_ID]: createInitialLayout(canvas) },
    slideOrder: [INITIAL_SLIDE_ID],
    slides: { [INITIAL_SLIDE_ID]: createInitialSlide() }
  };
};
