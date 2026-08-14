/**
 * Where the root logger writes.
 *
 * The two cases differ in what this backend is responsible for, not merely in
 * which file descriptor is used. Piped means the process retains nothing and
 * whatever runs it owns collection; file means this process owns creating the
 * file and closing it at shutdown. A single `directory` key with an "empty means
 * stdout" convention would have hidden that difference in a sentinel value.
 */
export type LogDestination =
  | { readonly kind: "piped"; readonly stream: "stdout" | "stderr" }
  | { readonly kind: "file"; readonly directory: string };

/**
 * A log stream this runtime opened and must therefore close.
 *
 * Declared structurally, as [`ObservabilityConfiguration`](observability-configuration.ts)
 * is: it describes what shutdown needs from the object rather than naming Pino's
 * stream implementation, which keeps the library out of `types/` and lets a test
 * pass an object literal.
 *
 * Only a file destination produces one. A piped destination must never be
 * closed — ending file descriptor 1 or 2 would take the stream out from under
 * whatever else in the process writes to it.
 */
export interface ClosableLogStream {
  end(): void;
  once(event: "close", listener: () => void): unknown;
  once(event: "error", listener: (error: Error) => void): unknown;
}
