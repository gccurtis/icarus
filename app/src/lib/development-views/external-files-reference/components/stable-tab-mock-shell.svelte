<script lang="ts">
  import Bot from "@lucide/svelte/icons/bot";
  import FileText from "@lucide/svelte/icons/file-text";
  import Files from "@lucide/svelte/icons/files";
  import House from "@lucide/svelte/icons/house";
  import LayoutTemplate from "@lucide/svelte/icons/layout-template";
  import Plus from "@lucide/svelte/icons/plus";

  import StableTabMockContextPanel from "$development-views/external-files-reference/components/stable-tab-mock-context-panel.svelte";
  import StableTabMockInspector from "$development-views/external-files-reference/components/stable-tab-mock-inspector.svelte";
  import StableTabMockLibrary from "$development-views/external-files-reference/components/stable-tab-mock-library.svelte";
  import { stableTabMockState } from "$development-views/external-files-reference/procedures/stable-tab-mock/context.svelte";
  import {
    mockFileName,
    selectedMockFile
  } from "$development-views/external-files-reference/procedures/stable-tab-mock/view";

  const state = stableTabMockState();
  const selected = $derived(selectedMockFile(state));
  const statusSelection = $derived(
    state.selectedDirectory ?? (
      selected === undefined ? "Nothing selected" : mockFileName(state, selected)
    )
  );
</script>

<section class="workspace-specimen external-stable-tab-mock" aria-label="Interactive External singleton manager mock">
  <header class="specimen-label">
    <div>
      <span>INTERACTIVE WORKSPACE SPECIMEN</span>
      <strong>Select a file or folder; manage it in Inspector</strong>
    </div>
    <span>singleton library · no file editors</span>
  </header>

  <div class="mock-topbar">
    <strong>ICARUS</strong><span>Atlas planning</span><small>External · project library</small>
  </div>
  <div class="mock-tabs" role="tablist" aria-label="Open mock tabs">
    <button type="button" role="tab" aria-selected="false" aria-label="Overview"><House size={13} aria-hidden="true" /></button>
    <button type="button" role="tab" aria-selected="false" aria-label="Agents"><Bot size={13} aria-hidden="true" /></button>
    <button type="button" role="tab" aria-selected="false" aria-label="Templates"><LayoutTemplate size={13} aria-hidden="true" /></button>
    <button class="singleton active" type="button" role="tab" aria-selected="true"><Files size={13} aria-hidden="true" /> External</button>
    <span class="tab-divider" aria-hidden="true"></span>
    <button class="named-tab" type="button" role="tab" aria-selected="false"><FileText size={12} aria-hidden="true" /> Q3 filing <span aria-hidden="true">×</span></button>
    <button class="new-tab" type="button" aria-label="New tab"><Plus size={13} aria-hidden="true" /></button>
  </div>

  <div class="mock-frame">
    <StableTabMockContextPanel />
    <StableTabMockLibrary />
    <StableTabMockInspector />
  </div>
  <footer class="mock-status">
    <span>Atlas planning</span><span>External</span><span>{statusSelection}</span>
    <strong>Singleton workspace state saved</strong>
  </footer>
</section>
