<script lang="ts">
  import type { Component } from "svelte";
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Search from "@lucide/svelte/icons/search";
  import Sheet from "@lucide/svelte/icons/sheet";

  import { clientModel, type Tab, type TabTarget } from "$model/client";
  import { CarouselShelf, CarouselShelfItem } from "$lib/unique-components/carousel-shelf";
  import { ScreenSurface, ScreenThumb } from "$lib/unique-components/screen";

  /**
   * New Tab — one question: which editor do you need?
   *
   * A funnel, top to bottom: find the thing you meant, or make one of three, or
   * start from something that already exists.
   *
   * **Only three things to make.** Research, Analysis, Context, Templates,
   * Personas and Automations are permanent tabs; offering to create one would
   * imply they can be absent.
   *
   * **The shelves are carousels, not grids.** A grid of twelve cards pushes the
   * search field off the top of the screen, and the search is the first thing
   * this tab is for.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();

  type ResourceType = Extract<TabTarget, { kind: "resource" }>["resourceType"];
  type Icon = Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;
  type Shelved = { name: string; meta: string; icon: Icon; vars?: number };

  const EDITORS: readonly { label: string; icon: Icon; type: ResourceType; inspect: string }[] = [
    { label: "Document", icon: FileText, type: "document", inspect: "newtab.document" },
    { label: "Slide deck", icon: Presentation, type: "slides", inspect: "newtab.deck" },
    { label: "Spreadsheet", icon: Sheet, type: "spreadsheet", inspect: "newtab.spreadsheet" }
  ];

  const RECENT: readonly Shelved[] = [
    { name: "Q3 Resilience Memo", meta: "Document · 4m", icon: FileText },
    { name: "Board Update — October", meta: "Slide deck · 2h", icon: Presentation },
    { name: "Outage Cost Model", meta: "Spreadsheet · 1d", icon: Sheet },
    { name: "Interconnect Failure Review", meta: "Document · 2d", icon: FileText },
    { name: "Substation Inventory", meta: "Spreadsheet · 4d", icon: Sheet },
    { name: "Storm Hardening Options", meta: "Slide deck · 1w", icon: Presentation }
  ];

  const TEMPLATES: readonly Shelved[] = [
    { name: "Regulatory filing shell", meta: "Document · 4 variables", icon: FileText, vars: 2 },
    { name: "Incident review", meta: "Document · Global", icon: FileText },
    { name: "Board update", meta: "Slide deck · 2 variables", icon: Presentation, vars: 1 },
    { name: "Cost model skeleton", meta: "Spreadsheet", icon: Sheet },
    { name: "Storm brief", meta: "Document · 3 variables", icon: FileText, vars: 2 },
    { name: "Weekly ops deck", meta: "Slide deck", icon: Presentation }
  ];

  let selected = $state("newtab.document");

  const choose = (key: string) => {
    selected = key;
    workbench.inspect(key);
  };
</script>

<!--
  Declared at the top level rather than inside `ScreenSurface`: a snippet written
  as a component's direct child becomes one of its props, and this one is a local
  helper rather than something the surface renders.
-->
{#snippet shelf(eyebrow: string, items: readonly Shelved[], inspect: string)}
  <div class="flex flex-col gap-2">
    <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">{eyebrow}</span>
    <CarouselShelf>
      {#each items as item (item.name)}
        {@const ItemIcon = item.icon}
        <CarouselShelfItem class="w-45">
          <button
            type="button"
            onclick={() => choose(inspect)}
            class="flex w-full cursor-pointer flex-col gap-1.5 border-none bg-transparent p-3 text-start"
          >
            <ScreenThumb ratio="4 / 3" lines={4} variables={item.vars ?? 0} />
            <span class="flex items-center gap-1.5">
              <span class="text-ink-muted shrink-0"><ItemIcon size={14} aria-hidden="true" /></span>
              <span class="text-body-sm truncate font-medium">{item.name}</span>
            </span>
            <span class="text-caption text-ink-muted">{item.meta}</span>
          </button>
        </CarouselShelfItem>
      {/each}
    </CarouselShelf>
  </div>
{/snippet}

<ScreenSurface>
  <!--
    The search is first and centred. "Open the thing I was working on" is more
    common than "make a new one", and the layout should say so.
  -->
  <div class="mt-6 flex justify-center">
    <span
      class="text-body border-border-subtle bg-surface-panel text-ink-muted rounded-control flex h-11 w-full max-w-160 items-center gap-3 border px-4"
    >
      <Search size={18} aria-hidden="true" />
      Search Northwind Grid Resilience
    </span>
  </div>

  <div class="flex flex-wrap justify-center gap-2">
    {#each EDITORS as editor (editor.label)}
      {@const EditorIcon = editor.icon}
      <button
        type="button"
        onclick={() => choose(editor.inspect)}
        aria-current={selected === editor.inspect ? "true" : undefined}
        class="text-body-sm border-border-subtle bg-surface-panel text-ink-primary hover:border-interactive-border aria-[current]:border-active-border aria-[current]:bg-active-surface aria-[current]:text-active-text rounded-control inline-flex min-h-9 cursor-pointer items-center gap-2 border px-4"
      >
        <EditorIcon size={15} aria-hidden="true" />
        {editor.label}
      </button>
    {/each}
  </div>

  {@render shelf("Recent", RECENT, "newtab.recent")}
  {@render shelf("Start from a template", TEMPLATES, "newtab.template")}
</ScreenSurface>
