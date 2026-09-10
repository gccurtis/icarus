/** The bounded public projection surface used by the document composition root. */
export { bodyOf } from "$app-views/categories/document-editor/procedures/projection-body";
export { emptyRow, isStyled, soleLiteral } from "$app-views/categories/document-editor/procedures/projection-blocks";
export { docOf } from "$app-views/categories/document-editor/procedures/projection-nodes";
export {
  repaginate,
  rowNodesOf,
  stampIds,
  type Metrics
} from "$app-views/categories/document-editor/procedures/projection-pagination";

export type { DocumentBody } from "$representation/data/types/documents/body";
