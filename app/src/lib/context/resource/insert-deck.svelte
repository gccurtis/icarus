<script lang="ts">
  import Code from "@lucide/svelte/icons/code";
  import Image from "@lucide/svelte/icons/image";
  import Sparkles from "@lucide/svelte/icons/sparkles";
  import SquareFunction from "@lucide/svelte/icons/square-function";
  import Table from "@lucide/svelte/icons/table";
  import Type from "@lucide/svelte/icons/type";
  import Variable from "@lucide/svelte/icons/variable";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import { insertOptions } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Putting something new on the slide.
   *
   * `docs/screen-panel-views/context/resource/insert-deck.md` is the
   * specification. Shorter than the document's equivalent, because a slide has no
   * structural inserts — everything is a box placed on a canvas.
   *
   * **Every entry inserts and then selects**, so the inspector immediately shows
   * what was just made. Nothing mints an id yet, so what happens here is the
   * second half: the lens for the kind of thing the entry makes is opened.
   *
   * The sections are the groups the door already carries, so an entry moving
   * between them is a change to the door rather than to this file.
   */
  const options = $derived(insertOptions("slides").current);
  const groups = $derived([...new Set(options.map((option) => option.group))]);

  const ICON = {
    "ins-s-text": Type,
    "ins-s-image": Image,
    "ins-s-table": Table,
    "ins-s-embed": Code,
    "ins-s-formula": SquareFunction,
    "ins-s-prompt": Sparkles,
    "ins-s-variable": Variable
  } as const;

  /** Which lens the new thing lands in. An entry with no entry here lands on the element. */
  const LENS: Record<string, string> = {
    "ins-s-text": "resource.text-block",
    "ins-s-formula": "resource.inline-formula",
    "ins-s-prompt": "resource.prompt-block",
    "ins-s-variable": "resource.inline-formula"
  };
</script>

<Panel title="Insert">
  {#each groups as group (group)}
    {@const entries = options.filter((option) => option.group === group)}
    <PanelSection title={group} count={entries.length} flush>
      {#each entries as option (option.id)}
        <PanelRow
          title={option.label}
          sub={option.blocked ?? option.note}
          icon={ICON[option.id as keyof typeof ICON]}
          tone={option.blocked ? "attention" : "default"}
          onselect={option.blocked
            ? undefined
            : () => mockWorkbench.inspect(LENS[option.id] ?? "resource.element")}
        />
      {/each}
    </PanelSection>
  {/each}

  <PanelNote tone="gap">
    A prompt block on a slide runs when the slide is shown. Whether that means on
    deck open, on slide selection, or on presentation is undecided, and the three
    have very different costs.
  </PanelNote>
</Panel>
