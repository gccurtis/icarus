import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { DocumentBody, PageFurniture, PageNumbering } from "$representation/data/types/documents/body";

export type FurnitureSpec = {
  readonly header?: PageFurniture;
  readonly footer?: PageFurniture;
};

export type Furniture = "header" | "footer";

export const FURNITURE = new PluginKey<FurnitureSpec>("document-editor.furniture");

export const furnitureOf = (body: DocumentBody | undefined): FurnitureSpec => ({
  ...(body?.header === undefined ? {} : { header: body.header }),
  ...(body?.footer === undefined ? {} : { footer: body.footer })
});

export const sameFurniture = (a: FurnitureSpec | undefined, b: FurnitureSpec): boolean =>
  JSON.stringify(a ?? {}) === JSON.stringify(b);

export const pageNumberText = (
  numbering: PageNumbering | undefined,
  pageIndex: number
): string | undefined => {
  if (numbering === undefined) return undefined;
  if (numbering.hideOnFirstPage === true && pageIndex === 0) return undefined;

  const index = numbering.hideOnFirstPage === true ? pageIndex - 1 : pageIndex;
  return String((numbering.startAt ?? 1) + index);
};

export const focusOfFurniture = (
  furniture: PageFurniture
): { readonly blockId: string; readonly address: string } | undefined => {
  for (const row of furniture.rows) {
    if (row.kind !== "blocks") continue;
    for (const block of row.blocks) {
      if (block.type !== "text" && block.type !== "prompt") continue;
      const atom = block.atoms[0];
      if (atom === undefined) continue;
      return {
        blockId: block.id,
        address: `${block.id}/atoms/${atom.id}@0`
      };
    }
  }
  return undefined;
};

export const textOfFurniture = (furniture: PageFurniture, pageIndex: number): string => {
  const rows = pageIndex === 0 && furniture.firstPageRows !== undefined ? furniture.firstPageRows : furniture.rows;

  return rows
    .map((row) =>
      row.kind === "blocks"
        ? row.blocks.map((block) => ("display" in block ? block.display : "")).join(" ")
        : ""
    )
    .join("\n");
};

const build = (
  which: Furniture,
  furniture: PageFurniture,
  pageIndex: number,
  includeText: boolean
) => (): HTMLElement => {
  const element = document.createElement("div");
  element.className = `document-furniture document-${which} document-furniture-projection`;
  element.contentEditable = "false";
  element.setAttribute("aria-hidden", "true");

  if (includeText) {
    const text = document.createElement("span");
    text.className = "document-furniture-text";
    text.textContent = textOfFurniture(furniture, pageIndex);
    element.appendChild(text);
  }

  const number = pageNumberText(furniture.pageNumber, pageIndex);
  if (number !== undefined && furniture.pageNumber !== undefined) {
    const span = document.createElement("span");
    span.className = "document-page-number";
    span.dataset.position = furniture.pageNumber.position;
    span.textContent = number;
    element.appendChild(span);
  }

  return element;
};

const keyOf = (which: Furniture, furniture: PageFurniture, pageIndex: number): string =>
  `${which}:${pageIndex}:${textOfFurniture(furniture, pageIndex)}:${pageNumberText(furniture.pageNumber, pageIndex) ?? ""}:${furniture.pageNumber?.position ?? ""}`;

export const furnitureDecorations = (state: EditorState): DecorationSet => {
  const spec = FURNITURE.getState(state);
  if (spec === undefined || (spec.header === undefined && spec.footer === undefined)) {
    return DecorationSet.empty;
  }

  const decorations: Decoration[] = [];

  state.doc.forEach((page, offset, index) => {
    const start = offset + 1;
    const end = offset + page.nodeSize - 1;

    const canonicalHeader = page.children.some((child) => child.type.name === "furniture_header");
    const canonicalFooter = page.children.some((child) => child.type.name === "furniture_footer");

    if (spec.header !== undefined && (!canonicalHeader || pageNumberText(spec.header.pageNumber, index) !== undefined)) {
      decorations.push(
        Decoration.widget(start, build("header", spec.header, index, !canonicalHeader), {
          side: -1,
          key: keyOf("header", spec.header, index),
          ignoreSelection: true
        })
      );
    }
    if (spec.footer !== undefined && (!canonicalFooter || pageNumberText(spec.footer.pageNumber, index) !== undefined)) {
      decorations.push(
        Decoration.widget(end, build("footer", spec.footer, index, !canonicalFooter), {
          side: 1,
          key: keyOf("footer", spec.footer, index),
          ignoreSelection: true
        })
      );
    }
  });

  return DecorationSet.create(state.doc, decorations);
};

export const furniturePlugin = (read: () => FurnitureSpec): Plugin<FurnitureSpec> =>
  new Plugin<FurnitureSpec>({
    key: FURNITURE,
    state: {
      init: () => read(),
      apply: (transaction, held) => {
        const next = transaction.getMeta(FURNITURE) as FurnitureSpec | undefined;
        return next ?? held;
      }
    },
    props: {
      decorations: furnitureDecorations
    }
  });
