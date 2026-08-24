<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Ban from "@lucide/svelte/icons/ban";
  import Check from "@lucide/svelte/icons/check";
  import Lock from "@lucide/svelte/icons/lock";
  import Plus from "@lucide/svelte/icons/plus";

  import {
    Panel,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import type { AgentId } from "$mock-capabilities/cast";
  import {
    attachableIn,
    personaScope,
    savedScopes,
    scopeTotal,
    suggestedScope
  } from "$mock-capabilities/copilot";
  import { viewState } from "$model/client/view-state";

  /**
   * What the Copilot can see — everything this request will be able to look up,
   * and where each part came from.
   *
   * `docs/screen-panel-views/inspector/copilot/what-it-can-see.md` is the
   * specification. Three sources, kept apart because they are revoked in three
   * different ways: what the screen offers, what you pick, and what the persona
   * always has.
   *
   * **Suggested is not attached.** Nothing is in scope until it is added, so every
   * offered row says which it is in words rather than leaving the reader to read a
   * tick.
   *
   * **Back and Done are in the actions row, not pinned at the foot.** The
   * specification asks for a footer; `Panel` has none, because a control pinned
   * below a list of unbounded length is a control nobody scrolls to. The row
   * under the title is where a control is found.
   */
  let {
    screenId = "document",
    agentId = "grid-analyst",
    ondone
  }: {
    /** Which screen is asking. It supplies its own suggestions; the Copilot does not guess. */
    screenId?: string;
    /** The persona this request is going to. */
    agentId?: AgentId;
    /** Close the scope panel and return to the composer. */
    ondone?: () => void;
  } = $props();

  const view = viewState();

  const projectId = $derived(view.project);

  const suggestions = $derived(suggestedScope(screenId).current);
  const saved = $derived(savedScopes(projectId).current);
  const own = $derived(personaScope(agentId).current);
  const total = $derived(scopeTotal(agentId).current);
  const resources = $derived(attachableIn(projectId).current);

  /**
   * Three lists rather than one, because the three sources are revoked three
   * different ways and an id from one is not interchangeable with an id from
   * another.
   */
  let offered = $state<string[]>([]);
  let picked = $state<string[]>([]);
  let attached = $state<string[]>([]);

  const flip = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((held: string) => held !== id) : [...list, id];

  let search = $state("");

  const query = $derived(search.trim().toLowerCase());

  const hits = $derived(
    resources.filter((resource) => resource.name.toLowerCase().includes(query))
  );

  const trail = $derived([{ label: "Copilot", key: "home" }, { label: "What it can see" }]);
</script>

<Panel title="What the Copilot can see">
  {#snippet crumbs()}
    <PanelCrumbs {trail} onnavigate={() => view.inspect("copilot.home")} />
  {/snippet}

  {#snippet actions()}
    <PanelButton
      label="Back"
      icon={ArrowLeft}
      title="Back to the Copilot"
      onclick={() => view.inspect("copilot.home")}
    />
    <PanelButton
      label="Done"
      icon={Check}
      tone="primary"
      disabled={ondone === undefined}
      title="Close this and return to the composer"
      onclick={ondone}
    />
  {/snippet}

  <PanelSection title="Suggested" count={suggestions.length} flush>
    {#each suggestions as suggestion (suggestion.id)}
      <PanelRow
        title={suggestion.label}
        sub={suggestion.detail}
        meta={offered.includes(suggestion.id) ? "Added" : "Not in scope"}
        icon={offered.includes(suggestion.id) ? Check : Plus}
        tone={offered.includes(suggestion.id) ? "success" : "default"}
        onselect={() => (offered = flip(offered, suggestion.id))}
      />
    {/each}

    <PanelNote>
      What this screen can offer. Nothing here is in scope until you add it.
    </PanelNote>
  </PanelSection>

  <!--
    Between Suggested and Saved Contexts, and it contains only what it searches:
    a one-off resource for this request, which saves no Context.
  -->
  <PanelSearch
    title="Add a resource"
    placeholder="Search project resources"
    matched={query === "" ? undefined : hits.length}
    total={query === "" ? undefined : resources.length}
    empty="No resource by that name."
    bind:value={search}
    flush
  >
    {#if query === ""}
      <PanelNote>
        A resource added here is attached to this request only. It saves no Context.
      </PanelNote>
    {:else}
      {#each hits as resource (resource.id)}
        <PanelRow
          title={resource.name}
          sub={attached.includes(resource.id) ? "Added to this request" : resource.kind}
          icon={attached.includes(resource.id) ? Check : Plus}
          tone={attached.includes(resource.id) ? "success" : "default"}
          onselect={() => (attached = flip(attached, resource.id))}
        />
      {/each}
    {/if}
  </PanelSearch>

  <PanelSection title="Saved Contexts" count={saved.length} flush>
    {#each saved as scope (scope.id)}
      <PanelRow
        title={scope.name}
        sub={scope.blocked
          ? `${scope.reason ?? "matches nothing"} — blocked`
          : picked.includes(scope.id)
            ? "In scope"
            : "Not in scope"}
        meta={String(scope.resolves)}
        icon={scope.blocked ? Ban : picked.includes(scope.id) ? Check : Plus}
        tone={scope.blocked ? "danger" : picked.includes(scope.id) ? "success" : "default"}
        onselect={scope.blocked ? undefined : () => (picked = flip(picked, scope.id))}
      />
    {/each}

    <PanelNote tone="gap">
      A Context that matches nothing broadens retrieval to the whole project, so it
      is offered blocked rather than offered. This stays until an explicit-empty
      scope is distinguishable from an absent one.
    </PanelNote>
  </PanelSection>

  <!--
    No `onselect` and no toggle: fixed is a state, not an option left unticked.
    Switching this off means editing the Persona.
  -->
  <PanelSection title="The agent's own" flush>
    <PanelRow
      title={own.name}
      sub="{own.agent} always has this"
      meta={String(own.resources)}
      icon={Lock}
    />

    <PanelNote>
      Not switchable here. Changing it means editing the Persona rather than
      switching part of it off for one turn.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Altogether">
    <PanelFields>
      <PanelField label="Can look up">{total.resources} resources</PanelField>
      <PanelField label="Membership" stacked>
        Always enforced, never one of the parts.
      </PanelField>
    </PanelFields>

    <PanelNote tone="gap">
      These choices are draft state only. Nothing stores a request's scope, so
      reopening an old turn cannot show what it could see at the time — and the
      total is the union the model resolves, which a pick here cannot yet move.
    </PanelNote>
  </PanelSection>
</Panel>
