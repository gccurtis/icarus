import { Schema } from "prosemirror-model";

/**
 * Text, and nothing else.
 *
 * A page holds rows, a row holds text blocks, and a text block holds its display
 * text. There is no node for a divider, a page break, an image or a mark —
 * anything a document holds that is not display text is carried through the
 * projection rather than drawn, so the editor can neither render it nor damage
 * it.
 */
export const schema = new Schema({
  nodes: {
    doc: { content: "page+" },

    page: {
      content: "blocks_row+",
      toDOM: () => ["article", { class: "document-page" }, 0]
    },

    blocks_row: {
      attrs: { rowId: { default: null }, proportions: { default: null } },
      content: "text_block+",
      toDOM: (node) => ["div", { class: "document-row", "data-row": node.attrs.rowId }, 0]
    },

    text_block: {
      attrs: {
        blockId: { default: null },
        atomId: { default: null },
        share: { default: 1 }
      },
      content: "inline*",
      toDOM: (node) => [
        "p",
        {
          class: "document-block",
          "data-block": node.attrs.blockId,
          style: `flex-basis: ${node.attrs.share * 100}%`
        },
        0
      ]
    },

    text: { group: "inline" }
  },

  marks: {}
});
