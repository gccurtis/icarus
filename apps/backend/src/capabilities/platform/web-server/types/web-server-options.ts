/**
 * The bounds the server is created with.
 *
 * They are constructor arguments rather than transport behavior because the
 * framework enforces them before a request reaches any handler: a body over the
 * limit is refused with 413, and a request over the timeout is aborted, without
 * an endpoint job ever running. Both arrive from configuration through the
 * composition root, so no value here is a framework default inherited by
 * omission.
 */
export interface WebServerOptions {
  bodyLimitBytes: number;
  requestTimeoutMs: number;
}
