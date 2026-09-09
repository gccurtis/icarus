import { keepDraft } from "$app-views/categories/research/procedures/drafts";
import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ResearchScope } from "$representation/data/types/investigation/research-turn";

/**
 * Everything the chat surface holds for as long as it is mounted.
 *
 * One owner rather than eleven bindings beside the markup, so that what a
 * command does to the surface is a method on a thing rather than an assignment
 * reaching back into a component. Nothing here outlives the tab except the
 * draft, which is handed to the workspace on the way out.
 */
export class ThreadState {
  /** Advanced by the clock so relative times stay true without a reload. */
  now = $state(Date.now());
  /** The turn the centre has already asked the inspector to open. */
  claimed = $state<string>();
  text = $state("");
  /** Which chat the field currently belongs to, so a restore never saves over. */
  held = $state<string>();
  scope = $state("project");
  /** "kind id" of the chosen resource, empty when the whole project is in scope. */
  resource = $state("");
  pending = $state(false);
  stopping = $state(false);
  /** The question as typed, shown until the turn that carries it exists. */
  asking = $state<string>();
  failure = $state<string>();

  /** False once the surface is gone, so a late answer writes nothing. */
  mounted = true;

  constructor(private readonly view: WorkspaceStateModel) {}

  /** What the composer is showing, as the capability takes it. */
  chosenScope(): ResearchScope {
    if (this.scope === "project" || this.resource === "") return { kind: "project" };
    const at = this.resource.indexOf(" ");
    return {
      kind: "resource",
      ref: { kind: this.resource.slice(0, at), id: this.resource.slice(at + 1) }
    } as ResearchScope;
  }

  chooseScope(chosen: string): void {
    this.scope = chosen === "project" ? "project" : "resource";
    this.resource = chosen === "project" ? "" : chosen;
  }

  dispose(): void {
    this.mounted = false;
    keepDraft(this.view, this.held, this.text);
  }
}
