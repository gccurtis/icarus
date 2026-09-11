<script lang="ts">
  import { Button } from "$vendored-components/button";
  import { Textarea } from "$vendored-components/textarea";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * Every slot a template asks for, one at a time.
   *
   * **One question on screen, and all of them in view.** A slot is a question,
   * and a page of twelve questions is read as a form rather than answered as
   * one. So the body holds a single slot — its name, what it stands for, the
   * prompt it fills if it fills one, and the control — while the tabs above
   * keep the whole shape visible and say which still need an answer.
   *
   * **Red is the only thing that stops you.** A scope always has an answer,
   * because the whole project is the floor; only words can be missing. When no
   * tab is red the template can be placed as it stands, and the button that
   * does it sits right there rather than at the end of a walk.
   *
   * **The value is the control.** Text is a field you type in. A scope is a
   * block reading what it selects, which opens the builder when pressed.
   */

  export type AnswerRow = {
    /** The slot's name, and this component's key for it. */
    readonly key: string;
    readonly label: string;
    readonly description?: string;
    readonly kind: "scope" | "text";
    /** What it is answered with, read as words. */
    readonly value: string;
    /** Whether the caller has said anything, as against taking what was suggested. */
    readonly answered: boolean;
    /** Whether it has no answer at all, which only a text slot can be. */
    readonly missing: boolean;
  };

  let {
    rows,
    prompts = {},
    disabled = false,
    onscope,
    ontext,
    onreset,
    onaccept
  }: {
    rows: readonly AnswerRow[];
    /** The prompt behind a slot, by slot name, when a prompt is behind it. */
    prompts?: Readonly<Record<string, string>>;
    disabled?: boolean;
    /** Open the builder for one scope slot. */
    onscope: (key: string) => void;
    /** The words typed for one text slot. */
    ontext: (key: string, words: string) => void;
    /** Put one slot back to what the template suggests. */
    onreset: (key: string) => void;
    /** Take everything as it stands and place the template. */
    onaccept?: () => void;
  } = $props();

  let at = $state(0);

  /** A slot answered and then removed must not leave the walk past its end. */
  const index = $derived(Math.min(at, Math.max(rows.length - 1, 0)));
  const shown = $derived(rows[index]);
  const asked = $derived(shown === undefined ? undefined : prompts[shown.key]);
  const missing = $derived(rows.filter((row) => row.missing).length);
  const ready = $derived(rows.length > 0 && missing === 0);

  const trace = traceNode("TemplateAnswers", () => ({ rows: rows.length, missing, at: index }));

  /** Next lands on the first slot that still needs words, if any are left after this one. */
  const step = (by: number) => {
    at = Math.min(Math.max(index + by, 0), Math.max(rows.length - 1, 0));
  };
</script>

<div class="ask" {...trace}>
  {#if rows.length === 0}
    <p class="none">This template asks for nothing. Place it as it is.</p>
  {:else}
    <div class="tabs" role="tablist" aria-label="Slots to fill">
      {#each rows as row, position (row.key)}
        <button
          type="button"
          role="tab"
          class="tab"
          class:missing={row.missing}
          class:here={position === index}
          aria-selected={position === index}
          {disabled}
          onclick={() => (at = position)}
        >
          <span class="tab-name">{row.label}</span>
          {#if row.missing}<span class="dot" aria-label="needs words"></span>{/if}
        </button>
      {/each}
    </div>

    {#if shown !== undefined}
      <article class="answer" class:missing={shown.missing}>
        <header>
          <h3>{shown.label}</h3>
          <span class="of">{index + 1} of {rows.length}</span>
        </header>

        {#if shown.description}
          <p class="means">{shown.description}</p>
        {/if}

        {#if asked}
          <blockquote class="prompt">
            <span>The prompt</span>
            <p>{asked}</p>
          </blockquote>
        {/if}

        {#if shown.kind === "text"}
          <label class="words">
            <span class="what">Words to fill it with</span>
            <Textarea
              value={shown.value}
              rows={4}
              {disabled}
              aria-label={`What ${shown.label} says here`}
              placeholder="What it says in this copy"
              oninput={(event) => ontext(shown.key, (event.currentTarget as HTMLTextAreaElement).value)}
            />
          </label>
        {:else}
          <div class="selects">
            <span class="what">What it reads here</span>
            <button
              type="button"
              class="scope"
              {disabled}
              onclick={() => onscope(shown.key)}
            >
              <span class="tag">{shown.answered ? "Chosen" : "Default"}</span>
              <span class="rule">{shown.value}</span>
            </button>
            {#if shown.answered}
              <div class="undo">
                <Button size="xs" variant="ghost" {disabled} onclick={() => onreset(shown.key)}>
                  Back to the default
                </Button>
              </div>
            {/if}
          </div>
        {/if}
      </article>
    {/if}

    <footer class="walk">
      <div class="steps">
        <Button size="xs" variant="ghost" disabled={disabled || index === 0} onclick={() => step(-1)}>
          Previous
        </Button>
        <Button
          size="xs"
          variant="ghost"
          disabled={disabled || index >= rows.length - 1}
          onclick={() => step(1)}
        >
          Next
        </Button>
      </div>
      {#if onaccept !== undefined}
        <Button size="xs" disabled={disabled || !ready} onclick={onaccept}>
          {ready ? "Accept all defaults" : `${missing} still needs words`}
        </Button>
      {/if}
    </footer>
  {/if}
</div>

<style>
  .ask {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    height: 26rem;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .none {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-body-sm);
  }

  .tabs {
    display: flex;
    gap: calc(var(--token-spacing-unit) * 1);
    overflow-x: auto;
    padding-bottom: calc(var(--token-spacing-unit) * 0.5);
    scrollbar-width: thin;
  }

  .tab {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
    padding: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 1.5);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    color: var(--token-ink-secondary);
    cursor: pointer;
    font-size: var(--token-text-caption);
    font-weight: 650;
    line-height: var(--token-text-caption-leading);
  }

  .tab:hover:not(:disabled) {
    border-color: var(--token-border-strong);
    color: var(--token-ink-primary);
  }

  .tab.here {
    border-color: var(--token-color-interactive-text);
    background: var(--token-color-interactive-surface);
    color: var(--token-color-interactive-text);
  }

  .tab.missing {
    border-color: var(--token-color-danger-text);
    color: var(--token-color-danger-text);
  }

  .tab-name {
    max-width: 12rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dot {
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 999px;
    background: var(--token-color-danger-text);
  }

  .answer {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 2.5);
    border: 1px solid var(--token-border-subtle);
    border-inline-start: 3px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-elevated);
  }

  .answer.missing {
    border-inline-start-color: var(--token-color-danger-text);
  }

  .answer header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .answer h3 {
    margin: 0;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body);
    font-weight: 650;
    line-height: var(--token-text-body-leading);
  }

  .of {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    white-space: nowrap;
  }

  .means {
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .prompt {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 0.5);
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2);
    border-inline-start: 2px solid var(--token-border-strong);
    background: var(--token-surface-work);
  }

  .prompt span,
  .what {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    font-weight: 650;
    letter-spacing: 0.06em;
    line-height: var(--token-text-caption-leading);
    text-transform: uppercase;
  }

  .prompt p {
    margin: 0;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .words,
  .selects {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 0.75);
  }

  .scope {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 0.75);
    align-items: flex-start;
    padding: calc(var(--token-spacing-unit) * 1.5);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    cursor: pointer;
    text-align: start;
  }

  .scope:hover:not(:disabled) {
    border-color: var(--token-border-strong);
  }

  .tag {
    padding: 0 calc(var(--token-spacing-unit) * 1);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-work);
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    font-weight: 650;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .rule {
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .undo {
    display: flex;
  }

  .walk {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .steps {
    display: flex;
    gap: calc(var(--token-spacing-unit) * 1);
  }
</style>
