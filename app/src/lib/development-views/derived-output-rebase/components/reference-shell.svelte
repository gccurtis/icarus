<script lang="ts">
  import type { Snippet } from "svelte";

  import {
    PAGES,
    hrefOf,
    referenceRoot
  } from "$development-views/derived-output-rebase/procedures/navigation";
  import { AUDIT } from "$development-views/derived-output-rebase/procedures/audit";
  import type { RebasePage } from "$development-views/derived-output-rebase/types";
  import "$development-views/derived-output-rebase/components/reference.css";

  let {
    page,
    project,
    children
  }: { page: RebasePage; project: string; children: Snippet } = $props();

  const root = $derived(referenceRoot(project));
  const at = $derived(PAGES.findIndex((candidate) => candidate.slug === page.slug));
  const previous = $derived(at > 0 ? PAGES[at - 1] : undefined);
  const next = $derived(at < PAGES.length - 1 ? PAGES[at + 1] : undefined);
</script>

<svelte:head>
  <title>{page.label} · Derived-output rebase — Icarus</title>
</svelte:head>

<div class="reb-root">
  <header class="reb-nav">
    <a class="reb-brand" href="/demo">
      <span class="reb-brand-mark">R</span>
      <span><b>Integration control room</b><small>derived output + current main</small></span>
    </a>
    <nav aria-label="Rebase reference pages">
      {#each PAGES as candidate (candidate.slug)}
        <a
          class:active={candidate.slug === page.slug}
          aria-current={candidate.slug === page.slug ? "page" : undefined}
          href={hrefOf(root, candidate)}
        >
          <span>{candidate.index}</span>{candidate.label}
        </a>
      {/each}
    </nav>
    <div class="reb-snapshot"><span></span> as-built record · {AUDIT.captured}</div>
  </header>

  <main class="reb-page">
    <header class="reb-mast">
      <div>
        <a class="reb-back" href={page.slug === "overview" ? "/demo" : root}>
          ← {page.slug === "overview" ? "all demos" : "readiness"}
        </a>
        <span class="reb-eyebrow">{page.index} / {page.eyebrow}</span>
        <h1>{page.title}</h1>
        <p>{page.lede}</p>
      </div>
      <aside class="reb-heads" aria-label="Integrated branches">
        <div class="source"><span>protected source</span><b>{AUDIT.sourceBranch}</b><code>{AUDIT.sourceHead}</code></div>
        <i aria-hidden="true"></i>
        <div class="target"><span>target</span><b>{AUDIT.targetBranch}</b><code>{AUDIT.targetHead}</code></div>
      </aside>
    </header>

    {@render children()}
  </main>

  <footer class="reb-footer">
    <span>Rebased at {AUDIT.rebasedHead} · protected source remains at {AUDIT.sourceHead}</span>
    <nav aria-label="Adjacent reference pages">
      {#if previous}<a href={hrefOf(root, previous)}>← {previous.label}</a>{/if}
      {#if next}<a href={hrefOf(root, next)}>{next.label} →</a>{/if}
    </nav>
  </footer>
</div>
