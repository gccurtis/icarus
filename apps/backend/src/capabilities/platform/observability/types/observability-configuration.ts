/** The only configuration surface Observability needs from its caller. */
export interface ObservabilityConfiguration {
  get(key: string): unknown;
}
