<script lang="ts">
  import { Button } from "$vendored-components/button";
  import { Textarea } from "$vendored-components/textarea";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * Every parameter a template asks for, as a name, what it means, and what it
   * is answered with.
   *
   * **All of them, always, and nothing folded away.** A template's parameters are
   * the shape of the thing you are about to make, so the whole list is on screen
   * and each row reads top to bottom: the name, the sentence whoever made the
   * template wrote, and the value. Nothing here is a disclosure, because a hole
   * you have to open to see is a hole you can forget.
   *
   * **The list scrolls; the modal does not grow.** A template with twelve
   * parameters and one with two open the same size, so nothing jumps.
   *
   * **The value is the control.** Text is a field you type in. A scope is a
   * block reading what it selects, which opens the builder when pressed. A row
   * with nothing in it carries a rule down its left edge.
   */

  export type AnswerRow = {
    /** The parameter's name, and this component's key for it. */
    readonly key: string;
    readonly label: string;
    readonly description?: string;
    readonly kind: "scope" | "text";
    /** What it is answered with, read as words. */
    readonly value: string;
    /** Whether the caller has said anything, as against taking what was suggested. */
    readonly answered: boolean;
    /** Whether it has no answer at all, which only a text parameter can be. */
    readonly missing: boolean;
  };

  let {
    rows,
    disabled = false,
    onscope,
    ontext,
    onreset
  }: {
    rows: readonly AnswerRow[];
    disabled?: boolean;
    /** Open the builder for one scope parameter. */
    onscope: (key: string) => void;
    /** The words typed for one text parameter. */
    ontext: (key: string, words: string) => void;
    /** Put one parameter back to what the template suggests. */
    onreset: (key: string) => void;
  } = $props();

  const trace = traceNode("TemplateAnswers", () => ({
    rows: rows.length,
    missing: rows.filter((row) => row.missing).length
  }));
</script>

<div {...trace} class="answers">
  {#each rows as row (row.key)}
    <article class="answer" class:missing={row.missing}>
      <header>
        <b>{row.label}</b>
        {#if row.answered}
          <Button
            variant="ghost"
            size="xs"
            {disabled}
            title={`Put ${row.label} back to what the template suggests`}
            onclick={() => onreset(row.key)}
          >
            Use the default
          </Button>
        {/if}
      </header>

      <p class="what">
        {row.description ??
          (row.kind === "text" ? "Words this template asks for." : "What this parameter selects.")}
      </p>

      {#if row.kind === "text"}
        <Textarea
          value={row.value}
          rows={2}
          {disabled}
          aria-label={`What ${row.label} says here`}
          placeholder={`What ${row.label.toLocaleLowerCase()} says here`}
          oninput={(event) => ontext(row.key, event.currentTarget.value)}
        />
      {:else}
        <button
          type="button"
          class="scope"
          {disabled}
          title={`Choose what ${row.label} selects here`}
          onclick={() => onscope(row.key)}
        >
          <span class="tag">{row.answered ? "Chosen" : "Default"}</span>
          <span class="rule">{row.value}</span>
        </button>
      {/if}
    </article>
  {/each}
</div>

<style>
  .answers {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
    height: 24rem;
    padding: 0 calc(var(--token-spacing-unit) * 3);
    overflow-y: auto;
  }

  .answer {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 1.5);
    border: 1px solid var(--token-border-subtle);
    border-inline-start: 3px solid transparent;
    border-radius: var(--token-radius-control);
    background: var(--token-surface-elevated);
  }

  .answer.missing { border-inline-start-color: var(--token-color-danger-text); }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  header b {
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    font-weight: 600;
  }

  .what {
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  /* The rule reads to four lines, then scrolls, so one long scope cannot own the modal. */
  .scope {
    display: flex;
    gap: calc(var(--token-spacing-unit) * 1.5);
    align-items: flex-start;
    max-height: 5.5rem;
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 1.5);
    overflow-y: auto;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    text-align: start;
    cursor: pointer;
  }

  .scope:hover { border-color: var(--token-border-strong); background: var(--token-surface-work); }

  .tag {
    flex: none;
    padding: 0 calc(var(--token-spacing-unit) * 1);
    border-radius: var(--token-radius-control);
    background: var(--token-color-accent-1-surface);
    color: var(--token-color-accent-1-text);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  .rule { min-width: 0; }
</style>
