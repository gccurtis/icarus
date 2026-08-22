<script lang="ts">
  import Plug from "@lucide/svelte/icons/plug";
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import Unplug from "@lucide/svelte/icons/unplug";

  import { Separator } from "$lib/simple-components/separator";
  import {
    Panel,
    PanelActions,
    PanelActor,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelProgress,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { connector, connectors } from "$mock-capabilities/library";
  import type { ConnectorDetail } from "$mock-capabilities/library";
  import { project } from "$mock-capabilities/project";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One connection to an outside system: what it may read, how material
   * arrives, and whether it is working.
   *
   * `docs/screen-panel-views/inspector/project/connector.md` is the
   * specification.
   *
   * **Sync now is disabled while authentication is expired, and says so.** The
   * order matters — a sync started against a dead token fails a minute later
   * with an error that reads like a new problem, so the control that explains
   * itself is the better one.
   *
   * **Reconnect goes to the connect panel** rather than doing anything here.
   * Re-authenticating is the same flow as authenticating, and a second one that
   * lived in this lens would be the same screen written twice.
   */
  let { connectorId = "cn-sharepoint" }: { connectorId?: string } = $props();

  const view = viewState();

  const detail = $derived(connector(connectorId).current);

  /** The row carries the synced file count; the detail carries everything else. */
  const row = $derived(connectors().current.find((candidate) => candidate.id === connectorId));

  const STATUS: Record<ConnectorDetail["auth"], string> = {
    Connected: "Connected",
    Expired: "Authentication expired",
    "Never connected": "Never connected"
  };

  const TONE = {
    Connected: "success",
    Expired: "danger",
    "Never connected": "neutral"
  } as const;

  const expired = $derived(detail.auth === "Expired");

  /** Neither has a door to write to, so both land here and the panel says what changed. */
  let syncing = $state(false);
  let disconnected = $state(false);
</script>

<Panel title={detail.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: project().current.name, key: "project.project" }, { label: detail.name }]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  <!-- A connector acts in this project, so it is drawn as the actor it is. -->
  <PanelActor name={detail.provider} kind="connector" role={detail.purpose} size="head" />

  <PanelFields>
    <PanelField label="Provider">{detail.provider}</PanelField>
    <PanelField label="Display name" stacked>{detail.name}</PanelField>
    <PanelField label="Status">
      <PanelChip tone={TONE[detail.auth]}>{STATUS[detail.auth]}</PanelChip>
    </PanelField>
  </PanelFields>

  <!--
    Both halves are chosen explicitly and neither is inferred from the provider,
    which is why a scope that was asked for and refused is still a row here.
  -->
  <PanelSection title="Scope and delivery" count={detail.scopes.length} flush>
    {#each detail.scopes as scope (scope.name)}
      <PanelRow
        title={scope.name}
        sub={scope.granted ? "Granted" : "Not granted"}
        meta={scope.required ? "Required" : "Optional"}
        titleTone={scope.required && !scope.granted ? "danger" : "default"}
      />
    {/each}
    <PanelNote tone="gap">
      How material arrives is not stored on a connector, so delivery cannot be said here.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Synchronization" flush>
    <PanelFields>
      <PanelField label="Last sync">{detail.lastSync ?? "—"}</PanelField>
      {#if expired && row !== undefined}
        <PanelField label="Error" stacked>{row.detail}</PanelField>
      {/if}
      <PanelField label="Files">{row?.files ?? "—"}</PanelField>
    </PanelFields>

    {#if syncing}
      <!-- No extent is reported, so the bar says running rather than sitting at nothing. -->
      <PanelProgress label="Syncing" />
    {/if}

    <PanelNote>
      One last-sync record is kept. This is the last attempt, not a trend.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Actions" flush>
    <PanelActions>
      <PanelButton
        label="Reconnect"
        icon={Plug}
        tone={expired ? "primary" : "default"}
        onclick={() => view.inspect("library.connect", { kind: "connector", id: detail.id })}
      />
      <PanelButton
        label="Sync now"
        icon={RefreshCw}
        disabled={expired || syncing}
        title={expired
          ? "Reconnect first — authentication expired"
          : syncing
            ? "A sync is running"
            : "Pull everything in scope again"}
        onclick={() => (syncing = true)}
      />
    </PanelActions>

    <Separator />

    <PanelActions>
      <PanelButton
        label={disconnected ? "Disconnected" : "Disconnect"}
        icon={Unplug}
        tone="danger"
        disabled={disconnected}
        title={disconnected ? "This connection is removed" : "Remove this connection"}
        onclick={() => (disconnected = true)}
      />
    </PanelActions>
    <PanelNote tone="gap">
      What happens to the {row?.files ?? 0} files already synced is undefined: whether they stay as project
      resources, become orphaned, or are removed with the connection.
    </PanelNote>
  </PanelSection>
</Panel>
