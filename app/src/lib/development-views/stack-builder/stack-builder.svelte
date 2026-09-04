<script lang="ts">
  import Catalogue from "$development-views/stack-builder/components/catalogue.svelte";
  import EntryDetail from "$development-views/stack-builder/components/entry-detail.svelte";
  import GeneratePanel from "$development-views/stack-builder/components/generate-panel.svelte";
  import MockFrame from "$development-views/stack-builder/components/mock-frame.svelte";
  import StackTree from "$development-views/stack-builder/components/stack-tree.svelte";
  import { catalogueFrom } from "$development-views/stack-builder/procedures/catalogue";
  import { createStack, provideStack } from "$development-views/stack-builder/shared/stack.svelte";
  import type { ManifestRecord, LogRecord } from "$development-views/stack-builder/types";
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";

  let {
    indexes,
    files
  }: {
    indexes: Record<string, Record<string, unknown>>;
    files: Record<string, unknown>;
  } = $props();

  // svelte-ignore state_referenced_locally
  const stack = createStack(catalogueFrom(indexes, files));
  provideStack(stack);

  let slug = $state("untitled");
  let theme = $state<"celestial" | "cyberpunk">("celestial");
  let revision = $state(0);
  let notice = $state("");

  const refused = async (response: Response, fallback: string): Promise<string> => {
    const said = (await response.json().catch(() => ({}))) as { message?: string };
    return said.message ?? `${fallback} (${response.status})`;
  };

  const save = async () => {
    notice = "";
    const response = await fetch("/demo/stack-builder/manifest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug, title: stack.title, nodes: stack.nodes })
    });
    notice = response.ok ? `saved to ${slug}` : await refused(response, "save refused");
  };

  const open = async () => {
    notice = "";
    const response = await fetch(`/demo/stack-builder/manifest?slug=${slug}`);
    if (!response.ok) {
      notice = await refused(response, "open refused");
      return;
    }
    const body = (await response.json()) as { records: LogRecord[] };
    const last = [...body.records]
      .reverse()
      .find((record): record is ManifestRecord => record.kind === "manifest");
    if (last) stack.load({ title: last.title, nodes: last.nodes });
    else notice = `no stack called ${slug}`;
  };
</script>

<svelte:head><title>Stack builder — Icarus</title></svelte:head>

<div class="builder">
  <header class="head">
    <a href="/demo" class="text-caption text-interactive-text hover:underline">← Design system</a>
    <h1 class="text-h4 font-semibold">Stack builder</h1>
    <Input class="h-7 w-56" bind:value={stack.title} aria-label="What this stack is called" />
    <Input class="h-7 w-40 font-mono" bind:value={slug} aria-label="File name" />
    <Button variant="outline" size="sm" onclick={save}>Save</Button>
    <Button variant="ghost" size="sm" onclick={open}>Open</Button>
    <span class="text-caption text-ink-muted ms-auto">
      {stack.entries.length} components · {stack.nodes.length} in the stack
    </span>
    {#if notice}<span class="text-caption text-ink-secondary">{notice}</span>{/if}
  </header>

  <aside class="list"><Catalogue /></aside>
  <main class="stack"><StackTree /></main>
  <section class="detail"><EntryDetail /></section>

  <aside class="ai">
    <GeneratePanel {slug} {theme} ongenerated={() => (revision += 1)} />
    <div class="frame">
      <MockFrame {theme} {revision} />
    </div>
    <div class="border-border-subtle flex items-center gap-2 border-t p-2">
      <Button
        variant="ghost"
        size="sm"
        onclick={() => (theme = theme === "celestial" ? "cyberpunk" : "celestial")}
      >
        {theme}
      </Button>
      <span class="text-caption text-ink-muted">the mock renders in the system font</span>
    </div>
  </aside>
</div>

<style>
  .builder {
    --builder-list: calc(var(--token-spacing-unit) * 72);
    --builder-ai: calc(var(--token-spacing-unit) * 110);
    --builder-detail: calc(var(--token-spacing-unit) * 56);

    display: grid;
    grid-template-columns: var(--builder-list) minmax(0, 1fr) var(--builder-ai);
    grid-template-rows: auto minmax(0, 1fr) minmax(0, var(--builder-detail));
    grid-template-areas:
      "head head head"
      "list stack ai"
      "list detail ai";
    height: 100vh;
    overflow: hidden;
    background-color: var(--token-surface-canvas);
    color: var(--token-ink-primary);
  }

  .head {
    grid-area: head;
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 3);
    border-bottom: 1px solid var(--token-border-subtle);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }

  .list {
    grid-area: list;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    border-inline-end: 1px solid var(--token-border-subtle);
    background-color: var(--token-surface-panel);
  }

  .stack {
    grid-area: stack;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    background-color: var(--token-surface-work);
  }

  .detail {
    grid-area: detail;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    border-block-start: 1px solid var(--token-border-subtle);
    background-color: var(--token-surface-panel);
  }

  .ai {
    grid-area: ai;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 0;
    border-inline-start: 1px solid var(--token-border-subtle);
    background-color: var(--token-surface-panel);
  }

  .frame {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background-color: var(--token-surface-canvas);
  }
</style>
