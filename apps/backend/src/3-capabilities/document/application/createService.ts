import type {
  DocumentBlockKind,
  DocumentPageLayout,
  DocumentSnapshot,
  DocumentStyle,
  DocumentStyleRegistry
} from "../domain/model.js";

export const DEFAULT_DOCUMENT_PAGE_LAYOUT: DocumentPageLayout = {
  page: {
    widthTwips: 12_240,
    heightTwips: 15_840,
    orientation: "portrait"
  },
  margins: {
    topTwips: 1_440,
    rightTwips: 1_440,
    bottomTwips: 1_440,
    leftTwips: 1_440
  },
  pageNumber: {
    start: 1,
    format: "decimal"
  }
};

const style = (
  id: string,
  name: string,
  text: DocumentStyle["text"],
  block: DocumentStyle["block"] = {},
  systemRole?: DocumentStyle["systemRole"]
): DocumentStyle => ({
  id,
  name,
  text,
  block,
  ...(systemRole ? { systemRole } : {})
});

export const createDefaultDocumentStyles = (): DocumentStyleRegistry => {
  const normal = "document-style-normal";
  const code = "document-style-code";
  const quote = "document-style-quote";
  const visual = "document-style-visual";
  const styles: DocumentStyle[] = [
    style(normal, "Normal", { fontFamily: "system-ui, sans-serif", fontSize: 1 }),
    style(code, "Code", { fontFamily: "monospace", fontSize: 0.95, code: true }, {
      wrapping: "break-word"
    }),
    style(quote, "Quote", { italic: true }, {
      indentation: { leftTwips: 360, rightTwips: 0, firstLineTwips: 0 }
    }),
    style(visual, "Visual", {}, { alignment: "center" }),
    style("document-style-heading-1", "Heading 1", { fontSize: 2, fontWeight: 700 }, {
      spacingBeforeTwips: 360,
      spacingAfterTwips: 180,
      keepWithNext: true
    }, "heading-1"),
    style("document-style-heading-2", "Heading 2", { fontSize: 1.6, fontWeight: 700 }, {
      spacingBeforeTwips: 300,
      spacingAfterTwips: 140,
      keepWithNext: true
    }, "heading-2"),
    style("document-style-heading-3", "Heading 3", { fontSize: 1.35, fontWeight: 650 }, {
      spacingBeforeTwips: 260,
      spacingAfterTwips: 120,
      keepWithNext: true
    }, "heading-3"),
    style("document-style-heading-4", "Heading 4", { fontSize: 1.2, fontWeight: 650 }, {
      spacingBeforeTwips: 220,
      spacingAfterTwips: 100,
      keepWithNext: true
    }, "heading-4"),
    style("document-style-heading-5", "Heading 5", { fontSize: 1.1, fontWeight: 600 }, {
      spacingBeforeTwips: 180,
      spacingAfterTwips: 80,
      keepWithNext: true
    }, "heading-5"),
    style("document-style-heading-6", "Heading 6", { fontSize: 1, fontWeight: 600 }, {
      spacingBeforeTwips: 160,
      spacingAfterTwips: 80,
      keepWithNext: true
    }, "heading-6")
  ];

  const defaultStyleIdByBlockKind = {
    text: normal,
    code,
    quote,
    prompt: normal,
    divider: normal,
    callout: normal,
    list: normal,
    table: normal,
    image: visual,
    chart: visual
  } satisfies Record<DocumentBlockKind, string>;

  return { defaultStyleIdByBlockKind, styles };
};

export const createBlankSnapshot = (input: {
  title: string;
  pageLayout?: DocumentPageLayout;
  styles?: DocumentStyleRegistry;
}): DocumentSnapshot => ({
  representationVersion: 1,
  revision: 0,
  title: input.title,
  lifecycle: "active",
  pageLayout: structuredClone(input.pageLayout ?? DEFAULT_DOCUMENT_PAGE_LAYOUT),
  styles: structuredClone(input.styles ?? createDefaultDocumentStyles()),
  rows: []
});
