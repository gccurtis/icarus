/**
 * The door for Configuration.
 *
 * The composition root takes the constructor; every other object takes the
 * `Configuration` type and reads its own keys through it. `requiredString`
 * crosses with them because the shape it checks belongs to the contract, not to
 * any one reader.
 */
export { createConfiguration } from "$model/server/configuration/constructor";
export { requiredString } from "$model/server/configuration/types";
export type { Configuration, ConfigurationObject } from "$model/server/configuration/types";
