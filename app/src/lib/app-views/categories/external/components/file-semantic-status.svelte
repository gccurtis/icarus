<script lang="ts">
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import { PanelChip } from "$authored-components/panel";
  import { externalFileInspectorContext } from "$app-views/categories/external/procedures/file-inspector-context.svelte";

  const context = externalFileInspectorContext();
  const file = $derived(context.file());
  const material = $derived(file.semantic.material);
  const exact = $derived(file.semantic.exact);
  const descriptor = $derived(material.descriptor);
</script>

<div class="semantic-details">
  {#if exact.eligible}
    <div class="profile"><h4>Exact text lane</h4><p>Prose is indexed from the original UTF-8 text without a generated summary. {exact.objectCount} semantic {exact.objectCount === 1 ? "object is" : "objects are"} currently published.</p></div>
  {/if}
  {#if material.error}<p class="semantic-error">{material.error}</p>{/if}
  {#if material.profile}
    <div class="profile"><h4>{file.subkind === "image" ? "Native visual" : "Material profile"}</h4><ul>
      {#each material.profile.facts as fact}<li>{fact}</li>{/each}
      {#each material.profile.warnings as warning}<li class="warning">{warning}</li>{/each}
    </ul>{#if file.subkind === "image"}<p>The original image is embedded directly; no generated text summary is required.</p>{/if}</div>
  {/if}
  {#if descriptor}
    <div class="summary">
      <div class="summary-title"><Sparkles size={13} aria-hidden="true" /><h4>Generated description</h4></div>
      <p class="summary-body">{descriptor.summary}</p>
      {#if descriptor.purpose}<p><strong>Purpose:</strong> {descriptor.purpose}</p>{/if}
      {#if descriptor.entities.length > 0 || descriptor.themes.length > 0}<div class="chips">{#each [...descriptor.entities, ...descriptor.themes] as value (value)}<PanelChip>{value}</PanelChip>{/each}</div>{/if}
    </div>
  {/if}
  {#if !exact.eligible && !material.eligible}
    <p class="section-copy">This format is retained and downloadable, but it is not currently admitted to a semantic lane.</p>
  {/if}
</div>

<style>
  .summary-title, .chips { display: flex; align-items: center; }
  h4, p, ul { margin: 0; }
  h4 { color: var(--token-ink-secondary); font-size: var(--token-text-caption); font-weight: 600; }
  .semantic-error { color: var(--token-color-danger-text); }
  .summary, .profile { display: flex; flex-direction: column; gap: calc(var(--token-spacing-unit) * 2); padding: calc(var(--token-spacing-unit) * 2.5); border: 1px solid var(--token-border-subtle); border-radius: var(--token-radius-control); background: var(--token-surface-panel-hover); }
  .profile, .summary, .semantic-error, .section-copy { margin-top: calc(var(--token-spacing-unit) * 2); }
  .section-copy, .semantic-error, .summary p, .profile li, .profile p { color: var(--token-ink-muted); font-size: var(--token-text-caption); line-height: var(--token-text-caption-leading); }
  .profile ul { padding-inline-start: calc(var(--token-spacing-unit) * 4); }
  .profile .warning { color: var(--token-color-attention-text); }
  .summary-title { gap: calc(var(--token-spacing-unit) * 1.5); color: var(--token-color-intelligence-text); }
  .summary .summary-body { color: var(--token-ink-primary); font-size: var(--token-text-body-sm); line-height: var(--token-text-body-sm-leading); }
  .chips { flex-wrap: wrap; gap: calc(var(--token-spacing-unit) * 1.5); }
</style>
