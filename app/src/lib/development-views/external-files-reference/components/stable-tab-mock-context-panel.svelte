<script lang="ts">
  import { MOCK_CONTEXTS } from "$development-views/external-files-reference/procedures/stable-tab-mock/data";
  import { setMockContextView } from "$development-views/external-files-reference/procedures/stable-tab-mock/commands/set-context-view";
  import { stableTabMockState } from "$development-views/external-files-reference/procedures/stable-tab-mock/context.svelte";
  import {
    availableMockFiles,
    mockDirectories
  } from "$development-views/external-files-reference/procedures/stable-tab-mock/view";

  const state = stableTabMockState();
  const available = $derived(availableMockFiles(state));
  const directories = $derived(mockDirectories(state));
  const contextLabel = $derived(
    MOCK_CONTEXTS.find((context) => context.id === state.contextView)?.label
  );
</script>

<aside class="context-panel" aria-label="Mock External-library Context panel">
  <nav aria-label="Mock External-library context views">
    {#each MOCK_CONTEXTS as context}
      {@const ContextIcon = context.icon}
      <button
        type="button"
        class:active={state.contextView === context.id}
        aria-label={context.label}
        aria-pressed={state.contextView === context.id}
        onclick={() => setMockContextView(state, context.id)}
      >
        <ContextIcon size={15} strokeWidth={1.75} aria-hidden="true" />
      </button>
    {/each}
  </nav>
  <div class="context-body">
    <header><span>CONTEXT</span><strong>{contextLabel}</strong></header>
    {#if state.contextView === "overview"}
      <section>
        <small>LIBRARY</small>
        <dl>
          <div><dt>Files</dt><dd>{available.length}</dd></div>
          <div><dt>Folders</dt><dd>{directories.length}</dd></div>
          <div><dt>Known storage</dt><dd>4.2 MB</dd></div>
        </dl>
      </section>
      <section>
        <small>MATERIAL COVERAGE</small>
        <dl>
          <div><dt>Current</dt><dd>3</dd></div>
          <div><dt>In progress</dt><dd>0</dd></div>
          <div><dt>Managed only</dt><dd>1</dd></div>
        </dl>
      </section>
      <section class="context-note">
        <strong>Library-wide only</strong>
        <p>Selection does not change Overview. File-specific controls and meaning stay in Inspector.</p>
      </section>
    {:else}
      <section>
        <small>DURABLE FILE HISTORY</small>
        <div class="history-list">
          {#each state.history as item}
            <article><strong>{item}</strong><small>Maya Chen · lifecycle event</small></article>
          {/each}
        </div>
      </section>
      <section class="context-note">
        <strong>Survives deletion</strong>
        <p>History is backed by project activity rows, not reconstructed from files that still exist.</p>
      </section>
    {/if}
  </div>
</aside>
