import { OperationFlights } from "$model/server/operation-flights/definition";
import type { OperationFlightsModel } from "$model/server/operation-flights/types";

/**
 * A fresh process-local coordinator. The composition root holds its one instance.
 */
export const createOperationFlights = (): OperationFlightsModel =>
  new OperationFlights();
