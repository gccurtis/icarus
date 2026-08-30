/**
 * The entry for Configuration.
 *
 * The composition root takes the constructor; every other object takes the type.
 * `requiredNumber` crosses too, because reading a key that must be present is
 * part of the surface rather than an implementation detail — a consumer that
 * hand-rolled the check would produce a different error message for the same
 * deployment defect.
 */
export { createConfiguration } from "$model/client/configuration/constructor";
export { requiredNumber } from "$model/client/configuration/types";
export type {
  ConfigurationModel,
  ConfigurationSnapshot
} from "$model/client/configuration/types";
