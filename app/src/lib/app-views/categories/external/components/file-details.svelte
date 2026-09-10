<script lang="ts">
  import { externalFileInspectorContext } from "$app-views/categories/external/procedures/file-inspector-context.svelte";

  const context = externalFileInspectorContext();
  const file = $derived(context.file());
  const exactDate = (at: number): string => new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(at));
</script>

<section aria-labelledby="details-heading">
  <h3 id="details-heading">Details</h3>
  <dl>
    <dt>Original</dt><dd title={file.originalName}>{file.originalName}</dd>
    <dt>Type</dt><dd title={file.mediaType}>{file.mediaType}</dd>
    <dt>Kind</dt><dd>{file.subkind}</dd>
    <dt>Size</dt><dd>{file.sizeLabel}</dd>
    <dt>Availability</dt><dd>{file.native.state === "available" ? "Available" : file.native.state === "missing" ? "Missing" : "Corrupt"}</dd>
    <dt>Uploaded</dt><dd title={exactDate(file.createdAt)}>{exactDate(file.createdAt)}</dd>
    <dt>Updated</dt><dd title={exactDate(file.updatedAt)}>{exactDate(file.updatedAt)}</dd>
    <dt>Added by</dt><dd>{file.createdByName}</dd>
    <dt>Updated by</dt><dd>{file.updatedByName}</dd>
    <dt>Origin</dt><dd>{file.origin.label}</dd>
  </dl>
</section>

<style>
  h3, dl { margin: 0; }
  h3 { color: var(--token-ink-muted); font-size: var(--token-text-caption); font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  dl { display: grid; grid-template-columns: minmax(0, 4.5rem) minmax(0, 1fr); gap: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2); margin-top: calc(var(--token-spacing-unit) * 2); font-size: var(--token-text-caption); line-height: var(--token-text-caption-leading); }
  dt { color: var(--token-ink-muted); }
  dd { overflow: hidden; margin: 0; color: var(--token-ink-secondary); text-align: end; text-overflow: ellipsis; white-space: nowrap; }
</style>
