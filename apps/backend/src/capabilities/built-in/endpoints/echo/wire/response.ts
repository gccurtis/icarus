/** The JSON `POST /echo` returns: the admitted request, plus when it was served. */
export interface EchoResponse {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly processedAt: string;
}
