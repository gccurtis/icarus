/** The process channel used to own one terminal-shutdown listener. */
export type ProcessShutdownChannel = {
  readonly listeners: () => readonly (() => void)[];
  readonly add: (listener: () => void) => void;
  readonly remove: (listener: () => void) => void;
};

type ProcessLifetime = {
  readonly release: () => Promise<void>;
  readonly shutdown: () => Promise<void>;
};

type OwnedShutdownListener = {
  readonly listener: () => void;
  readonly lifetime: ProcessLifetime;
};

const processLifetimeBrand = "__icarus_server_model_lifetime__";

/** Finds this runtime's listener while leaving every unrelated listener opaque. */
const ownedShutdownListener = (
  listener: () => void
): OwnedShutdownListener | undefined => {
  const lifetime = Reflect.get(listener, processLifetimeBrand);
  if (typeof lifetime !== "object" || lifetime === null) return undefined;
  if (!("release" in lifetime) || typeof lifetime.release !== "function") return undefined;
  if (!("shutdown" in lifetime) || typeof lifetime.shutdown !== "function") return undefined;
  return { listener, lifetime: lifetime as ProcessLifetime };
};

/**
 * Sequences one owner's release and shutdown after the owner it replaced.
 * Both transitions are idempotent; terminal shutdown wins a race with release.
 */
const lifetimeAfter = (
  outgoingRelease: Promise<void> | undefined,
  releaseOwnedState: () => Promise<void>,
  shutDownOwnedState: () => Promise<void>
): ProcessLifetime => {
  let releasePromise: Promise<void> | undefined;
  let terminalPromise: Promise<void> | undefined;

  const release = (): Promise<void> => {
    if (terminalPromise !== undefined) return terminalPromise;
    releasePromise ??= (async () => {
      await outgoingRelease;
      await releaseOwnedState();
    })();
    return releasePromise;
  };

  const shutdown = (): Promise<void> => {
    terminalPromise ??= (async () => {
      await (releasePromise ?? outgoingRelease);
      await shutDownOwnedState();
    })();
    return terminalPromise;
  };

  return { release, shutdown };
};

/**
 * Replaces this runtime's one process listener and returns the outgoing owner's
 * release. The owner supplies state-specific release and shutdown procedures;
 * this module owns only listener identity and transition ordering.
 */
export const ownProcessLifetime = (
  channel: ProcessShutdownChannel,
  releaseOwnedState: () => Promise<void>,
  shutDownOwnedState: () => Promise<void>,
  reportFailure: (error: unknown) => void
): Promise<void> | undefined => {
  const outgoing = channel.listeners()
    .map(ownedShutdownListener)
    .find((candidate) => candidate !== undefined);
  if (outgoing !== undefined) channel.remove(outgoing.listener);

  const pendingRelease = outgoing?.lifetime.release();
  if (pendingRelease !== undefined) void pendingRelease.catch(reportFailure);

  const lifetime = lifetimeAfter(
    pendingRelease,
    releaseOwnedState,
    shutDownOwnedState
  );
  let reportedShutdown: Promise<void> | undefined;
  const shutdown = () => {
    reportedShutdown ??= lifetime.shutdown().catch(reportFailure);
  };
  Object.defineProperty(shutdown, processLifetimeBrand, { value: lifetime });
  channel.add(shutdown);

  return pendingRelease;
};
