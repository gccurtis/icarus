<script lang="ts">
  import { onMount, untrack, type Snippet } from "svelte";

  import Noted from "$development-views/agents-reference/components/noted.svelte";
  import ReferenceHeader from "$development-views/agents-reference/components/reference-header.svelte";
  import { PAGES, hrefOf, referenceRoot } from "$development-views/agents-reference/procedures/navigation";
  import { createNoteLog, provideNoteLog } from "$development-views/agents-reference/shared/note-log.svelte";
  import type { PageRecord } from "$development-views/agents-reference/types";
  import "$development-views/agents-reference/components/reference.css";

  let { page, project, children }: { page: PageRecord; project: string; children: Snippet } = $props();

  const root = $derived(referenceRoot(project));

  const log = provideNoteLog(
    createNoteLog(`${untrack(() => referenceRoot(project))}/notes`, untrack(() => page.slug))
  );

  onMount(() => {
    void log.load();
  });

  const at = $derived(PAGES.findIndex((candidate) => candidate.slug === page.slug));
  const previous = $derived(at > 0 ? PAGES[at - 1] : undefined);
  const next = $derived(at < PAGES.length - 1 ? PAGES[at + 1] : undefined);
</script>

<svelte:head>
  <title>{page.label} · Agents reference — Icarus</title>
</svelte:head>

<div class="agents-reference">
  <ReferenceHeader current={page.slug} {root} {project} />

  <main class="ar-page">
    <Noted scope="page" label={page.title}>
      <header class="ar-mast">
        <div>
          <a class="ar-back" href={page.slug === "overview" ? "/demo" : root}>
            ← {page.slug === "overview" ? "All demos" : "Agents overview"}
          </a>
          <span class="ar-kicker">{page.index} · {page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p class="ar-lede">{page.lede}</p>
        </div>
        <aside class="ar-readout">
          <span>Readout</span>
          <dl>
            {#each page.readout as entry (entry.label)}
              <div><dt>{entry.label}</dt><dd>{entry.value}</dd></div>
            {/each}
          </dl>
        </aside>
      </header>
    </Noted>

    <div class="ar-strip">
      <span>Notes go in the right-hand column. Enter saves; nothing is kept in the browser.</span>
      <span class="status">
        {#if log.status === "unavailable"}
          <span class="ar-danger">The log is unreachable, so notes will not save.</span>
        {:else if log.status === "ready"}
          <span class="ar-mono">{log.path}</span>
        {/if}
        <span class="tabular">
          {log.total} on this page · {log.everywhere} in all
        </span>
      </span>
    </div>

    {@render children()}
  </main>

  <footer class="ar-footer">
    <nav aria-label="Neighbouring pages">
      {#if previous}<a href={hrefOf(root, previous)}>← {previous.index} {previous.label}</a>{/if}
      {#if next}<a href={hrefOf(root, next)}>{next.index} {next.label} →</a>{/if}
    </nav>
    <span>Branch work/agents · the surfaces on these pages are the built ones</span>
  </footer>
</div>

<style>
  .status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1rem;
  }

  .tabular {
    color: var(--token-ink-secondary);
    font-variant-numeric: tabular-nums;
  }
</style>
