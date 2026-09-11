<script lang="ts">
  import {
    Panel,
    PanelActor,
    PanelBanner,
    PanelChip,
    PanelCrumbs,
    PanelEmpty,
    PanelField,
    PanelFields,
    PanelSection,
    PanelSkeleton,
    PanelStat,
    PanelStats,
    PanelTimeline
  } from "$authored-components/panel";
  import {
    isInspectorView,
    workspaceState
  } from "$model/client/workspace-state";
  import { projectPerson } from "$app-views/general/person/procedures/read-person";

  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  const view = workspaceState();
  const userId = $derived(
    view.selection?.kind === "person" ? view.selection.id : undefined
  );
  const answer = $derived(projectPerson(userId));
  const person = $derived(answer?.ready ? answer.current : undefined);
  const now = Date.now();

  const titleCase = (value: string): string =>
    value.length === 0 ? value : `${value[0].toLocaleUpperCase()}${value.slice(1)}`;

  const calendarDate = (at: number): string =>
    new Date(at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });

  const ago = (at: number): string => {
    const gap = Math.max(0, now - at);
    if (gap < HOUR) return `${Math.max(1, Math.round(gap / MINUTE))}m`;
    if (gap < DAY) return `${Math.max(1, Math.round(gap / HOUR))}h`;
    if (gap < 2 * DAY) return "Yesterday";
    return calendarDate(at);
  };

  const recent = $derived(
    (person?.recentActivity ?? []).map((entry) => ({
      id: entry.id,
      what: `${entry.what}: ${entry.target.label}`,
      ...(entry.context === undefined && entry.detail === undefined
        ? {}
        : { detail: entry.detail ?? entry.context?.label }),
      time: ago(entry.at),
      onselect: () =>
        view.inspect("project-overview.activity", { kind: "activity", id: entry.id })
    }))
  );

  const navigate = (key: string) => {
    if (isInspectorView(key)) view.inspect(key);
  };
</script>

<Panel title={person?.name ?? "Person"} titleLines={2}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: "People", key: "general.people" },
        { label: person?.name ?? "Person" }
      ]}
      onnavigate={navigate}
    />
  {/snippet}

  <div class="flex flex-col gap-1 pt-1">
    {#if userId === undefined}
      <PanelEmpty title="Select a person to inspect." />
    {:else if answer?.error}
      <PanelBanner title="Person unavailable" tone="attention">
        {answer.error instanceof Error ? answer.error.message : String(answer.error)}
      </PanelBanner>
    {:else if !answer?.ready}
      <PanelSkeleton shape="fields" count={6} />
    {:else if person === null}
      <PanelEmpty title="This person is not in the current project." />
    {:else if person !== undefined}
      <div class="px-3 pb-2">
        <PanelActor
          name={person.name}
          role={`${titleCase(person.role)} in this project`}
          src={person.imageUrl}
          size="head"
        />
      </div>

      <PanelSection title="In this project" flush>
        <PanelFields proportional>
          <PanelField label="Role" hierarchy>
            <PanelChip tone="interactive">{titleCase(person.role)}</PanelChip>
          </PanelField>
          {#if person.email !== undefined}
            <PanelField label="Email" mono stacked hierarchy>
              <span class="break-all" title={person.email}>{person.email}</span>
            </PanelField>
          {/if}
          <PanelField label="Joined" mono stacked hierarchy>{calendarDate(person.joinedAt)}</PanelField>
        </PanelFields>
      </PanelSection>

      <PanelSection title="Contribution" flush>
        <div class="border-border-subtle bg-surface-panel-hover border-y py-2.5">
        <PanelStats label={`${person.name}'s project contribution`}>
          <PanelStat value={String(person.contribution.events)} label="events" />
          <PanelStat value={String(person.contribution.comments)} label="comments" />
          <PanelStat value={String(person.contribution.resources)} label="resources" />
        </PanelStats>
        </div>
      </PanelSection>

      <PanelSection title="Recent activity" count={recent.length} flush>
        <PanelTimeline
          entries={recent}
          label={`${person.name}'s recent activity`}
          interactiveRows
          compact
          empty="No activity has been recorded for this person."
        />
      </PanelSection>
    {/if}
  </div>
</Panel>
