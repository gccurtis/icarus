/**
 * What `POST /echo` admits, after decoding.
 *
 * The endpoint reflects arbitrary JSON, so `body` stays opaque rather than
 * described. It is still a trusted value: it is produced by
 * [`decode.ts`](decode.ts) from the request envelope, never the envelope itself.
 */
export interface EchoRequest {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}
