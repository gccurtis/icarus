<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import FilePlus2 from "@lucide/svelte/icons/file-plus-2";
  import MousePointer2 from "@lucide/svelte/icons/mouse-pointer-2";
  import Search from "@lucide/svelte/icons/search";
  import Tags from "@lucide/svelte/icons/tags";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  const BEHAVIORS = [
    {
      number: "01",
      title: "Find",
      icon: Search,
      gesture: "Search, scope, kind, multi-tag and sort controls",
      result: "One filtered table over owner-only Personal rows; Project remains a future ownership state and Shared is absent from the current contract."
    },
    {
      number: "02",
      title: "Inspect",
      icon: MousePointer2,
      gesture: "Select to inspect; double-click to enter the Template shell",
      result: "Both selections share one active state. Authoring remains in the singleton Template category and never creates a second tab or project resource."
    },
    {
      number: "03",
      title: "Organize",
      icon: Tags,
      gesture: "Autosave name, description, variable help text, and flat tags",
      result: "Every currently visible row is viewer-owned; the mutation flows back into search and filtering, and an identical pending edit is shared across remounts."
    },
    {
      number: "04",
      title: "Create",
      icon: FilePlus2,
      gesture: "Optionally name it, then press the Document, Presentation or Spreadsheet icon",
      result: "Each icon is the create action; kind is fixed immediately and the new owned template becomes the inspected subject."
    },
    {
      number: "05",
      title: "Duplicate",
      icon: Copy,
      gesture: "Duplicate from the inspector",
      result: "A new viewer-owned template starts at revision one with copied body and variables. Cross-owner sources are not visible today."
    },
    {
      number: "06",
      title: "Remove",
      icon: Trash2,
      gesture: "Delete with confirmation",
      result: "The template, immutable versions, private slot rows and any stage are removed in one recoverable Store transaction, then selection clears. Independent resources are untouched."
    },
    {
      number: "07",
      title: "Use",
      icon: ExternalLink,
      gesture: "Press the explicit Use action",
      result: "Documents and presentations prevalidate defaults, materialize one independent resource per pending workspace intent, and open their ordinary editor. Spreadsheet materialization is implemented and tested, but the UI handoff is deliberately disabled until its editor consumes resource ids. Cross-client retries still need durable request ids."
    }
  ];
</script>

<div class="behavior-grid">
  {#each BEHAVIORS as behavior (behavior.number)}
    {@const Icon = behavior.icon}
    <article>
      <header>
        <span class="number">{behavior.number}</span>
        <span class="icon"><Icon size={16} aria-hidden="true" /></span>
      </header>
      <h3>{behavior.title}</h3>
      <dl>
        <div><dt>GESTURE</dt><dd>{behavior.gesture}</dd></div>
        <div><dt>RESULT</dt><dd>{behavior.result}</dd></div>
      </dl>
    </article>
  {/each}
</div>

<style>
  .behavior-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
    background: var(--token-surface-panel);
  }

  article {
    min-height: 15rem;
    padding: calc(var(--token-spacing-unit) * 4);
    border-right: 1px solid var(--token-border-subtle);
    border-bottom: 1px solid var(--token-border-subtle);
  }

  article:nth-child(3n) {
    border-right: 0;
  }

  article:last-child {
    grid-column: 1 / -1;
    min-height: 10rem;
    border-right: 0;
    border-bottom: 0;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .number,
  dt {
    color: var(--token-ink-muted);
    font-family: var(--token-font-mono);
    font-size: 0.75rem;
    letter-spacing: 0.08em;
  }

  .icon {
    display: grid;
    width: calc(var(--token-spacing-unit) * 8);
    height: calc(var(--token-spacing-unit) * 8);
    place-items: center;
    border: 1px solid var(--token-color-active-border);
    border-radius: var(--token-radius-control);
    background: var(--token-color-active-surface);
    color: var(--token-color-active-text);
  }

  h3 {
    margin: calc(var(--token-spacing-unit) * 4) 0 0;
    color: var(--token-ink-primary);
    font-size: 1rem;
    font-weight: 550;
  }

  dl {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 3);
    margin: calc(var(--token-spacing-unit) * 4) 0 0;
  }

  dt,
  dd {
    margin: 0;
  }

  dd {
    margin-top: calc(var(--token-spacing-unit) * 1);
    color: var(--token-ink-muted);
    font-size: 0.75rem;
    line-height: 1.55;
  }

  @media (max-width: 58rem) {
    .behavior-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    article:nth-child(3n) {
      border-right: 1px solid var(--token-border-subtle);
    }

    article:nth-child(2n) {
      border-right: 0;
    }

    article:last-child {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 36rem) {
    .behavior-grid {
      grid-template-columns: 1fr;
    }

    article,
    article:nth-child(2n),
    article:nth-child(3n),
    article:last-child {
      grid-column: auto;
      min-height: 0;
    }

    article:last-child {
      border-bottom: 0;
    }
  }
</style>
