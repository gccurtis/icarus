<script lang="ts">
  import ReferenceHeader from "$development-views/external-files-reference/components/reference-header.svelte";
  import {
    integrationBoundaries,
    integrationChecks,
    integrationLimits,
    integrationWorkflows
  } from "$development-views/external-files-reference/procedures/integration";
  import "$development-views/external-files-reference/components/reference.css";
</script>

<div class="external-files-reference">
  <ReferenceHeader current="integration" />
  <main class="reference-page">
    <header>
      <span class="kicker">Integration audit · September 10, 2026</span>
      <h1>What is covered, and what remains</h1>
      <p class="hero-copy">
        External files join the existing editors, templates, Agents and Research through the same
        scoped capability and durable Store boundaries. This record distinguishes the implemented
        workflows, architectural changes, test evidence, and deliberate product limits.
      </p>
    </header>

    <section class="section" aria-labelledby="certification">
      <div class="section-head">
        <h2 id="certification">Certification status</h2>
        <p>Evidence belongs to the tested code state. Pending rows are not implied passes.</p>
      </div>
      <div class="table-wrap">
        <table class="reference-table">
          <thead><tr><th>Check</th><th>Status</th><th>Evidence</th></tr></thead>
          <tbody>
            {#each integrationChecks as [check, status, evidence]}
              <tr><th scope="row">{check}</th><td>{status}</td><td>{evidence}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section" aria-labelledby="workflows">
      <div class="section-head">
        <h2 id="workflows">Workflow contracts</h2>
        <p>Paths below are relative to <code>app/</code>. Each contract exercises a user-visible chain, not just a helper in isolation.</p>
      </div>
      <div class="card-grid">
        {#each integrationWorkflows as workflow}
          <article class="card">
            <h3>{workflow.title}</h3>
            <p>{workflow.proof}</p>
            <p class="source-path">{workflow.path}</p>
          </article>
        {/each}
      </div>
    </section>

    <section class="section" aria-labelledby="architecture">
      <div class="section-head">
        <h2 id="architecture">Architectural boundaries</h2>
        <p>The directory structure follows state owners and procedural responsibilities. Modularization must preserve observable behavior.</p>
      </div>
      <div class="table-wrap">
        <table class="reference-table">
          <thead><tr><th>Boundary</th><th>Enforcement</th></tr></thead>
          <tbody>
            {#each integrationBoundaries as [boundary, enforcement]}
              <tr><th scope="row">{boundary}</th><td>{enforcement}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section" aria-labelledby="limits">
      <div class="section-head">
        <h2 id="limits">Limits and concessions</h2>
        <p>These are explicit boundaries, not hidden fallback behavior.</p>
      </div>
      <ul>{#each integrationLimits as limit}<li>{limit}</li>{/each}</ul>
    </section>
  </main>
</div>

<style>
  h1 { max-width: 20ch; margin: 0; font-size: clamp(2.5rem, 5vw, 5rem); line-height: 1; letter-spacing: -.045em; }
  .source-path { overflow-wrap: anywhere; font-family: var(--token-font-mono); }
  li { max-width: 90ch; margin-block: 1rem; color: var(--ink-2); }
</style>
