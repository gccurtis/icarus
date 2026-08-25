<script lang="ts">
  import {
    Panel,
    PanelActor,
    PanelChoice,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelToggle
  } from "$lib/unique-components/panel";
  import { activityBy, commentsBy, member, presenceFor } from "$mock-capabilities/collaboration";
  import { asPersonId, type PersonId } from "$mock-capabilities/cast";
  import { viewState } from "$model/client/view-state";

  /**
   * A person, inside this project.
   *
   * `docs/screen-panel-views/inspector/collaboration/person.md` is the
   * specification. Three bands: who they are, what they have said, what they have
   * done.
   *
   * **There is nowhere here to write to them.** A comment belongs on the thing it
   * is about — you reach a person by mentioning them on the memo, the cell or the
   * slide, where the remark has a subject and everyone who needs it can see it. A
   * composer under someone's name would be a private channel in a project that
   * has none.
   */
  let { personId }: { personId?: PersonId } = $props();

  const view = viewState();

  const id = $derived(personId ?? asPersonId(view.selection?.id) ?? "mira");

  const person = $derived(member(id).current);
  const presence = $derived(presenceFor(id).current);
  const comments = $derived(commentsBy(id).current);
  const activity = $derived(activityBy(id).current);

  /** Which comments, and whether settled ones are still worth showing. */
  let show = $state<"all" | "mentions">("all");
  let hideResolved = $state(true);

  const SHOW = [
    { value: "all", label: "All" },
    { value: "mentions", label: "Mentions of you" }
  ] as const;

  const shown = $derived(
    comments
      .filter((comment) => (show === "mentions" ? comment.mentionsViewer : true))
      .filter((comment) => (hideResolved ? !comment.resolved : true))
  );

  /**
   * Matched of total whenever either filter is on, so a narrowed list never reads
   * as everything they have said.
   */
  const count = $derived(
    shown.length === comments.length ? comments.length : `${shown.length} of ${comments.length}`
  );

  /**
   * The presence line, or the role alone. A last-seen time in a presence slot is
   * a different claim wearing presence's clothes.
   */
  const standing = $derived(presence.here ? `${person.role} · here now, in ${presence.at}` : person.role);

  const where = (comment: (typeof comments)[number]) =>
    comment.location === undefined ? comment.resource : `${comment.resource}, ${comment.location}`;
</script>

<Panel title={person.name}>
  <!--
    The head of the lens carries the picture rather than a row-sized face, and no
    `onselect`: this actor is the subject of the panel and cannot be navigated to
    from inside itself.
  -->
  <PanelActor name={person.name} kind="person" role={standing} size="head" />

  <PanelFields>
    <PanelField label="Email" mono>{person.email}</PanelField>
    <PanelField label="Role">{person.role}</PanelField>
    <PanelField label="Member since">{person.joinedAt}</PanelField>
  </PanelFields>

  <!--
    Two controls, because two axes. Which comments is a choice between
    alternatives; whether a settled thread is still worth showing is an
    independent yes or no that applies to either. One row of chips offering
    "Mentions of you" and "Resolved" together would be a control that cannot say
    what picking both means.
  -->
  <PanelSection title="Comments" {count} flush>
    <PanelChoice
      label="Show"
      value={show}
      options={SHOW}
      onchange={(next) => (show = next as "all" | "mentions")}
    />
    <PanelToggle
      label="Hide resolved"
      checked={hideResolved}
      onchange={(next) => (hideResolved = next)}
    />

    {#each shown as comment (comment.id)}
      <PanelRow
        title={where(comment)}
        sub={comment.excerpt}
        meta={comment.resolved ? `${comment.age} · resolved` : comment.age}
        tone={comment.mentionsViewer ? "attention" : "default"}
        onselect={() => view.inspect("collaboration.comment", { kind: "comment", id: comment.id })}
      />
    {/each}
  </PanelSection>

  <!--
    Context rather than the reason the panel was opened, so it arrives shut. It
    carries no commenting: that is the section above, and an activity feed holding
    both would be the same rows twice.
  -->
  <PanelSection title="Activity" open={false} flush>
    {#each activity as entry (entry.id)}
      <!-- Only what left a resource behind is a row you can follow. -->
      <PanelRow
        title="{entry.verb} {entry.subject}"
        meta={entry.age}
        onselect={entry.subjectId === undefined
          ? undefined
          : () =>
              view.inspect("project.resource", { kind: "resource", id: entry.subjectId ?? "" })}
      />
    {:else}
      <PanelNote>Nothing yet in this project.</PanelNote>
    {/each}
  </PanelSection>
</Panel>
