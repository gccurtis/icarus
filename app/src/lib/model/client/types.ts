import type { CommandsModel } from "$model/client/commands";
import type { ConfigurationModel, ConfigurationSnapshot } from "$model/client/configuration";
import type { CopilotModel } from "$model/client/copilot";
import type { ResourceRuntimesModel } from "$model/client/resource-runtimes";
import type { ClientStorage } from "$model/client/storage";
import type { WorkbenchModel } from "$model/client/workbench";

/**
 * What a client instance is built from.
 *
 * The project comes from the route — `/app/[project]` — which is why the model
 * is initialized rather than built lazily on first read: a self-building
 * singleton cannot take a constructor argument, so it would have to reach for
 * `page` itself or accept a setter and be observable half-built.
 *
 * Storage is a parameter so a test can stand a whole graph up over a fake store
 * in one call. Absent, the root builds one over this project's `localStorage`
 * key, which is what production does.
 */
export type ClientModelInput = {
  readonly project: string;
  /**
   * The settings the server published for this tab, from the layout's load data.
   *
   * Required rather than optional, and with no default anywhere. A client whose
   * thresholds silently fell back to literals would be a client configured by
   * two files that can disagree — which is the whole reason this crosses at all.
   * A test builds one with the values it means to prove something about.
   */
  readonly configuration: ConfigurationSnapshot;
  readonly storage?: ClientStorage;
};

/**
 * One client instance's model: everything holding this user's state for one
 * browser tab, on one project, for that tab's whole life.
 *
 * Named as a type rather than inferred from the constructor because the
 * consumers that matter have to name it — the layout declaring what it
 * initialized, the test substituting one object, the helper taking the graph as
 * a parameter.
 */
export interface ClientModel {
  /**
   * The project this instance acts on. Read from the route once, and carried
   * here so nothing downstream has to reach back into `page` for it — a remote
   * function cannot see the page that called it, so every capability call needs
   * this value and none of them should find it a different way.
   */
  readonly project: string;
  readonly configuration: ConfigurationModel;
  readonly storage: ClientStorage;
  readonly resourceRuntimes: ResourceRuntimesModel;
  readonly workbench: WorkbenchModel;
  readonly commands: CommandsModel;
  readonly copilot: CopilotModel;

  /**
   * Ends the instance. Run by the layout that initialized it, through `$effect`
   * cleanup.
   *
   * The first object to own something releasable is what brought this — a
   * runtime holds a subscription and an unsent buffer, and both have to go
   * somewhere deliberate when the tab does. Objects are released in reverse
   * construction order.
   *
   * Synchronous. A closing tab has almost no budget, and an `await` here is how
   * the last resource's edits fail to leave.
   */
  close(): void;
}
