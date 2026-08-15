/**
 * The server door for Settings.
 *
 * Reached by import, from load functions, form actions, and other capabilities.
 * Every function exported here has a directory under `api/`, and lint checks
 * both directions.
 *
 * Views do not import this file — they import `index.ts`. The two cannot be
 * merged: this graph reaches Kysely, and kit's server-only guard runs at resolve
 * time, so a view importing it would fail the build rather than tree-shake.
 */
export { SettingsError, type SettingsErrorCode } from "$settings/errors";
export { get } from "$settings/api/get/get";
export { list } from "$settings/api/list/list";
export { set } from "$settings/api/set/set";
export type { Setting, SettingInput, SettingValue } from "$settings/types/settings";
export { initializeSettings } from "$settings/persistence/initialize";
