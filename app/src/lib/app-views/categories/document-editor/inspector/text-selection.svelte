<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Pipette from "@lucide/svelte/icons/pipette";
  import SlidersHorizontal from "@lucide/svelte/icons/sliders-horizontal";

  import {
    Panel,
    PanelButton,
    PanelColor,
    PanelCrumbs,
    PanelNote,
    PanelQuote,
    PanelSection,
    PanelSelect
  } from "$authored-components/panel";
  import * as Command from "$vendored-components/command";
  import * as Popover from "$vendored-components/popover";
  import * as ToggleGroup from "$vendored-components/toggle-group";
  import { Input } from "$vendored-components/input";
  import { Textarea } from "$vendored-components/textarea";
  import {
    addressOf,
    selectedText
  } from "$app-views/categories/document-editor/procedures/inspecting";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const STYLES = [
    { value: "body", label: "Body" },
    { value: "heading-1", label: "Heading 1" },
    { value: "heading-2", label: "Heading 2" },
    { value: "quote", label: "Quote" },
    { value: "caption", label: "Caption" },
    { value: "code", label: "Code" }
  ];

  const FAMILIES = [
    "Charter",
    "Charter Italic",
    "Charter Bold",
    "Charter Bold Italic",
    "Iowan Old Style",
    "Iowan Old Style Italic",
    "Georgia",
    "Georgia Italic",
    "Archivo",
    "Archivo Medium",
    "Archivo Semibold",
    "Inter",
    "Inter Medium",
    "JetBrains Mono",
    "JetBrains Mono Bold"
  ];

  const MARKS = [
    { value: "bold", letter: "B", label: "Bold", face: "font-bold" },
    { value: "italic", letter: "I", label: "Italic", face: "italic" },
    { value: "underline", letter: "U", label: "Underline", face: "underline" },
    { value: "strike", letter: "S", label: "Strikethrough", face: "line-through" }
  ];

  const SWATCHES = [
    { value: "ink", label: "Ink", token: "var(--token-ink-primary)" },
    { value: "secondary", label: "Secondary", token: "var(--token-ink-secondary)" },
    { value: "muted", label: "Muted", token: "var(--token-ink-muted)" },
    { value: "accent-1", label: "Accent 1", token: "var(--token-color-accent-1-fill)" },
    { value: "accent-2", label: "Accent 2", token: "var(--token-color-accent-2-fill)" },
    { value: "attention", label: "Attention", token: "var(--token-color-attention-fill)" },
    { value: "success", label: "Success", token: "var(--token-color-success-fill)" },
    { value: "danger", label: "Danger", token: "var(--token-color-danger-fill)" },
    { value: "intelligence", label: "Intelligence", token: "var(--token-color-intelligence-fill)" },
    { value: "paper", label: "Paper", token: "var(--token-surface-elevated)" },
    { value: "panel", label: "Panel", token: "var(--token-surface-panel)" },
    { value: "none", label: "None", token: "transparent" }
  ];

  const COMMENTS = [
    {
      id: "c1",
      author: "Ana Reyes",
      authorId: "people:ana",
      at: "2 hours ago",
      body: "This is the sentence the whole brief turns on, and it is doing too much at once. Substation 14 being the binding constraint is the finding; the corridor scheduling is the consequence. Splitting them would let the summary quote the first without dragging the second along, which is what the exec deck needs."
    },
    {
      id: "c2",
      author: "Priya Raman",
      authorId: "people:priya",
      at: "yesterday",
      body: "Agreed on the split. I would also drop \"binding\" — it reads as jargon outside the planning team."
    },
    {
      id: "c3",
      author: "Tom Okafor",
      authorId: "people:tom",
      at: "Monday",
      body: "Checked against the September oil analysis and the derating date is right."
    }
  ];

  const LINKS = [
    {
      id: "l1",
      url: "https://grid.example.org/derating/substation-14",
      note: "The September oil analysis and the derating notice it triggered. Worth reading the appendix rather than the summary — the summary rounds the transformer rating down to the nearest ten and that is where the four percent figure came from.",
      author: "Ana Reyes",
      authorId: "people:ana",
      at: "2 hours ago"
    },
    {
      id: "l2",
      url: "https://grid.example.org/plans/corridor-reconductoring",
      note: "Scheduling for the corridor work, currently next summer.",
      author: "Tom Okafor",
      authorId: "people:tom",
      at: "Monday"
    }
  ];

  const view = workspaceState();

  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const selection = $derived(view.selection);
  const from = $derived(selection === undefined ? undefined : addressOf(selection.id));
  const to = $derived(selection?.at === undefined ? undefined : addressOf(selection.at));
  const text = $derived(selectedText(runtime?.body, selection));
  const spans = $derived(from !== undefined && to !== undefined && from.blockId !== to.blockId);

  let style = $state("body");
  let family = $state("Charter");
  let size = $state("11");
  let marks = $state<string[]>(["bold"]);
  let foreground = $state("ink");
  let background = $state("none");

  let fontOpen = $state(false);
  let fontQuery = $state("");

  let composing = $state("");
  let linkUrl = $state("");
  let linkNote = $state("");
  let unfurled = $state<Record<string, boolean>>({});

  const swatchOf = (value: string): string =>
    SWATCHES.find((swatch) => swatch.value === value)?.token ?? "transparent";

  const toggle = (id: string) => {
    unfurled = { ...unfurled, [id]: !unfurled[id] };
  };

  const navigate = (key: string) => {
    if (isInspectorView(key)) view.inspect(key);
  };

  const openThread = (id: string) => view.inspect("general.comment", { kind: "comment", id });

  const openPerson = (id: string) => view.inspect("general.person", { kind: "person", id });

  const pick = async (set: (next: string) => void) => {
    const picker = (window as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } })
      .EyeDropper;
    if (picker === undefined) return;

    try {
      const picked = await new picker().open();
      set(picked.sRGBHex);
    } catch {
      return;
    }
  };

  const eyedropper = typeof window !== "undefined" && "EyeDropper" in window;
</script>

{#snippet head(title: string)}
  <div class="text-ink-secondary flex items-center gap-1.5 px-3 py-1.5">
    <span class="text-caption font-semibold tracking-wide uppercase">{title}</span>
  </div>
{/snippet}

{#snippet palette(label: string, value: string, set: (next: string) => void)}
  <Popover.Root>
    <Popover.Trigger
      class="border-border-subtle bg-surface-panel hover:bg-surface-panel-hover rounded-control flex min-w-0 flex-1 items-center gap-1.5 border px-1.5 py-1"
      aria-label={label}
    >
      <span
        class="border-border-subtle size-4 shrink-0 rounded-full border"
        style:background={value.startsWith("#") ? value : swatchOf(value)}
      ></span>
      <ChevronDown size={12} aria-hidden="true" class="text-ink-muted ms-auto shrink-0" />
    </Popover.Trigger>
    <Popover.Content class="w-56 p-0">
      <div class="p-2">
        <PanelColor {label} value={value} options={SWATCHES} flush onchange={set} />
      </div>
      <div class="border-border-subtle border-t">
        <button
          type="button"
          disabled={!eyedropper}
          title={eyedropper ? "Pick a colour from anywhere on screen" : "This browser has no eyedropper"}
          class="text-body-sm text-ink-secondary hover:bg-surface-panel-hover flex w-full items-center gap-2 px-2.5 py-1.5 text-start disabled:cursor-not-allowed disabled:opacity-50"
          onclick={() => pick(set)}
        >
          <Pipette size={14} aria-hidden="true" />
          Pick from screen
        </button>
        <button
          type="button"
          class="text-body-sm text-ink-secondary hover:bg-surface-panel-hover flex w-full items-center gap-2 px-2.5 py-1.5 text-start"
        >
          <SlidersHorizontal size={14} aria-hidden="true" />
          Custom…
        </button>
      </div>
    </Popover.Content>
  </Popover.Root>
{/snippet}

{#snippet clamped(id: string, body: string, act: () => void, title: string)}
  <button
    type="button"
    {title}
    class="text-body-sm text-ink-secondary m-0 w-full cursor-pointer border-0 bg-transparent p-0 text-start"
    class:clamp={!unfurled[id]}
    onclick={act}
  >
    {body}
  </button>
{/snippet}

<Panel title="Text selection">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: "Document", key: "document-editor.document" },
        { label: "Text block", key: "document-editor.text-block" },
        { label: "Selection" }
      ]}
      onnavigate={navigate}
    />
  {/snippet}

  <div class="flex flex-col gap-2">

  <div class="pt-2 pb-4">
    {#if text === undefined}
      <PanelNote tone="muted">Nothing is selected in the document.</PanelNote>
    {:else if text.length === 0}
      <PanelNote tone="muted">The caret is here, but nothing is selected yet.</PanelNote>
    {:else}
      <PanelQuote source={`${text.length} characters`}>{text}</PanelQuote>
    {/if}

    {#if spans}
      <div class="pt-1.5">
        <PanelNote tone="gap">
          This selection crosses two blocks, so each mark below would apply to them
          separately.
        </PanelNote>
      </div>
    {/if}
  </div>

  {@render head("Style")}
  <div class="flex flex-col gap-3 px-3 pb-2">
    <PanelSelect label="Style" value={style} options={STYLES} onchange={(next) => (style = next)} />

    <div class="flex items-center gap-1.5">
      <Popover.Root bind:open={fontOpen}>
        <Popover.Trigger
          class="border-border-subtle bg-surface-panel hover:bg-surface-panel-hover rounded-control text-body-sm flex min-w-0 flex-1 items-center gap-1.5 border px-2 py-1"
          aria-label="Font"
        >
          <span class="truncate">{family}</span>
          <ChevronDown size={12} aria-hidden="true" class="text-ink-muted ms-auto shrink-0" />
        </Popover.Trigger>
        <Popover.Content class="w-60 p-0">
          <Command.Root>
            <Command.Input placeholder="Search fonts…" bind:value={fontQuery} />
            <Command.List>
              <Command.Empty>No font matches.</Command.Empty>
              {#each FAMILIES as name (name)}
                <Command.Item
                  value={name}
                  onSelect={() => {
                    family = name;
                    fontOpen = false;
                  }}
                >
                  <Check
                    size={14}
                    aria-hidden="true"
                    class={name === family ? "opacity-100" : "opacity-0"}
                  />
                  {name}
                </Command.Item>
              {/each}
            </Command.List>
          </Command.Root>
        </Popover.Content>
      </Popover.Root>

      <Input
        type="text"
        inputmode="decimal"
        aria-label="Font size"
        bind:value={size}
        class="text-body-sm h-auto w-14 py-1 text-center tabular-nums"
      />
    </div>

    <ToggleGroup.Root
      type="multiple"
      bind:value={marks}
      aria-label="Formatting"
      class="selection-marks flex w-full gap-1"
    >
      {#each MARKS as mark (mark.value)}
        <ToggleGroup.Item
          value={mark.value}
          title={mark.label}
          class="text-caption border-border-subtle bg-surface-panel text-ink-secondary rounded-control data-[state=on]:border-active-border data-[state=on]:bg-active-surface data-[state=on]:text-active-text h-auto min-w-0 flex-1 border px-1.5 py-1 font-normal"
        >
          <span class={`letter ${mark.face}`}>{mark.letter}</span>
          <span class={`word ${mark.face}`}>{mark.label}</span>
        </ToggleGroup.Item>
      {/each}
    </ToggleGroup.Root>

    <div class="flex items-center gap-3">
      <div class="flex min-w-0 flex-1 items-center gap-1.5">
        <span class="text-caption text-ink-muted shrink-0 font-medium">FG</span>
        {@render palette("Foreground", foreground, (next) => (foreground = next))}
      </div>
      <div class="flex min-w-0 flex-1 items-center gap-1.5">
        <span class="text-caption text-ink-muted shrink-0 font-medium">BG</span>
        {@render palette("Background", background, (next) => (background = next))}
      </div>
    </div>
  </div>

  <PanelSection title="Comments ({COMMENTS.length})" open={false} chevron="end" flush>
    <div class="flex flex-col gap-2.5 px-3 pb-1">
      <Textarea
        placeholder="Write a comment on the selection…"
        bind:value={composing}
        class="text-body-sm field-sizing-content min-h-16 resize-none"
      />
      <div class="flex">
        <PanelButton label="Add comment" tone="primary" disabled={composing.trim().length === 0} />
      </div>
    </div>

    <div class="flex flex-col gap-2.5 pt-1.5">
      {#each COMMENTS as comment (comment.id)}
        <PanelQuote
          source={comment.author}
          when={comment.at}
          onopen={() => openPerson(comment.authorId)}
        >
          {@render clamped(
            comment.id,
            comment.body,
            () => openThread(comment.id),
            "Open the thread"
          )}
        </PanelQuote>
      {/each}
    </div>
  </PanelSection>

  <PanelSection title="Links ({LINKS.length})" open={false} chevron="end" flush>
    <div class="flex flex-col gap-2.5 px-3 pb-1">
      <Input
        type="url"
        aria-label="Link"
        placeholder="https://"
        bind:value={linkUrl}
        class="text-body-sm h-auto py-1"
      />
      <Textarea
        placeholder="Note"
        bind:value={linkNote}
        class="text-body-sm field-sizing-content min-h-16 resize-none"
      />
      <div class="flex">
        <PanelButton label="Add link" tone="primary" disabled={linkUrl.trim().length === 0} />
      </div>
    </div>

    <div class="flex flex-col gap-3 pt-1.5">
      {#each LINKS as link (link.id)}
        <div class="flex flex-col gap-1">
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer"
            class="text-body-sm text-interactive-text truncate px-3 underline underline-offset-2"
          >
            {link.url}
          </a>
          <PanelQuote
            source={link.author}
            when={link.at}
            onopen={() => openPerson(link.authorId)}
          >
            {@render clamped(
              link.id,
              link.note,
              () => toggle(link.id),
              unfurled[link.id] ? "Show less" : "Show the whole note"
            )}
          </PanelQuote>
        </div>
      {/each}
    </div>
  </PanelSection>

  <PanelSection title="Mock" open={false} chevron="end">
    <PanelNote tone="gap">
      The quoted text and the character count are read from the document. Every control
      under Style holds its own state and writes nothing — the schema declares no marks,
      so there is nothing yet to read real formatting from. Comments and links are
      invented rows.
    </PanelNote>
  </PanelSection>
  </div>
</Panel>

<style>
  :global(.selection-marks) {
    container-type: inline-size;
  }

  .word {
    display: none;
  }

  @container (min-width: 23rem) {
    .letter {
      display: none;
    }

    .word {
      display: inline;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  .clamp {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
  }
</style>
