<script lang="ts">
  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import { hrefOf, pageOf } from "$development-views/agents-reference/procedures/navigation";
  import type { Question } from "$development-views/agents-reference/types";

  let {
    questions,
    showPage = false,
    root = ""
  }: { questions: readonly Question[]; showPage?: boolean; root?: string } = $props();
</script>

<div class="questions">
  {#each questions as question (question.n)}
    <Noted scope="question" label={`Q${question.n} ${question.title}`}>
      <article>
        <header>
          <span class="n">Q{String(question.n).padStart(2, "0")}</span>
          <h3>{question.title}</h3>
          {#if showPage}<a href={hrefOf(root, pageOf(question.page))}>{pageOf(question.page).label} →</a>{/if}
        </header>
        <p class="matters">{question.matters}</p>
        <ol>
          {#each question.options as option, index (index)}
            <li>{option}</li>
          {/each}
        </ol>
        <p class="recommendation">
          <span>Recommendation, not a decision</span>
          {question.recommendation}
        </p>
      </article>
    </Noted>
  {/each}
</div>

<style>
  .questions {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  article {
    padding: 0.9rem 1.1rem 1rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-elevated);
  }

  header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.75rem;
  }

  .n {
    color: var(--token-color-active-text);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
    letter-spacing: var(--token-tracking-caps);
  }

  h3 {
    margin: 0;
    font-size: var(--token-text-body);
    font-weight: var(--token-weight-strong);
    letter-spacing: var(--token-tracking-heading);
  }

  header a {
    margin-left: auto;
    color: var(--token-color-interactive-text);
    font-size: var(--token-text-caption);
    font-weight: var(--token-weight-strong);
    text-decoration: none;
  }

  header a:hover {
    text-decoration: underline;
  }

  .matters {
    max-width: var(--token-measure-prose);
    margin: 0.35rem 0 0;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  ol {
    display: grid;
    gap: 0.35rem;
    max-width: var(--token-measure-prose);
    margin: 0.6rem 0 0;
    padding-left: 1.25rem;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  ol li::marker {
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-caption);
  }

  .recommendation {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    max-width: var(--token-measure-prose);
    margin: 0.75rem 0 0;
    padding: 0.55rem 0.8rem;
    border: 1px dashed var(--token-color-attention-border);
    border-radius: var(--token-radius-control);
    background: var(--token-color-attention-surface);
    color: var(--token-color-attention-text);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .recommendation span {
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
    letter-spacing: var(--token-tracking-caps);
    text-transform: uppercase;
  }
</style>
