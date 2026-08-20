<script lang="ts">
  import type { Component } from "svelte";
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import { clientModel } from "$model/client";
  import { ResizeHandle } from "$lib/unique-components/resize-handle";
  import ActivityLens from "$views/inspector/components/activity.svelte";
  import ConnectorLens from "$views/inspector/components/connector.svelte";
  import Copilot from "$views/inspector/components/copilot.svelte";
  import FileLens from "$views/inspector/components/file.svelte";
  import MentionLens from "$views/inspector/components/mention.svelte";
  import NewtabConnectorLens from "$views/inspector/components/newtab-connector.svelte";
  import NewtabDeckLens from "$views/inspector/components/newtab-deck.svelte";
  import NewtabDocumentLens from "$views/inspector/components/newtab-document.svelte";
  import NewtabRecentLens from "$views/inspector/components/newtab-recent.svelte";
  import NewtabSpreadsheetLens from "$views/inspector/components/newtab-spreadsheet.svelte";
  import NewtabTemplateLens from "$views/inspector/components/newtab-template.svelte";
  import NewtabUploadLens from "$views/inspector/components/newtab-upload.svelte";
  import NextText from "$views/inspector/components/next-text.svelte";
  import PeopleLens from "$views/inspector/components/people.svelte";
  import PersonLens from "$views/inspector/components/person.svelte";
  import ProjectLens from "$views/inspector/components/project.svelte";
  import ResearchThreadLens from "$views/inspector/components/research-thread.svelte";
  import ResourceLens from "$views/inspector/components/resource.svelte";
  import TextSelection from "$views/inspector/components/text-selection.svelte";
  import VariableLens from "$views/inspector/components/variable.svelte";
  import { COLLAPSE_BELOW, MAX_WIDTH, MIN_WIDTH } from "$views/inspector/types";
  import { familyOf } from "$views/inspector/procedures/inspection-family";

  /**
   * The inspector — the lens. It answers "what is this selected thing?"
   *
   * It reads `inspectedNode`, the active tab's inspection key. That value is
   * `undefined` whenever nothing is inspected, and this panel is a control
   * surface rather than a mirror — the nothing-inspected case is exactly when it
   * can offer insert affordances.
   *
   * **An inspection is a key and nothing more.** It carries no payload — a
   * payload would be a second record of what the user has selected, beside the
   * one already in view state — so this panel routes on the family before the
   * dot and reads the detail from where that family keeps it: view state for a
   * block or a document, the copilot object for a conversation.
   *
   * The vocabulary lives in `procedures/`, not in the model, for the same reason
   * the context rail's does. An unrouteable key renders as "no view yet" rather
   * than throwing: the model never validated the string, which is the trade for
   * it not owning the vocabulary.
   *
   * **Collapsed, it becomes a rail rather than nothing.** A flank that vanishes
   * leaves no way back but finding a 4px edge, so what remains is the same 44px
   * strip the context panel collapses to, holding the one control that reopens
   * it. Both edges of the work surface therefore behave alike: drag inward to
   * shut, click an icon in what is left to reopen. No arrows on either side.
   */
  /**
   * The lenses that need nothing from the tab.
   *
   * A `project` or `actor` key is the whole address — a person and a project
   * resource are found by a project-scoped query, not by reading the active
   * tab's view state — so these route by exact key and take no props. The
   * families below that *do* read view state keep their own branches, because
   * what they need differs per family and a map cannot express that.
   *
   * Keyed by the full string rather than by member, so the map reads as the
   * vocabulary it implements.
   */
  const LENSES: Record<string, Component> = {
    "project.self": ProjectLens,
    "project.mention": MentionLens,
    "project.resource": ResourceLens,
    "project.research-thread": ResearchThreadLens,
    "project.activity": ActivityLens,
    "project.people": PeopleLens,
    "project.file": FileLens,
    "project.connector": ConnectorLens,
    "project.variable": VariableLens,
    "actor.person": PersonLens,

    "newtab.document": NewtabDocumentLens,
    "newtab.deck": NewtabDeckLens,
    "newtab.spreadsheet": NewtabSpreadsheetLens,
    "newtab.recent": NewtabRecentLens,
    "newtab.template": NewtabTemplateLens,
    "newtab.upload": NewtabUploadLens,
    "newtab.connector": NewtabConnectorLens
  };

  const { workbench } = clientModel();

  const inspected = $derived(workbench.inspectedNode);
  const Lens = $derived(inspected === undefined ? undefined : LENSES[inspected]);
  const family = $derived(inspected === undefined ? undefined : familyOf(inspected));
  const documentState = $derived(
    workbench.active.viewState.kind === "document" ? workbench.active.viewState : undefined
  );
  const collapsed = $derived(workbench.frame.inspectorCollapsed);
</script>

<aside class="inspector" aria-label="Inspector">
  {#if collapsed}
    <!--
      The whole rail is the control, not an icon sitting on top of one: a 44px
      strip is small enough that a miss between the icon and its edge would read
      as the panel ignoring a click.
    -->
    <button
      type="button"
      class="rail"
      aria-label="Open the inspector"
      aria-expanded="false"
      title="Open the inspector"
      onclick={() => workbench.resize({ inspectorCollapsed: false })}
    >
      <Sparkles size={18} aria-hidden="true" />
    </button>
  {:else if Lens}
    <!--
      A `Panel` lens is handed the whole zone. It owns the scroll, because only
      the panel knows which of its bands scroll and which are pinned — the trail
      and the title row stay put while everything under them moves.
    -->
    <div class="lens">
      <Lens />
    </div>
  {:else}
    <div class="content">
      {#if inspected === undefined}
        <p class="note">Nothing selected.</p>
      {:else if family === "copilot"}
        <Copilot member={inspected.slice("copilot.".length)} />
      {:else if inspected === "block.text-selection" && documentState?.selection}
        <TextSelection
          anchor={documentState.scrollAnchor}
          from={documentState.selection.anchor}
          to={documentState.selection.head}
        />
      {:else if inspected === "block.next-text"}
        <NextText anchor={documentState?.scrollAnchor} />
      {:else}
        <p class="note">No view for <code>{inspected}</code> yet.</p>
      {/if}
    </div>
  {/if}

  <ResizeHandle
    side="end"
    width={workbench.frame.inspectorWidth}
    {collapsed}
    min={MIN_WIDTH}
    max={MAX_WIDTH}
    collapseBelow={COLLAPSE_BELOW}
    label="the inspector"
    onchange={({ width, collapsed: next }) =>
      workbench.resize({ inspectorWidth: width, inspectorCollapsed: next })}
  />
</aside>

<style>
  .inspector {
    position: relative;
    height: 100%;
    min-height: 0;
    display: flex;
    background-color: var(--token-surface-panel);
    border-left: 1px solid var(--token-border-subtle);
  }

  /*
   * Two shapes, deliberately. `.lens` hands a `Panel` the whole zone and lets it
   * divide its own bands; `.content` is the plain padded scroller the lenses
   * that predate the panel vocabulary still use. They will converge when those
   * three are rewritten.
   */
  .lens {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .content {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: calc(var(--token-spacing-unit) * 3);
  }

  .rail {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-block: calc(var(--token-spacing-unit) * 2);
    border: none;
    background: none;
    /* The intelligence role, because what this strip reopens onto is agent
     * work. It is the one place the collapsed panel can say what it is for. */
    color: var(--token-color-intelligence-text);
    cursor: pointer;
  }

  .rail:hover {
    background-color: var(--token-surface-panel-hover);
  }

  .note {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
    margin: 0;
  }

  code {
    font-family: var(--token-font-mono);
    font-size: var(--token-text-mono);
  }
</style>
