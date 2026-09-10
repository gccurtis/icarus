import { join } from "node:path";

/**
 * Gives one Playwright invocation sole ownership of its transient artifacts.
 *
 * Playwright clears `outputDir` when a run starts and numbers worker artifact
 * directories from zero inside each process. A process/port-qualified default
 * therefore prevents one concurrent run from deleting another run's live
 * traces. CI may name a deterministic destination explicitly.
 *
 * @param {{ override: string | undefined; pid: number; port: number }} input
 */
export const browserOutputDirectory = ({ override, pid, port }) => {
  const requested = override?.trim();
  if (override !== undefined && requested?.length === 0) {
    throw new Error("ICARUS_BROWSER_OUTPUT_DIRECTORY must not be empty");
  }
  if (!Number.isInteger(pid) || pid < 1) {
    throw new Error("browser output directory requires a positive process id");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("browser output directory requires a valid port");
  }

  return requested ?? join("..", "test-results", "browser", `${port}-${pid}`);
};
