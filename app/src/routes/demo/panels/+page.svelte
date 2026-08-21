<script lang="ts">
  import type { Component } from "svelte";

  /**
   * Every panel, lens, workspace and modal, in one place, for reading them.
   *
   * The four trees are enumerated with `import.meta.glob` rather than a registry
   * file, so a component that lands is on this page without anyone remembering to
   * add it. A registry would be a second list to keep in step with the first, and
   * the first is the filesystem.
   *
   * **Panels are shown at 300px.** A shape that reads well at 800 and breaks at
   * 300 is exactly what this page exists to catch — a flank is 300px and vertical,
   * and nothing about a panel is honest at any other width.
   */
  const MODULES = import.meta.glob("$lib/{context,inspector,workspaces,modals}/**/*.svelte") as Record<
    string,
    () => Promise<{ default: Component }>
  >;

  type Entry = {
    /** `context/project/variables` — what it is called and where it lives. */
    readonly id: string;
    readonly tree: "context" | "inspector" | "workspaces" | "modals";
    readonly subject: string;
    readonly name: string;
    readonly load: () => Promise<{ default: Component }>;
  };

  const TREES = ["context", "inspector", "workspaces", "modals"] as const;

  const ENTRIES: Entry[] = Object.entries(MODULES)
    .map(([path, load]) => {
      const parts = path.split("/lib/")[1].replace(/\.svelte$/, "").split("/");
      const [tree, ...rest] = parts;
      return {
        id: rest.join("/"),
        tree: tree as Entry["tree"],
        subject: rest.length > 1 ? rest[0] : "—",
        name: rest[rest.length - 1],
        load
      };
    })
    .sort((a, b) => a.tree.localeCompare(b.tree) || a.id.localeCompare(b.id));

  let filter = $state("");
  let selectedId = $state(ENTRIES[0]?.id ?? "");

  const shown = $derived(
    ENTRIES.filter((entry) =>
      `${entry.tree}/${entry.id}`.toLowerCase().includes(filter.trim().toLowerCase())
    )
  );

  const selected = $derived(ENTRIES.find((entry) => entry.id === selectedId));

  /** A panel is a flank; a workspace and a modal get the whole plane. */
  const flank = $derived(selected?.tree === "context" || selected?.tree === "inspector");

  /**
   * Every component gets the same bag. Svelte 5 ignores a prop a component does
   * not destructure, so one bag covers all of them — and the alternative is a map
   * of per-component props that goes stale the moment a signature changes.
   */
  const props = {
    personId: "mira",
    open: true,
    onback: () => {},
    onclose: () => {}
  };

  const counts = $derived(
    TREES.map((tree) => ({ tree, count: ENTRIES.filter((entry) => entry.tree === tree).length }))
  );
</script>

<svelte:head><title>Panels — Icarus</title></svelte:head>

<div class="frame">
  <aside class="index">
    <header class="flex flex-col gap-2 p-3">
      <a href="/demo" class="text-caption text-interactive-text w-fit hover:underline">
        ← Design system
      </a>
      <h1 class="text-h3 font-semibold">Panels</h1>
      <p class="text-caption text-ink-muted">
        {#each counts as entry, index (entry.tree)}{index > 0 ? " · " : ""}{entry.count}
          {entry.tree}{/each}
      </p>
      <input
        class="border-border-subtle bg-surface-panel text-body-sm rounded-control border px-2 py-1"
        placeholder="Filter"
        bind:value={filter}
      />
    </header>

    <nav class="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
      {#each TREES as tree (tree)}
        {@const inTree = shown.filter((entry) => entry.tree === tree)}
        {#if inTree.length > 0}
          <p
            class="text-caption text-ink-muted bg-surface-canvas sticky top-0 px-3 py-1 font-semibold tracking-wide uppercase"
          >
            {tree}
          </p>
          {#each inTree as entry (entry.tree + entry.id)}
            <button
              type="button"
              class="hover:bg-surface-hover flex flex-col px-3 py-1 text-start"
              class:bg-surface-selection={entry.id === selectedId && entry.tree === selected?.tree}
              onclick={() => (selectedId = entry.id)}
            >
              <span class="text-body-sm text-ink-primary">{entry.name}</span>
              <span class="text-caption text-ink-muted font-mono">{entry.subject}</span>
            </button>
          {/each}
        {/if}
      {/each}
    </nav>
  </aside>

  <main class="stage">
    {#if selected}
      <p class="text-caption text-ink-muted px-4 py-2 font-mono">
        src/lib/{selected.tree}/{selected.id}.svelte
      </p>
      {#await selected.load()}
        <p class="text-caption text-ink-muted px-4">Loading…</p>
      {:then module}
        <div class="mount" class:flank>
          <module.default {...props} />
        </div>
      {:catch error}
        <p class="text-body-sm text-danger-text px-4">{error.message}</p>
      {/await}
    {:else}
      <p class="text-body-sm text-ink-muted p-4">Nothing built yet.</p>
    {/if}
  </main>
</div>

<style>
  .frame {
    display: grid;
    grid-template-columns: calc(var(--token-spacing-unit) * 60) 1fr;
    height: 100vh;
    overflow: hidden;
    background-color: var(--token-surface-canvas);
    color: var(--token-ink-primary);
  }

  .index {
    display: flex;
    min-height: 0;
    flex-direction: column;
    border-right: 1px solid var(--token-border-subtle);
    background-color: var(--token-surface-panel);
  }

  .stage {
    display: flex;
    min-width: 0;
    flex-direction: column;
    overflow: auto;
    background-color: var(--token-surface-work);
  }

  .mount {
    min-height: 0;
    flex: 1;
  }

  /* A flank is 300px and vertical. Anything else is a lie about the geometry. */
  .mount.flank {
    width: calc(var(--token-spacing-unit) * 75);
    border-right: 1px solid var(--token-border-subtle);
    background-color: var(--token-surface-panel);
  }
</style>
