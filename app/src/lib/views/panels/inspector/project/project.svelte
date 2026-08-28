<script lang="ts">
  import Archive from "@lucide/svelte/icons/archive";
  import Settings from "@lucide/svelte/icons/settings";

  import { Separator } from "$lib/components/vendor/separator";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelFaces,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { VIEWER } from "$capabilities/cast";
  import { member } from "$capabilities/collaboration";
  import { activity, people, project } from "$capabilities/project";
  import { viewState } from "$model/client/view-state";

  /**
   * The project itself, and what the inspector shows when nothing more specific
   * is selected.
   *
   * `docs/screen-panel-views/inspector/project/project.md` is the specification.
   * Nothing selected is this lens rather than a blank panel, which is also why
   * the file takes no id — there is one project and the model carries it.
   *
   * **The title is the name, so Identity does not repeat it.** A `Name` field
   * under a heading that already says it costs a row of a 300px panel and tells
   * the reader nothing they have not just read.
   *
   * **Owners is a count, not a name.** The model permits several owners and
   * requires at least one, so a single name in that slot would be a claim the
   * data cannot carry.
   */
  const view = viewState();

  const record = $derived(project().current);
  const everyone = $derived(people().current);
  const viewer = $derived(member(VIEWER.id).current);
  const events = $derived(activity().current);

  /** Archiving has nowhere to write, so it lands here and the State field changes. */
  let archived = $state(false);

  const status = $derived(archived || record.archived ? "Archived" : "Active");

  const ROLES = ["Owner", "Editor", "Viewer"] as const;

  const membership = $derived(
    ROLES.map((role) => ({
      role,
      count: everyone.filter((person) => person.role === role).length
    }))
  );

  /**
   * `Project` has no updated timestamp. The head of the Activity feed is the
   * closest true answer, and it is a time rather than a person for the same
   * reason the section carries no *by* line.
   */
  const updated = $derived(events[0]?.at ?? "—");
</script>

<Panel title={record.name}>
  <PanelFields>
    <PanelField label="Description" stacked>{record.description}</PanelField>
    <PanelField label="State">
      <PanelChip tone={status === "Active" ? "success" : "inactive"}>{status}</PanelChip>
    </PanelField>
    <PanelField label="Your role">{viewer.role}</PanelField>
  </PanelFields>

  <!--
    Counts first, then faces: the counts are the membership and the faces are
    who they happen to be. A strip of four avatars over a project of seven
    people would otherwise read as the whole of it.
  -->
  <PanelSection title="People" count={everyone.length} flush>
    <PanelFields>
      {#each membership as group (group.role)}
        <PanelField label="{group.role}s">{group.count}</PanelField>
      {/each}
    </PanelFields>

    <PanelFaces
      actors={everyone.map((person) => ({ id: person.id, name: person.name }))}
      label="In this project"
      onselect={(id: string) =>
        view.inspect("collaboration.person", { kind: "person", id })}
      onoverflow={() => view.inspect("collaboration.people")}
    />
  </PanelSection>

  <PanelSection title="Dates" open={false} flush>
    <PanelFields>
      <PanelField label="Created">{record.createdAt}</PanelField>
      <PanelField label="Updated">{updated}</PanelField>
    </PanelFields>
    <PanelNote>
      The project records no creator or updater, so these are dates and cannot say who.
    </PanelNote>
  </PanelSection>

  <!--
    Last and shut, because neither is why anyone opened this lens, and Archive
    is separated from Settings because one changes a preference and the other
    changes what the project is.
  -->
  <PanelSection title="Project actions" open={false} flush>
    <PanelActions>
      <!-- There is no settings lens. What the settings surface is remains unspecified. -->
      <PanelButton
        label="Settings"
        icon={Settings}
        onclick={() => view.inspect("project.project")}
      />
    </PanelActions>

    <Separator />

    <PanelActions>
      <PanelButton
        label={archived ? "Archived" : "Archive"}
        icon={Archive}
        tone="danger"
        disabled={archived}
        title={archived ? "This project is archived" : "Take the project out of everyday use"}
        onclick={() => (archived = true)}
      />
    </PanelActions>
    <PanelNote tone="gap">
      What archiving does is undefined: whether an archived project stays readable, whether its
      Automations stop, and whether it can be brought back.
    </PanelNote>
  </PanelSection>
</Panel>
