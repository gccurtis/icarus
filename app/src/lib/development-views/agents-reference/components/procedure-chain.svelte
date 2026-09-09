<script lang="ts">
  import NoteBox from "$development-views/agents-reference/components/note-box.svelte";
  import type { Chain } from "$development-views/agents-reference/types";

  let { chain, scope = "chain" }: { chain: Chain; scope?: string } = $props();
</script>

<article class="chain">
  <header>
    <div class="who">
      <span class="ar-pill {chain.kind}">{chain.kind}</span>
      <h3>{chain.name}</h3>
    </div>
    <code>{chain.file}</code>
    <div class="gutter"><NoteBox {scope} label={chain.name} /></div>
  </header>

  <div class="ports">
    <section>
      <span class="port-title">Takes</span>
      {#if chain.input.length === 0}
        <p class="none">Nothing. The scope is the whole input.</p>
      {:else}
        <dl>
          {#each chain.input as field (field.name)}
            <div>
              <dt>{field.name}</dt>
              <dd><code>{field.type}</code>{#if field.note}<span>{field.note}</span>{/if}</dd>
            </div>
          {/each}
        </dl>
      {/if}
    </section>
    <section>
      <span class="port-title">Answers</span>
      <dl>
        {#each chain.output as field (field.name)}
          <div>
            <dt>{field.name}</dt>
            <dd><code>{field.type}</code>{#if field.note}<span>{field.note}</span>{/if}</dd>
          </div>
        {/each}
      </dl>
    </section>
  </div>

  <ol class="steps">
    {#each chain.steps as step, index (index)}
      <li>
        <span class="n">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <p>{step.does}</p>
          {#if step.calls}<code class="calls">{step.calls}</code>{/if}
          {#if step.writes}<span class="writes">writes {step.writes}</span>{/if}
        </div>
      </li>
    {/each}
  </ol>

  {#if chain.refuses.length > 0}
    <div class="refusals">
      <span class="port-title">Refuses</span>
      <ul>
        {#each chain.refuses as refusal, index (index)}
          <li><code>{refusal.reason}</code> {refusal.when}</li>
        {/each}
      </ul>
    </div>
  {/if}

  {#if chain.refreshes.length > 0}
    <div class="refresh">
      <span class="port-title">Then refreshes</span>
      <div>
        {#each chain.refreshes as query (query)}
          <code>{query}</code>
        {/each}
      </div>
    </div>
  {/if}
</article>

<style>
  .chain {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-elevated);
  }

  header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 17rem;
    gap: 0.5rem 1.5rem;
    align-items: start;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--token-border-subtle);
    background: var(--token-surface-panel);
  }

  .who {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem;
  }

  .who h3 {
    margin: 0;
    font-family: var(--token-font-mono);
    font-size: var(--token-text-body-sm);
    font-weight: var(--token-weight-strong);
  }

  header code {
    grid-column: 1;
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
    overflow-wrap: anywhere;
  }

  .gutter {
    grid-column: 2;
    grid-row: 1 / span 2;
  }

  .ports {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 1px;
    background: var(--token-border-subtle);
  }

  .ports section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.85rem 1rem;
    background: var(--token-surface-elevated);
  }

  .port-title {
    color: var(--token-ink-muted);
    font-size: var(--token-text-micro);
    font-weight: var(--token-weight-strong);
    letter-spacing: var(--token-tracking-caps);
    text-transform: uppercase;
  }

  dl {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin: 0;
  }

  dl div {
    display: grid;
    grid-template-columns: minmax(6rem, auto) minmax(0, 1fr);
    gap: 0.75rem;
  }

  dt {
    color: var(--token-ink-primary);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-caption);
    font-weight: var(--token-weight-medium);
    overflow-wrap: anywhere;
  }

  dd {
    display: flex;
    min-width: 0;
    flex-direction: column;
    margin: 0;
  }

  dd code {
    color: var(--token-color-intelligence-text);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
    overflow-wrap: anywhere;
  }

  dd span {
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .none {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps li {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    border-top: 1px solid var(--token-border-subtle);
  }

  .steps .n {
    color: var(--token-color-active-text);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
  }

  .steps p {
    margin: 0;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .calls {
    display: block;
    margin-top: 0.2rem;
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
    overflow-wrap: anywhere;
  }

  .writes {
    display: inline-block;
    margin-top: 0.25rem;
    padding: 0.05rem 0.4rem;
    border: 1px solid var(--token-color-attention-border);
    border-radius: var(--token-radius-control);
    background: var(--token-color-attention-surface);
    color: var(--token-color-attention-text);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
  }

  .refusals,
  .refresh {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--token-border-subtle);
    background: var(--token-surface-panel);
  }

  .refusals ul {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .refusals li {
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .refusals code,
  .refresh code {
    margin-right: 0.4rem;
    color: var(--token-color-danger-text);
    font-family: var(--token-font-mono);
    font-size: var(--token-text-micro);
  }

  .refresh code {
    color: var(--token-color-intelligence-text);
  }

  .refresh div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
