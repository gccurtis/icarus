<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    current,
    appearance,
    appearances,
    onappearance,
    children
  }: {
    current: string;
    appearance: string;
    appearances: readonly string[];
    onappearance: (next: string) => void;
    children: Snippet;
  } = $props();

  const GROUPS = [
    [
      { href: "/demo", label: "Design system" },
      { href: "/demo/editor-audit", label: "Editor audit" },
      { href: "/demo/state-behavior-audit", label: "Architecture audit" },
      { href: "/demo/architecture-pillars", label: "Pillars" },
      { href: "/demo/vocabulary", label: "Composition" },
      { href: "/demo/templates", label: "Templates" },
      { href: "/demo/agents-reference", label: "Agents" }
    ],
    [
      { href: "/demo/blocks", label: "Blocks" },
      { href: "/demo/analysis", label: "Analysis" },
      { href: "/demo/plot", label: "Plot" },
      { href: "/demo/thread", label: "Thread" }
    ],
    [
      { href: "/demo/context", label: "Context" },
      { href: "/demo/inspector", label: "Inspector" },
      { href: "/demo/project-overview-panels", label: "Project panels" },
      { href: "/demo/workspace", label: "Workspace" }
    ],
    [
      { href: "/demo/stack-builder", label: "Stack builder" },
      { href: "/demo/semantic-overlay", label: "Overlay" },
      { href: "/demo/external-files", label: "External files" }
    ]
  ];

  const LABELS: Record<string, string> = { helios: "Helios", selene: "Selene" };

  const isActive = (href: string): boolean =>
    href === "/demo" ? current === "/demo" : current.startsWith(href);
</script>

<div class="flex min-h-screen flex-col">
  <header
    class="surface-veil border-border-subtle sticky top-0 z-30 flex h-11 shrink-0 items-center gap-4 border-b px-4"
  >
    <a href="/demo" class="text-micro text-ink-secondary tracking-caps shrink-0 font-mono uppercase">
      Icarus <span class="text-ink-muted">demos</span>
    </a>

    <nav class="flex min-w-0 flex-1 items-center overflow-x-auto" aria-label="Demo pages">
      {#each GROUPS as group, index (index)}
        {#if index > 0}
          <span class="bg-border-subtle mx-2 h-4 w-px shrink-0" aria-hidden="true"></span>
        {/if}
        {#each group as entry (entry.href)}
          <a
            href={entry.href}
            aria-current={isActive(entry.href) ? "page" : undefined}
            class="text-label duration-micro ease-standard rounded-control shrink-0 px-2.5 py-1 whitespace-nowrap
              {isActive(entry.href)
              ? 'text-interactive-text bg-interactive-surface font-medium'
              : 'text-ink-muted hover:text-ink-primary'}"
          >
            {entry.label}
          </a>
        {/each}
      {/each}
    </nav>

    <div
      class="border-border-strong rounded-control flex shrink-0 items-center gap-0.5 border p-0.5"
      role="group"
      aria-label="Appearance"
    >
      {#each appearances as name (name)}
        <button
          type="button"
          class="rounded-control text-label duration-micro ease-standard h-6 px-2.5 font-medium
            {appearance === name
            ? 'bg-interactive-fill text-ink-on-fill'
            : 'text-ink-secondary hover:bg-surface-panel-hover'}"
          aria-pressed={appearance === name}
          onclick={() => onappearance(name)}
        >
          {LABELS[name] ?? name}
        </button>
      {/each}
    </div>
  </header>

  <div class="flex min-h-0 flex-1 flex-col">
    {@render children()}
  </div>
</div>
