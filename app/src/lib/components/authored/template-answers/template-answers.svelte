<script lang="ts">
  import { Button } from "$vendored-components/button";
  import { Textarea } from "$vendored-components/textarea";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * Every parameter a template asks for, as a key and what it is answered with.
   *
   * **All of them, always.** A template's parameters are the shape of the thing
   * you are about to make, so the list is the whole list even when most rows say
   * Default. What is missing is the only thing that needs finding, and a row
   * that needs words carries a rule down its left edge until it has some.
   *
   * **The description lives one press away.** A row opens to explain itself,
   * which is where a sentence written by whoever made the template belongs —
   * rather than under every row at once, where it becomes wallpaper.
   *
   * **The value is the control.** A scope's value opens the builder; a text
   * parameter's opens a field under the description. Nothing here is a menu.
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

  /**
   * The first row that needs words opens itself, once, so what is missing is the
   * first thing read. After that the disclosure is whoever is reading it.
   */
  let open = $state<string | undefined>(undefined);
  let started = false;

  $effect(() => {
    if (started) return;
    started = true;
    open = rows.find((row) => row.missing)?.key;
  });

  const toggle = (key: string) => {
    open = open === key ? undefined : key;
  };
</script>

<div {...trace} class="answers">
  {#each rows as row (row.key)}
    <article class="answer" class:missing={row.missing} class:open={open === row.key}>
      <div class="head">
        <button
          type="button"
          class="key"
          aria-expanded={open === row.key}
          {disabled}
          onclick={() => toggle(row.key)}
        >
          <span class="mark" aria-hidden="true">{open === row.key ? "▾" : "▸"}</span>
          {row.label}
        </button>

        {#if row.kind === "scope"}
          <Button
            variant={row.answered ? "secondary" : "outline"}
            size="xs"
            {disabled}
            title={`Choose what ${row.label} selects here`}
            onclick={() => onscope(row.key)}
          >
            {row.value}
          </Button>
        {:else}
          <Button
            variant={row.missing ? "outline" : "secondary"}
            size="xs"
            {disabled}
            title={`Write what ${row.label} says here`}
            onclick={() => (open = row.key)}
          >
            {row.missing ? "Needs input" : row.value}
          </Button>
        {/if}
      </div>

      {#if open === row.key}
        <div class="body">
          <p class="what">
            {row.description ?? (row.kind === "text" ? "Words this template asks for." : "What this parameter selects.")}
          </p>

          {#if row.kind === "text"}
            <Textarea
              value={row.value}
              rows={3}
              {disabled}
              aria-label={`What ${row.label} says here`}
              placeholder={`What ${row.label.toLocaleLowerCase()} says here`}
              oninput={(event) => ontext(row.key, event.currentTarget.value)}
            />
          {/if}

          {#if row.answered}
            <div class="reset">
              <Button
                variant="ghost"
                size="xs"
                {disabled}
                title={`Put ${row.label} back to what the template suggests`}
                onclick={() => onreset(row.key)}
              >
                Use the default
              </Button>
            </div>
          {/if}
        </div>
      {/if}
    </article>
  {/each}
</div>

<style>
  .answers {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  .answer {
    border: 1px solid var(--token-border-subtle);
    border-inline-start: 3px solid transparent;
    border-radius: var(--token-radius-control);
    background: var(--token-surface-elevated);
  }

  .answer.missing { border-inline-start-color: var(--token-color-danger-text); }
  .answer.open { background: var(--token-surface-panel); }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 1.5);
  }

  .key {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    font-weight: 600;
    text-align: start;
    cursor: pointer;
  }

  .mark { color: var(--token-ink-muted); font-size: 10px; }

  .body {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: 0 calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 1.5);
  }

  .what {
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .reset { display: flex; }
</style>
