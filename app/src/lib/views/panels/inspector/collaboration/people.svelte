<script lang="ts">
  import { Panel, PanelNote, PanelRow, PanelSection } from "$authored-components/panel";
  import { VIEWER, type Person } from "$capabilities/cast";
  import { members, presenceFor } from "$capabilities/collaboration";
  import { viewState } from "$model/client/view-state";

  /**
   * Everybody in the project at once, rather than one person.
   *
   * `docs/screen-panel-views/inspector/collaboration/people.md` is the
   * specification. This is what you get for pressing "+4 more" instead of a
   * face, so it is a roster and not a profile: every row opens the person lens.
   *
   * **The overflow row summarises rather than hides.** A truncated list ending
   * in a bare count says how many people you cannot see; saying what they are —
   * three editors, one viewer — is the part that answers the question, and
   * pressing it shows them all here rather than sending the reader somewhere
   * else.
   */
  let { limit = 3 }: { limit?: number } = $props();

  const view = viewState();

  const all = $derived(members().current);

  /** Presence, from the presence door only. See the note at the foot. */
  const here = $derived(all.filter((person) => presenceFor(person.id).current.here));

  let showAll = $state(false);
  const shown = $derived(showAll ? all : all.slice(0, limit));
  const rest = $derived(all.slice(shown.length));

  const PLURAL: Record<Person["role"], string> = {
    Owner: "owners",
    Editor: "editors",
    Viewer: "viewers"
  };

  const ROLES = ["Owner", "Editor", "Viewer"] as const;

  /** "3 editors · 1 viewer" — what the hidden rows are, not just how many. */
  const summary = $derived(
    ROLES.map((role) => ({ role, count: rest.filter((person) => person.role === role).length }))
      .filter((group) => group.count > 0)
      .map((group) =>
        group.count === 1 ? `1 ${group.role.toLowerCase()}` : `${group.count} ${PLURAL[group.role]}`
      )
      .join(" · ")
  );

  const openPerson = (id: string) => view.inspect("collaboration.person", { kind: "person", id });

  /** Where they are, and whether they are you. */
  const whereabouts = (person: Person) => {
    const at = presenceFor(person.id).current.at;
    if (at === undefined) return undefined;
    return person.id === VIEWER.id ? `${at} · you` : at;
  };
</script>

<Panel title="Everyone">
  <PanelSection title="Here now" count={here.length} flush>
    {#if here.length === 0}
      <PanelNote>Nobody has the project open right now.</PanelNote>
    {/if}
    {#each here as person (person.id)}
      <PanelRow
        title={person.name}
        sub={whereabouts(person)}
        tone="active"
        onselect={() => openPerson(person.id)}
      />
    {/each}
  </PanelSection>

  <!--
    Matched of total while the list is truncated, so a shortened roster never
    reads as the whole membership.
  -->
  <PanelSection
    title="Everyone"
    count={shown.length === all.length ? all.length : `${shown.length} of ${all.length}`}
    flush
  >
    {#each shown as person (person.id)}
      <PanelRow
        title={person.name}
        sub={person.role}
        meta={person.id === VIEWER.id ? "you" : undefined}
        onselect={() => openPerson(person.id)}
      />
    {/each}

    {#if rest.length > 0}
      <PanelRow title="+{rest.length} more" sub={summary} onselect={() => (showAll = true)} />
    {/if}
  </PanelSection>

  <PanelNote tone="gap">
    Presence needs an ephemeral collaboration channel, which does not exist yet. It is never
    inferred from a last-seen time and never from Activity: both would report someone as here who
    closed the tab an hour ago.
  </PanelNote>
</Panel>
