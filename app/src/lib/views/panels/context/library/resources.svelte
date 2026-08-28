<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import Lightbulb from "@lucide/svelte/icons/lightbulb";
  import Plug from "@lucide/svelte/icons/plug";

  import { Panel, PanelRow, PanelSearch, PanelSection } from "$authored-components/panel";
  import { connectors, resourcesOfKind, type ConnectorRow } from "$capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * Everything a Context could name, grouped by kind.
   *
   * `docs/screen-panel-views/context/library/resources.md` is the specification.
   * Findings are here because a finding is a resource and can be retrieved;
   * questions and hypotheses are not, because they are organisational and no rule
   * can name them. That distinction is the reason this is three sections rather
   * than one list called "everything".
   *
   * A connector stands for the files it synced rather than expanding into them:
   * 312 rows in a 300px panel is not a list anyone reads. What is actually in
   * scope is therefore one level away, which the count on the row admits.
   */
  const documents = $derived(resourcesOfKind("document").current);
  const accepted = $derived(resourcesOfKind("finding").current);
  const connections = $derived(connectors().current);

  let search = $state("");

  const matches = (name: string) => name.toLowerCase().includes(search.trim().toLowerCase());

  const shownDocuments = $derived(documents.filter((row) => matches(row.name)));
  const shownFindings = $derived(accepted.filter((row) => matches(row.name)));
  const shownConnectors = $derived(connections.filter((row) => matches(row.name)));

  const STATE: Record<ConnectorRow["state"], "success" | "attention" | "danger"> = {
    Connected: "success",
    Syncing: "attention",
    Expired: "danger"
  };

  const inspectResource = (id: string) =>
    view.inspect("scope.resolved-resource", { kind: "resource", id });
</script>

<Panel title="Resources">
  <!--
    One field over all three kinds, rather than one per section: you are looking
    for a named thing far more often than you are browsing a category.
  -->
  <PanelSearch
    placeholder="Search resources"
    matched={shownDocuments.length + shownFindings.length + shownConnectors.length}
    total={documents.length + accepted.length + connections.length}
    bind:value={search}
    flush
  >
    <PanelSection title="Documents" count={shownDocuments.length} flush>
      {#each shownDocuments as row (row.id)}
        <PanelRow
          title={row.name}
          meta={row.updated}
          icon={FileText}
          onselect={() => inspectResource(row.id)}
        />
      {/each}
    </PanelSection>

    <PanelSection title="Findings" count={shownFindings.length} flush>
      {#each shownFindings as row (row.id)}
        <PanelRow
          title={row.name}
          meta={row.updated}
          icon={Lightbulb}
          onselect={() => inspectResource(row.id)}
        />
      {/each}
    </PanelSection>

    <PanelSection title="Connector files" count={shownConnectors.length} flush>
      {#each shownConnectors as row (row.id)}
        <PanelRow
          title={row.name}
          sub={row.detail}
          meta="{row.files} files"
          icon={Plug}
          tone={STATE[row.state]}
          onselect={() =>
            view.inspect("project.connector", { kind: "connector", id: row.id })}
        />
      {/each}
    </PanelSection>
  </PanelSearch>
</Panel>
