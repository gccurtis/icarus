/**
 * The browser door for Settings.
 *
 * Re-exports of remote functions, and nothing else. One plain import here would
 * drag this capability's server graph into the client bundle, so lint allows
 * only `.remote.ts` specifiers.
 *
 * `pnpm new-api data/settings <functionName> --remote` appends to this file.
 */
export { get } from "$settings/api/get/get.remote";
export { list } from "$settings/api/list/list.remote";
export { set } from "$settings/api/set/set.remote";
