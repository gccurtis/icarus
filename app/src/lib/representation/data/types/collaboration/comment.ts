/** Resource kinds for which the product defines comment anchors and surfaces. */
export type CommentTarget =
  | { readonly kind: "document"; readonly id: string }
  | { readonly kind: "presentation"; readonly id: string }
  | { readonly kind: "spreadsheet"; readonly id: string };
