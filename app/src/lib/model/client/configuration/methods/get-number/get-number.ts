import { selectNumber } from "$model/client/configuration/methods/get-number/select-number";
import type { ConfigurationState } from "$model/client/configuration/state";
import type { ConfigurationNumberKey } from "$model/client/configuration/types";

/** The public free operation backing the acquired port's `getNumber` member. */
export const getNumber = (
  state: ConfigurationState,
  key: ConfigurationNumberKey
): number => selectNumber(state, key);
