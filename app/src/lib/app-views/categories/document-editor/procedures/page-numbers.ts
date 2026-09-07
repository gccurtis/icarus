import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

import type { DocumentBody, PageNumbering } from "$representation/data/types/documents/body";

export type PageNumberPlacement = {
  readonly edge: "top" | "bottom";
  readonly distanceFromEdge: number;
  readonly numbering: PageNumbering;
};

export type PageNumbersSpec = { readonly placement?: PageNumberPlacement };

export const PAGE_NUMBERS = new PluginKey<PageNumbersSpec>("document-editor.page-numbers");

export const pageNumbersOf = (body: DocumentBody | undefined): PageNumbersSpec => {
  if (body?.footer?.pageNumber !== undefined) {
    return {
      placement: {
        edge: "bottom",
        distanceFromEdge: body.footer.distanceFromEdge,
        numbering: body.footer.pageNumber
      }
    };
  }
  if (body?.header?.pageNumber !== undefined) {
    return {
      placement: {
        edge: "top",
        distanceFromEdge: body.header.distanceFromEdge,
        numbering: body.header.pageNumber
      }
    };
  }
  return {};
};

export const samePageNumbers = (
  left: PageNumbersSpec | undefined,
  right: PageNumbersSpec
): boolean => JSON.stringify(left ?? {}) === JSON.stringify(right);

export const pageNumberText = (
  numbering: PageNumbering | undefined,
  pageIndex: number
): string | undefined => {
  if (numbering === undefined) return undefined;
  if (numbering.hideOnFirstPage === true && pageIndex === 0) return undefined;

  const index = numbering.hideOnFirstPage === true ? pageIndex - 1 : pageIndex;
  return String((numbering.startAt ?? 1) + index);
};

const build = (placement: PageNumberPlacement, label: string) => (): HTMLElement => {
  const band = document.createElement("div");
  band.className = "document-page-number-band";
  band.dataset.edge = placement.edge;
  band.contentEditable = "false";
  band.setAttribute("aria-hidden", "true");

  const number = document.createElement("span");
  number.className = "document-page-number";
  number.dataset.position = placement.numbering.position;
  number.textContent = label;
  band.appendChild(number);

  return band;
};

export const pageNumberDecorations = (state: EditorState): DecorationSet => {
  const placement = PAGE_NUMBERS.getState(state)?.placement;
  if (placement === undefined) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  state.doc.forEach((page, offset, index) => {
    const label = pageNumberText(placement.numbering, index);
    if (label === undefined) return;

    const top = placement.edge === "top";
    decorations.push(
      Decoration.widget(top ? offset + 1 : offset + page.nodeSize - 1, build(placement, label), {
        side: top ? -1 : 1,
        key: `${placement.edge}:${index}:${label}:${placement.numbering.position}`,
        ignoreSelection: true
      })
    );
  });

  return DecorationSet.create(state.doc, decorations);
};

export const pageNumbersPlugin = (read: () => PageNumbersSpec): Plugin<PageNumbersSpec> =>
  new Plugin<PageNumbersSpec>({
    key: PAGE_NUMBERS,
    state: {
      init: () => read(),
      apply: (transaction, held) => {
        const next = transaction.getMeta(PAGE_NUMBERS) as PageNumbersSpec | undefined;
        return next ?? held;
      }
    },
    props: {
      decorations: pageNumberDecorations
    }
  });
