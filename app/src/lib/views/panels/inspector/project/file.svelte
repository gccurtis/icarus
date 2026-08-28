<script lang="ts">
  import RotateCw from "@lucide/svelte/icons/rotate-cw";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { connectors, resourcesOfKind } from "$capabilities/library";
  import { health, project } from "$capabilities/project";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A file that came in from somewhere, and whether anything in it can be read.
   *
   * `docs/screen-panel-views/inspector/project/file.md` is the specification.
   * The lens leads with identity and exists mostly for Extraction: an external
   * file is only useful once text has come out of it.
   *
   * The panel title is the file name, so the identity band does not repeat it.
   *
   * **The failure is stated as what it costs**, not as an error code. "Scanned
   * document with no text layer" tells an engineer what happened; "nothing in
   * this file is retrievable" tells the person who was looking for it why their
   * search came back empty.
   *
   * **Extraction is read from the health query.** Health records problems and
   * nothing else, so a file with no entry is a file with no reported problem —
   * which is not the same claim as text having come out, and is not written as
   * one.
   */
  let { fileId }: { fileId?: string } = $props();

  const view = viewState();

  const id = $derived(fileId ?? view.selection?.id ?? "r-nerc");

  const files = $derived(resourcesOfKind("file").current);
  const file = $derived(files.find((candidate) => candidate.id === id) ?? files[0]);

  /** The record has no MIME type. The extension is the only thing in it that says what this is. */
  const dot = $derived(file.name.lastIndexOf("."));
  const type = $derived(dot > 0 ? file.name.slice(dot + 1).toUpperCase() : "—");

  /** Where it came from: a connector that carries this name, or an upload. */
  const source = $derived(connectors().current.find((row) => row.name === file.updatedBy));

  const problem = $derived(
    health().current.find((issue) => issue.group === "Extraction" && issue.title === file.name)
  );

  const stillSyncing = $derived(
    source === undefined
      ? "—"
      : source.state === "Expired"
        ? "No — authentication expired"
        : source.state === "Syncing"
          ? "Yes — syncing now"
          : "Yes"
  );

  /** Nothing re-runs an extraction yet, so a retry lands here and the button says so. */
  let retried = $state(false);
</script>

<Panel title={file.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: project().current.name, key: "project.project" }, { label: file.name }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Type">{type}</PanelField>
    <PanelField label="Size">—</PanelField>
    <PanelField label="Origin" stacked>{source?.name ?? "Uploaded"}</PanelField>
  </PanelFields>
  <PanelNote tone="gap">No byte size is stored on a resource, so Size cannot be filled in.</PanelNote>

  <PanelSection title="Extraction" flush>
    {#if problem === undefined}
      <PanelFields>
        <PanelField label="State">Nothing reported</PanelField>
      </PanelFields>
      <PanelNote>
        No extraction problem is recorded against this file. That is not the same as text having
        come out of it.
      </PanelNote>
    {:else}
      <PanelFields>
        <PanelField label="State"><PanelChip tone="attention">Could not read</PanelChip></PanelField>
        <PanelField label="Reason" stacked>{problem.detail}</PanelField>
        <PanelField label="Attempted">{file.updated}</PanelField>
      </PanelFields>

      <PanelNote>Nothing in this file is retrievable until text comes out of it.</PanelNote>

      <PanelActions>
        <PanelButton
          label={retried ? "Retry requested" : "Retry extraction"}
          icon={RotateCw}
          disabled={retried}
          title={retried ? "A retry is already queued" : "Read the file again and try to pull text out"}
          onclick={() => (retried = true)}
        />
      </PanelActions>
      <PanelNote tone="gap">
        The reason is not stored with a retryable flag, so nothing here can say whether a second
        attempt would read any differently.
      </PanelNote>
    {/if}
  </PanelSection>

  <!-- Context rather than the reason the lens was opened, so it arrives shut. -->
  <PanelSection title="Connector" open={false} flush>
    {#if source === undefined}
      <PanelNote>Uploaded rather than synced, so there is no connector behind it.</PanelNote>
    {:else}
      <PanelFields>
        <PanelField label="Connector" stacked>
          <PanelLink
            label={source.name}
            title="Open the connector"
            onselect={() =>
              view.inspect("project.connector", { kind: "connector", id: source.id })}
          />
        </PanelField>
        <PanelField label="Still syncing" stacked>{stillSyncing}</PanelField>
      </PanelFields>
    {/if}
  </PanelSection>
</Panel>
