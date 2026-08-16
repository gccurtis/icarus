import type { CommandsModel } from "$model/client/commands";
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
  readonly storage: ClientStorage;
  readonly workbench: WorkbenchModel;
  readonly commands: CommandsModel;
}
