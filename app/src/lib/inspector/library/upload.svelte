<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import FileUp from "@lucide/svelte/icons/file-up";

  import {
    Panel,
    PanelCrumbs,
    PanelNote,
    PanelProgress,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { ingestion, uploads, type UploadRow } from "$mock-capabilities/library";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Files on their way into the project.
   *
   * `docs/screen-panel-views/inspector/library/upload.md` is the specification.
   * Two bands, and they answer different questions: the file list is what is
   * going in — name, size and type, so a wrong file is caught before it lands —
   * and ingestion is how far the batch has got and what happens after the bytes
   * arrive.
   *
   * **Per-file progress is a figure, not a second bar.** A bar for each file
   * under a bar for the batch says the same thing twice in a 300px column, so a
   * file in flight carries its percentage where its state would otherwise sit.
   */
  const view = viewState();

  const staged = $derived(uploads().current);
  const batch = $derived(ingestion().current);

  const ICON = {
    Queued: FileUp,
    Uploading: FileUp,
    Extracting: FileUp,
    Done: Check,
    Failed: CircleAlert
  } as const;

  const TONE = {
    Queued: "default",
    Uploading: "active",
    Extracting: "intelligence",
    Done: "success",
    Failed: "danger"
  } as const;

  /** The percentage only while bytes are moving. Extraction is not 100% of anything. */
  const state = (upload: UploadRow) =>
    upload.state === "Uploading" ? `${upload.percent}%` : upload.state;
</script>

<Panel title="Upload">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Bring in" }, { label: "Upload" }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelSection title="Files" count={staged.length} flush>
    {#each staged as upload (upload.id)}
      <PanelRow
        title={upload.name}
        sub="{upload.size} · {upload.mime}"
        meta={state(upload)}
        icon={ICON[upload.state]}
        tone={TONE[upload.state]}
      />
    {/each}
  </PanelSection>

  <PanelSection title="Ingestion" flush>
    <PanelProgress
      label={batch.label}
      detail="{batch.finished} of {batch.total} done"
      value={Math.round((batch.finished / batch.total) * 100)}
    />
    <PanelNote>{batch.then}</PanelNote>
    <PanelNote tone="gap">
      Staged upload ids survive a tab switch; raw file handles do not survive a
      reload. An upload interrupted by a reload has to fail visibly rather than
      appear to still be running.
    </PanelNote>
  </PanelSection>
</Panel>
