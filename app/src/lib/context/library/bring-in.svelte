<script lang="ts">
  import Plug from "@lucide/svelte/icons/plug";
  import Plus from "@lucide/svelte/icons/plus";
  import Upload from "@lucide/svelte/icons/upload";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelNote,
    PanelProgress,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { connectors, ingestion, providers, type ConnectorRow } from "$mock-capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Getting outside material into the project.
   *
   * `docs/screen-panel-views/context/library/bring-in.md` is the specification.
   * Neither uploading a file nor connecting a system opens an editor, so neither
   * competes with the three things the New Tab exists to make — which is why both
   * live in the panel rather than in the centre.
   *
   * Extraction starting on arrival is said out loud. An uploaded file is not
   * retrievable material until text comes out of it, and that delay is real.
   *
   * An existing connector and a new one open the same lens: connecting is the
   * same work whether the row is broken or has never existed.
   */
  const batch = $derived(ingestion().current);
  const connections = $derived(connectors().current);
  const available = $derived(providers().current);

  const STATE: Record<ConnectorRow["state"], "success" | "attention" | "danger"> = {
    Connected: "success",
    Syncing: "attention",
    Expired: "danger"
  };

  const connect = (id: string) => view.inspect("library.connect", { kind: "connector", id });
</script>

<Panel title="Bring in">
  <PanelSection title="Upload" flush>
    <PanelActions>
      <PanelButton
        label="Choose files…"
        icon={Upload}
        tone="primary"
        onclick={() => view.inspect("library.upload")}
      />
    </PanelActions>
    <PanelNote>{batch.then}</PanelNote>
    <PanelProgress
      label={batch.label}
      detail="{batch.finished} of {batch.total}"
      value={(batch.finished / batch.total) * 100}
    />
  </PanelSection>

  <!-- A broken connection is fixed from where you noticed it, so state is on the row. -->
  <PanelSection title="Your connectors" count={connections.length} flush>
    {#each connections as row (row.id)}
      <PanelRow
        title={row.name}
        sub={row.detail}
        meta={row.state}
        icon={Plug}
        tone={STATE[row.state]}
        onselect={() => connect(row.id)}
      />
    {/each}
  </PanelSection>

  <PanelSection title="Add a connector" count={available.length} flush>
    {#each available as provider (provider.id)}
      <PanelRow
        title={provider.name}
        sub={provider.brings}
        icon={Plus}
        onselect={() =>
          view.inspect("library.connect", { kind: "provider", id: provider.id })}
      />
    {/each}
  </PanelSection>
</Panel>
