<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "$lib/simple-components/utils";

  /**
   * A rule read as a sentence, with its parts still selectable.
   *
   * An Automation is one trigger and one action, and the specifications are
   * emphatic that it reads as prose — *When the clock reaches 02:00 in New York,
   * ask Filing Editor to summarise last night's reports* — rather than as a
   * trigger/action pair in two columns. Three surfaces draw the same rule: the
   * library lists it, the inspector explains it, and the editor heads the screen
   * with it. Three hand-written renderings is three ways to read one rule, and
   * they drift.
   *
   * So the sentence is a component, and its clauses are its children.
   *
   * **The connective words belong to this, not to the caller.** *When* and the
   * comma and *do* are set in the muted ink and are not part of any clause, which
   * is what lets a clause be pressed without the grammar around it looking
   * pressable.
   *
   * **A clause is a button only when there is somewhere to go.** In the library a
   * whole row opens the rule, so the clauses inside it are inert; in the editor
   * each half selects, and pressing one opens its lens.
   */
  let {
    lead = "When",
    join = "do",
    when: whenClause,
    then: thenClause,
    tone = "default",
    onwhen,
    onthen
  }: {
    /** The word before the trigger. "When", "Every time", "If". */
    lead?: string;
    /** The word between the halves. "do", "then", "ask". */
    join?: string;
    /** The trigger clause. */
    when: Snippet;
    /** The action clause. */
    then: Snippet;
    /** `inactive` for a rule that is switched off, so the prose reads spent. */
    tone?: "default" | "inactive";
    onwhen?: () => void;
    onthen?: () => void;
  } = $props();

  const CLAUSE = "rounded-control -mx-0.5 px-0.5 font-medium";
</script>

<p
  class={cn(
    "text-body-sm m-0",
    tone === "inactive" ? "text-inactive-text" : "text-ink-secondary"
  )}
>
  <span class="text-ink-muted">{lead}</span>

  {#if onwhen}
    <button
      type="button"
      onclick={onwhen}
      class={cn(CLAUSE, "text-ink-primary hover:bg-surface-panel-hover text-start")}
    >
      {@render whenClause()}
    </button>
  {:else}
    <span class={cn(CLAUSE, "text-ink-primary")}>{@render whenClause()}</span>
  {/if}

  <span class="text-ink-muted">, {join}</span>

  {#if onthen}
    <button
      type="button"
      onclick={onthen}
      class={cn(CLAUSE, "text-ink-primary hover:bg-surface-panel-hover text-start")}
    >
      {@render thenClause()}
    </button>
  {:else}
    <span class={cn(CLAUSE, "text-ink-primary")}>{@render thenClause()}</span>
  {/if}
</p>
