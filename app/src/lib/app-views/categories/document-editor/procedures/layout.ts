import type { DocumentBody, PageFurniture, PageNumbering } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import type { Margins, Orientation, PageSetup } from "$representation/data/types/documents/page-setup";
import { mint } from "$app-views/categories/document-editor/procedures/ids";
import { DEFAULT_PAGE_SETUP, paperDimensions, type NamedPaper } from "$app-views/categories/document-editor/procedures/page-setup";

export type { PageNumbering } from "$representation/data/types/documents/body";

type PageNumberHost = "header" | "footer";

const PAGE_NUMBER_DISTANCE = 0.4;
const PAGE_NUMBER_HOSTS: readonly PageNumberHost[] = ["header", "footer"];

export const PAGE_NUMBER_POSITIONS: readonly { value: string; label: string }[] = [
  { value: "none", label: "None" },
  { value: "start", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "end", label: "Right" }
];

const set = (path: string, value: unknown, was: unknown): DocumentOp => ({
  op: "set",
  target: "document",
  path,
  value: value ?? null,
  was: was ?? null
});

export const setupOf = (body: DocumentBody | undefined): PageSetup =>
  body?.pageSetup ?? DEFAULT_PAGE_SETUP;

export const ensurePageSetupOps = (body: DocumentBody): DocumentOp[] =>
  body.pageSetup === undefined ? [set("pageSetup", DEFAULT_PAGE_SETUP, null)] : [];

export const paperOps = (body: DocumentBody, paper: string): DocumentOp[] => {
  const held = setupOf(body);
  const next: PageSetup["paper"] =
    paper === "custom"
      ? typeof held.paper === "object"
        ? held.paper
        : { ...paperDimensions(held.paper) }
      : (paper as NamedPaper);

  if (JSON.stringify(next) === JSON.stringify(held.paper)) return [];
  return [...ensurePageSetupOps(body), set("pageSetup/paper", next, held.paper)];
};

export const customPaperOps = (
  body: DocumentBody,
  size: { readonly width?: number; readonly height?: number }
): DocumentOp[] => {
  const held = setupOf(body);
  const current = paperDimensions(held.paper);
  const next = {
    width: Math.max(1, size.width ?? current.width),
    height: Math.max(1, size.height ?? current.height)
  };

  if (JSON.stringify(next) === JSON.stringify(held.paper)) return [];
  return [...ensurePageSetupOps(body), set("pageSetup/paper", next, held.paper)];
};

export const orientationOps = (body: DocumentBody, orientation: Orientation): DocumentOp[] => {
  const held = setupOf(body);
  if (held.orientation === orientation) return [];
  return [...ensurePageSetupOps(body), set("pageSetup/orientation", orientation, held.orientation)];
};

export const marginOps = (body: DocumentBody, side: keyof Margins, inches: number): DocumentOp[] => {
  const held = setupOf(body);
  const next = Math.max(0, Math.round(inches * 100) / 100);
  if (held.margins[side] === next) return [];
  return [...ensurePageSetupOps(body), set(`pageSetup/margins/${side}`, next, held.margins[side])];
};

const emptyPageNumberHost = (): PageFurniture => ({
  rows: [
    {
      id: mint("row"),
      kind: "blocks",
      blocks: [
        {
          id: mint("block"),
          type: "text",
          variant: "paragraph",
          atoms: [{ id: mint("atom"), kind: "literal", text: "" }],
          display: "",
          marks: []
        }
      ]
    }
  ],
  distanceFromEdge: PAGE_NUMBER_DISTANCE
});

const pageNumberHostOf = (body: DocumentBody): PageNumberHost | undefined =>
  body.footer?.pageNumber !== undefined
    ? "footer"
    : body.header?.pageNumber !== undefined
      ? "header"
      : undefined;

export const pageNumberOf = (body: DocumentBody | undefined): PageNumbering | undefined =>
  body?.footer?.pageNumber ?? body?.header?.pageNumber;

export const pageNumberOps = (body: DocumentBody, position: string): DocumentOp[] => {
  const ops: DocumentOp[] = [];
  const held = pageNumberOf(body);
  const at = pageNumberHostOf(body) ?? "footer";

  if (position === "none") {
    return PAGE_NUMBER_HOSTS.flatMap((host) => {
      const numbering = body[host]?.pageNumber;
      return numbering === undefined ? [] : [set(`${host}/pageNumber`, null, numbering)];
    });
  }

  if (body[at] === undefined) ops.push(set(at, emptyPageNumberHost(), null));

  const next: PageNumbering = { ...(held ?? {}), position: position as PageNumbering["position"] };
  if (JSON.stringify(next) === JSON.stringify(held)) return ops;
  ops.push(set(`${at}/pageNumber`, next, held));

  return ops;
};

export const pageNumberFieldOps = (
  body: DocumentBody,
  patch: Partial<Pick<PageNumbering, "startAt" | "hideOnFirstPage">>
): DocumentOp[] => {
  const held = pageNumberOf(body);
  if (held === undefined) return [];
  const at = pageNumberHostOf(body);
  if (at === undefined) return [];
  const next = { ...held, ...patch };
  if (JSON.stringify(next) === JSON.stringify(held)) return [];
  return [set(`${at}/pageNumber`, next, held)];
};
