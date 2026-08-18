import { Configuration } from "$model/client/configuration/definition";
import type { ConfigurationModel, ConfigurationSnapshot } from "$model/client/configuration/types";

/**
 * Returns a fresh Configuration over the snapshot the layout loaded.
 *
 * The snapshot is a parameter rather than something this fetches, which is what
 * makes every later read synchronous: an object that had to await its own values
 * would make `buildClientModel` async, and every consumer of a key would have to
 * cope with not having one yet.
 *
 * Nothing is frozen here. The server twin freezes because its snapshot is shared
 * by every request in the process; this one belongs to a single browser tab and
 * is handed to no one else, so a freeze would be guarding against a sharing that
 * does not exist.
 *
 * This object depends on nothing, so the root constructs it first.
 */
export const createConfiguration = (snapshot: ConfigurationSnapshot): ConfigurationModel =>
  new Configuration(snapshot);
