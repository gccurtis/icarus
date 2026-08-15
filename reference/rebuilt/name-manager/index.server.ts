/**
 * The server door for Name Manager.
 *
 * Reached by import, from load functions, form actions, and other capabilities.
 * Every function exported here has a directory under `api/`, and lint checks
 * both directions.
 *
 * Views do not import this file — they import `index.ts`. The two cannot be
 * merged: this graph reaches Kysely, and kit's server-only guard runs at resolve
 * time, so a view importing it would fail the build rather than tree-shake.
 */
export { NameManagerError, type NameManagerErrorCode } from "$name-manager/errors";
export { define } from "$name-manager/api/define/define";
export { get } from "$name-manager/api/get/get";
export { list } from "$name-manager/api/list/list";
export { require } from "$name-manager/api/require/require";
export type {
  Calendar,
  DateInput,
  DateValue,
  GregorianDateInput,
  GregorianDateTimeInput,
  GregorianDateTimeValue,
  GregorianDateValue
} from "$name-manager/types/dates";
export type {
  Field,
  GeneralTableType,
  ListTableType,
  RecordTableType,
  ScalarTableType,
  ScalarType,
  TableType,
  ValueType
} from "$name-manager/types/schema";
export type {
  DataInputRecord,
  DataInputValue,
  DataRecord,
  DataValue
} from "$name-manager/types/values";
export type { NamedVariable, NamedVariableInput } from "$name-manager/types/variables";
export { initializeNameManager } from "$name-manager/persistence/initialize";
