<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import Plus from "@lucide/svelte/icons/plus";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";

  import { clientModel, type Tab } from "$model/client";
  import { PanelChip } from "$lib/unique-components/panel";
  import {
    ScreenBar,
    ScreenCard,
    ScreenCards,
    ScreenFilters,
    ScreenHeader,
    ScreenPlaceholder,
    ScreenSurface,
    ScreenThumb
  } from "$lib/unique-components/screen";

  /**
   * Templates — a real body with variables left open.
   *
   * Two states in one tab: the library, and one template being authored. The
   * library is cards rather than rows because a template is a shape, and a list
   * of names is not a way to recognise one.
   *
   * **Authoring is the ordinary editor.** Only the persistence adapter differs —
   * a template embeds its body and saves through revision-CAS — so the centre in
   * that state is the same framework surface a document gets, under a bar saying
   * what you are editing.
   *
   * **The mode is local state.** The specifications want it retained per tab, and
   * they want the *rail* to change with it. Neither is possible until
   * `WorkbenchViewState` carries a subscreen for this screen: switching tabs
   * resets this, and the context panel offers both modes' views at once.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();

  let authoring = $state(false);

  const TEMPLATES = [
    { name: "Regulatory filing shell", meta: "Document · Project", vars: "4 variables", icon: FileText, v: 2 },
    { name: "Incident review", meta: "Document · Global", vars: "No variables", icon: FileText, v: 0 },
    { name: "Board update", meta: "Slide deck · Project", vars: "2 variables", icon: Presentation, v: 1 },
    { name: "Title slide", meta: "Slide · Project", vars: "1 variable", icon: Presentation, v: 1 },
    { name: "Cost model skeleton", meta: "Spreadsheet · Project", vars: "No variables", icon: Sheet, v: 0 },
    { name: "Storm brief", meta: "Document · Project", vars: "3 variables", icon: FileText, v: 2 }
  ];
</script>

{#if authoring}
  <div class="flex h-full min-h-0 flex-col">
    <ScreenBar
      title="Regulatory filing shell"
      onback={() => (authoring = false)}
      backLabel="Back to library"
    >
      {#snippet meta()}
        <PanelChip tone="intelligence">Template</PanelChip>
      {/snippet}
      {#snippet actions()}
        <PanelChip tone="success">Saved · revision 6</PanelChip>
      {/snippet}
    </ScreenBar>
    <ScreenPlaceholder framework="ProseMirror, the same editor a document gets">
      A template's body is authored in the ordinary editor for whatever it makes.
      What this surface adds is the three kinds of opening — a text variable
      inline, a table variable as a placed block, and a generated variable that
      becomes a prompt block in the copy. None can be drawn until a body entity
      carries a variable key.
    </ScreenPlaceholder>
  </div>
{:else}
  <ScreenSurface>
    <ScreenHeader
      title="Templates"
      about="A real body with variables left open. Using one makes an independent copy — later edits to the template never reach it."
    >
      {#snippet actions()}
        <button
          type="button"
          onclick={() => (authoring = true)}
          class="text-body-sm border-interactive-border bg-interactive-surface text-interactive-text rounded-control inline-flex min-h-8 cursor-pointer items-center gap-2 border px-3"
        >
          <Plus size={14} aria-hidden="true" />
          New template
        </button>
      {/snippet}
    </ScreenHeader>

    <ScreenFilters placeholder="Search templates" matched={6} total={6}>
      <PanelChip tone="active">All</PanelChip>
      <PanelChip>Project</PanelChip>
      <PanelChip>Global</PanelChip>
    </ScreenFilters>

    <ScreenCards>
      {#each TEMPLATES as template (template.name)}
        <ScreenCard
          title={template.name}
          sub={`${template.meta} · ${template.vars}`}
          icon={template.icon}
          onselect={() => workbench.inspect("templates.template")}
        >
          {#snippet thumb()}
            <ScreenThumb ratio="4 / 3" lines={5} variables={template.v} />
          {/snippet}
        </ScreenCard>
      {/each}
    </ScreenCards>

    <p class="text-caption text-ink-muted m-0">
      Previews are rendered from the real body. The model has no thumbnail, tag,
      category, favourite or usage count, so the library does not pretend those
      exist.
    </p>
  </ScreenSurface>
{/if}
