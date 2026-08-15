/**
 * The browser door for Name Manager.
 *
 * Re-exports of remote functions, and nothing else. One plain import here would
 * drag this capability's server graph into the client bundle, so lint allows
 * only `.remote.ts` specifiers.
 *
 * `pnpm new-api name-manager <functionName> --remote` appends to this file.
 */
export { define } from "$name-manager/api/define/define.remote";
export { get } from "$name-manager/api/get/get.remote";
export { list } from "$name-manager/api/list/list.remote";
export { require } from "$name-manager/api/require/require.remote";
