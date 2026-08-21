<script lang="ts">
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelToggle
  } from "$lib/unique-components/panel";
  import {
    connector,
    providers,
    type ConnectorScope,
    type ProviderRow
  } from "$mock-capabilities/library";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Connecting to an outside system, or repairing a connection.
   *
   * `docs/screen-panel-views/inspector/library/connect.md` is the
   * specification. The launcher's short form — the full connector view, with
   * delivery and sync history, is `inspector/project/connector.md`.
   *
   * **A required scope is drawn as a switch that is on and cannot be moved.**
   * Scope is chosen explicitly and never inferred from the provider, so what a
   * connector will be permitted to read is a set of answers rather than a
   * sentence; a required one is still an answer, and hiding it would leave the
   * list looking like the whole of what is granted when it is not.
   */
  let { connectorId = "cn-sharepoint" }: { connectorId?: string } = $props();

  const detail = $derived(connector(connectorId).current);
  const provider = $derived(
    providers().current.find((row: ProviderRow) => row.name === detail.provider)
  );

  /** Empty until a scope is touched, so an untouched one still reads from the door. */
  let granted = $state<Record<string, boolean>>({});

  const isGranted = (scope: ConnectorScope) => granted[scope.name] ?? scope.granted;

  const grantedCount = $derived(
    detail.scopes.filter((scope: ConnectorScope) => isGranted(scope)).length
  );
</script>

<Panel title={detail.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "New tab" }, { label: "Bring in" }, { label: detail.name }]}
      onnavigate={(key: string) => mockWorkbench.inspect(key)}
    />
  {/snippet}

  <PanelSection title="Provider" flush>
    <PanelFields>
      <PanelField label="Provider">{detail.provider}</PanelField>
      {#if provider}
        <PanelField label="Brings">{provider.brings}</PanelField>
      {/if}
      <PanelField label="Purpose" stacked>{detail.purpose}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Scope" count="{grantedCount} of {detail.scopes.length}" flush>
    {#each detail.scopes as scope (scope.name)}
      <PanelRow title={scope.name} meta={scope.required ? "Required" : "Optional"}>
        {#snippet children()}
          <span class="scope">
            <PanelToggle
              label={scope.name}
              checked={isGranted(scope)}
              disabled={scope.required}
              onchange={(next: boolean) => (granted = { ...granted, [scope.name]: next })}
            />
            <span class="text-body-sm text-ink-primary truncate font-mono">{scope.name}</span>
          </span>
        {/snippet}
      </PanelRow>
    {/each}
    <PanelNote>
      Chosen explicitly, never inferred from the provider. A required scope cannot
      be withheld and the connection will not work without it.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Authentication" flush>
    <PanelFields>
      <PanelField label="State">
        <PanelChip tone={detail.auth === "Connected" ? "success" : "danger"}>
          {detail.auth}
        </PanelChip>
      </PanelField>
      {#if detail.lastSync}
        <PanelField label="Last sync">{detail.lastSync}</PanelField>
      {/if}
    </PanelFields>

    <PanelActions>
      <PanelButton
        label="Reconnect"
        icon={RefreshCw}
        tone={detail.auth === "Connected" ? "default" : "primary"}
        title="Signs in again and returns to this launcher tab with its selection restored."
      />
    </PanelActions>

    <PanelNote tone="gap">
      A callback that lands on a tab which has since been closed needs a defined
      outcome, and there is none yet.
    </PanelNote>
  </PanelSection>
</Panel>

<style>
  /* The switch and the permission it grants, on one line inside the row. */
  .scope {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
  }
</style>
