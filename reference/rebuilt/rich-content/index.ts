/**
 * The browser door for Rich Content.
 *
 * Re-exports of remote functions, and nothing else. One plain import here would
 * drag this capability's server graph into the client bundle, so lint allows
 * only `.remote.ts` specifiers.
 *
 * `pnpm new-api rich-content <functionName> --remote` appends to this file.
 */
export { applyStyle } from "$rich-content/api/apply-style/apply-style.remote";
export { combineAsList } from "$rich-content/api/combine-as-list/combine-as-list.remote";
export { create } from "$rich-content/api/create/create.remote";
export { display } from "$rich-content/api/display/display.remote";
export { removeLink } from "$rich-content/api/remove-link/remove-link.remote";
export { removeList } from "$rich-content/api/remove-list/remove-list.remote";
export { removeStyle } from "$rich-content/api/remove-style/remove-style.remote";
export { replaceText } from "$rich-content/api/replace-text/replace-text.remote";
export { setLink } from "$rich-content/api/set-link/set-link.remote";
export { setList } from "$rich-content/api/set-list/set-list.remote";
export { split } from "$rich-content/api/split/split.remote";
