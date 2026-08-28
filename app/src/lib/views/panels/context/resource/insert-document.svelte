<script lang="ts">
  import Code from "@lucide/svelte/icons/code";
  import Columns2 from "@lucide/svelte/icons/columns-2";
  import HeadingIcon from "@lucide/svelte/icons/heading";
  import ImageIcon from "@lucide/svelte/icons/image";
  import List from "@lucide/svelte/icons/list";
  import ListChecks from "@lucide/svelte/icons/list-checks";
  import Minus from "@lucide/svelte/icons/minus";
  import Pilcrow from "@lucide/svelte/icons/pilcrow";
  import SeparatorHorizontal from "@lucide/svelte/icons/separator-horizontal";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import SquareFunction from "@lucide/svelte/icons/square-function";
  import TableIcon from "@lucide/svelte/icons/table";
  import Variable from "@lucide/svelte/icons/variable";

  import { Panel, PanelRow, PanelSection } from "$components/authored/panel";
  import { insertOptions, type InsertOption } from "$capabilities/resource";
  import { viewState, type InspectionKey } from "$model/client/view-state";

  /**
   * Putting something new into the document.
   *
   * `docs/screen-panel-views/context/resource/insert-document.md` is the
   * specification — where the toolbar's insert menu went. Grouped by what the
   * thing is rather than by how often it is reached, so the list stays stable as
   * it grows.
   *
   * **Every entry inserts and then selects what it inserted**, which is why each
   * row opens a lens: the inspector shows the thing you just made, in the place
   * you would go to change it.
   *
   * **An entry that cannot be used yet is drawn and not pressable.** Hiding it
   * would make the group's shape change under a reader for a reason nothing on
   * the screen explains; the row says what is missing instead.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  const view = viewState();

  const options = $derived(insertOptions("document").current);

  const inGroup = (group: InsertOption["group"]) =>
    options.filter((option) => option.group === group);

  const iconFor = (option: InsertOption) => {
    switch (option.id) {
      case "ins-d-heading":
        return HeadingIcon;
      case "ins-d-list":
        return List;
      case "ins-d-check":
        return ListChecks;
      case "ins-d-image":
        return ImageIcon;
      case "ins-d-table":
        return TableIcon;
      case "ins-d-embed":
        return Code;
      case "ins-d-formula":
        return SquareFunction;
      case "ins-d-prompt":
        return Sparkles;
      case "ins-d-variable":
        return Variable;
      case "ins-d-divider":
        return Minus;
      case "ins-d-break":
        return SeparatorHorizontal;
      case "ins-d-side":
        return Columns2;
      default:
        return Pilcrow;
    }
  };

  /**
   * Where the inspector goes once the entry has inserted. Named for the lens in
   * `docs/screen-panel-views/inspector/resource/` where one exists; the rest name
   * the thing they made and the lens follows the name.
   */
  const LENS: Readonly<Record<string, InspectionKey>> = {
    "ins-d-text": "resource.text-block-document",
    "ins-d-heading": "resource.text-block-document",
    "ins-d-list": "resource.text-block-document",
    "ins-d-check": "resource.text-block-document",
    "ins-d-table": "resource.table",
    "ins-d-formula": "resource.formula",
    "ins-d-prompt": "resource.prompt-block",
    // A variable reads as live text in the body, which is the inline formula lens.
    "ins-d-variable": "resource.formula"
    // Image, embed, divider, page break and side-by-side name no lens in the
    // inspector tree, so they fall through to the block they insert.
  };

  const insert = (option: InsertOption) =>
    view.inspect(LENS[option.id] ?? "resource.text-block-document", {
      kind: "block",
      id: `${documentId}:${option.id}`
    });
</script>

<!--
  The four groups are the same section drawn four times, so the shape of a group
  is written once. It sits outside `Panel` because a snippet declared inside a
  component is a prop of that component.
-->
{#snippet group(title: string, entries: readonly InsertOption[], open: boolean)}
  <PanelSection {title} {open} flush>
    {#each entries as option (option.id)}
      <PanelRow
        title={option.label}
        sub={option.blocked ?? option.note}
        icon={iconFor(option)}
        tone={option.blocked ? "attention" : "default"}
        onselect={option.blocked ? undefined : () => insert(option)}
      />
    {/each}
  </PanelSection>
{/snippet}

<Panel title="Insert">
  {@render group("Basics", inGroup("Basics"), true)}
  {@render group("Content", inGroup("Content"), true)}

  <!--
    Formula, Prompt block and Variable are three different acts and the note on
    each row says which: an expression, a generation, and a reference to a value
    the project already holds.
  -->
  {@render group("Data and AI", inGroup("Data and AI"), true)}

  <!-- Layout structure rather than content, so it arrives shut. -->
  {@render group("Structure", inGroup("Structure"), false)}
</Panel>
