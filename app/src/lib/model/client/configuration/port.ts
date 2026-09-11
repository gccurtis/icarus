import { getNumber } from "$model/client/configuration/methods/get-number/get-number";
import type { ConfigurationState } from "$model/client/configuration/state";
import type { ConfigurationNumberKey } from "$model/client/configuration/types";

export type ConfigurationOperations = {
  readonly getNumber: (key: ConfigurationNumberKey) => number;
};

export type AcquiredConfigurationPort = Readonly<ConfigurationOperations> & {
  readonly commit: () => void;
};

export type ConfigurationAdapter = {
  readonly lifetime: "client-workspace";
  readonly commitMode: "read-only";
  readonly acquire: (context: undefined) => AcquiredConfigurationPort;
  readonly release: (port: AcquiredConfigurationPort) => void;
  readonly close: () => void;
};

type ConfigurationLease = {
  released: boolean;
};

/**
 * Binds the one runtime-created state object to fresh, independently releasable
 * read leases. The adapter itself remains inside runtime.
 */
export const bindConfiguration = (
  state: ConfigurationState
): ConfigurationAdapter => {
  const leases = new WeakMap<AcquiredConfigurationPort, ConfigurationLease>();
  const active = new Set<ConfigurationLease>();
  let closed = false;

  return {
    lifetime: "client-workspace",
    commitMode: "read-only",
    acquire: (_context: undefined): AcquiredConfigurationPort => {
      if (closed) throw new Error("Configuration adapter has been closed");
      const lease: ConfigurationLease = { released: false };
      const port: AcquiredConfigurationPort = Object.freeze({
        getNumber: (key: ConfigurationNumberKey): number => {
          if (lease.released) throw new Error("Configuration lease has been released");
          return getNumber(state, key);
        },
        commit: (): void => {
          if (lease.released) throw new Error("Configuration lease has been released");
        }
      });
      leases.set(port, lease);
      active.add(lease);
      return port;
    },
    release: (port: AcquiredConfigurationPort): void => {
      const lease = leases.get(port);
      if (!lease) throw new Error("Configuration port was not acquired from this adapter");
      lease.released = true;
      active.delete(lease);
    },
    close: (): void => {
      closed = true;
      for (const lease of active) lease.released = true;
      active.clear();
    }
  };
};
