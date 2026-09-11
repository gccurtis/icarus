<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Check from "@lucide/svelte/icons/check";
  import ExternalLink from "@lucide/svelte/icons/external-link";

  import type { Investigation } from "$development-views/backlog-investigations/types";

  let { investigation }: { investigation: Investigation } = $props();

  const statusLabel = {
    resolved: "Recommended contract",
    direction: "Direction established",
    bounded: "Scope bounded"
  } as const;
</script>

<section class="investigation" id={investigation.id} aria-labelledby={`${investigation.id}-title`}>
  <header class="investigation-head">
    <div class="investigation-index">{investigation.number}</div>
    <div>
      <span class="investigation-label">{investigation.label}</span>
      <h2 id={`${investigation.id}-title`}>{investigation.prompt}</h2>
    </div>
    <span class="status status-{investigation.status}">{statusLabel[investigation.status]}</span>
  </header>

  <div class="verdict">
    <span>Answer</span>
    <h3>{investigation.verdict}</h3>
    <p>{investigation.answer}</p>
  </div>

  <div class="investigation-grid">
    <article class="observed">
      <span class="section-kicker">Verified in the current tree</span>
      <ul>
        {#each investigation.observed as fact (fact)}
          <li><Check size={14} aria-hidden="true" /><span>{fact}</span></li>
        {/each}
      </ul>
    </article>

    <article class="contract">
      <span class="section-kicker">Recommended operating contract</span>
      <dl>
        {#each investigation.contract as row (row.concern)}
          <div><dt>{row.concern}</dt><dd>{row.decision}</dd></div>
        {/each}
      </dl>
    </article>
  </div>

  <div class="alternative-wrap">
    <span class="section-kicker">Alternatives considered</span>
    <div class="table-scroll">
      <table>
        <thead><tr><th>Direction</th><th>Benefit</th><th>Tradeoff</th><th>Disposition</th></tr></thead>
        <tbody>
          {#each investigation.alternatives as alternative (alternative.option)}
            <tr>
              <th>{alternative.option}</th>
              <td>{alternative.benefit}</td>
              <td>{alternative.cost}</td>
              <td><span class="decision decision-{alternative.decision}">{alternative.decision}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <div class="execution-grid">
    <article>
      <span class="section-kicker">Implementation order</span>
      <ol>
        {#each investigation.sequence as step, index (step)}
          <li><span>{String(index + 1).padStart(2, "0")}</span><p>{step}</p></li>
        {/each}
      </ol>
    </article>
    <article>
      <span class="section-kicker">Completion evidence</span>
      <ul class="acceptance">
        {#each investigation.acceptance as check (check)}
          <li><Check size={14} aria-hidden="true" /><span>{check}</span></li>
        {/each}
      </ul>
    </article>
  </div>

  <details class="evidence">
    <summary><span>Source evidence</span><strong>{investigation.evidence.length} anchors</strong></summary>
    <div>
      {#each investigation.evidence as item (item.path)}
        <article>
          <ExternalLink size={13} aria-hidden="true" />
          {#if item.href}
            <a href={item.href} target="_blank" rel="noreferrer">{item.path}</a>
          {:else}
            <code>{item.path}</code>
          {/if}
          <p>{item.finding}</p>
        </article>
      {/each}
    </div>
  </details>

  <a class="back-top" href="#top"><ArrowRight size={12} aria-hidden="true" /> Back to index</a>
</section>
