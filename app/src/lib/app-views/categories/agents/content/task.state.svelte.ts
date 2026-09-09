import type { Working } from "$app-views/categories/agents/procedures/run";

/**
 * What the task surface holds for as long as it is mounted.
 *
 * Two halves in one owner: what an existing task's surface is doing, and the
 * four drafts a task that does not exist yet is being written into. They share a
 * surface because the same tab is either showing a task or making one.
 */
export class TaskState implements Working {
  /** The task whose lens has already been opened, so it opens once. */
  claimed = $state<string>();

  message = $state("");
  /** Which question tab is showing, and what has been answered into each. */
  chosenTab = $state<string>();
  picked = $state<Record<string, string>>({});
  other = $state<Record<string, string>>({});

  draftPersona = $state<string | undefined>(undefined);
  draftTitle = $state("");
  draftInstruction = $state("");
  draftTools = $state<string | undefined>(undefined);

  busy = $state<string>();
  failure = $state<string>();
  mounted = true;

  settled(questionId: string): void {
    this.picked = { ...this.picked, [questionId]: "" };
    this.other = { ...this.other, [questionId]: "" };
  }
}
