<script lang="ts">
  const SECTIONS = [
    { id: "laws", n: "01", label: "Aesthetic", source: "aesthetic.md" },
    { id: "material", n: "02", label: "Material", source: "material.md" },
    { id: "light", n: "03", label: "Light", source: "light.md" },
    { id: "type", n: "04", label: "Type", source: "type.md" },
    { id: "motion", n: "05", label: "Motion", source: "motion.md" },
    { id: "arrangement", n: "06", label: "Arrangement", source: "arrangement.md" },
    { id: "states", n: "07", label: "States", source: "states.md" },
    { id: "registry", n: "08", label: "Registry", source: "shadcn.md" }
  ];
</script>

<aside class="border-border-subtle hidden w-56 shrink-0 border-e lg:block">
  <nav class="sticky top-11 flex flex-col gap-1 p-4" aria-label="Design system sections">
    <span class="surface-eyebrow mb-2">In reading order</span>
    {#each SECTIONS as { id, n, label, source } (id)}
      <a
        href="#{id}"
        class="hover:bg-surface-panel-hover duration-micro ease-standard rounded-control flex flex-col px-2 py-1.5"
      >
        <span class="text-body-sm text-ink-primary flex items-center gap-2 font-medium">
          <span class="text-micro text-ink-muted font-mono">{n}</span>
          {label}
        </span>
        <span class="text-micro text-ink-muted ps-6 font-mono">{source}</span>
      </a>
    {/each}
  </nav>
</aside>

<nav
  class="surface-veil border-border-subtle sticky top-11 z-20 flex gap-1 overflow-x-auto border-b px-4 py-2 lg:hidden"
  aria-label="Design system sections"
>
  {#each SECTIONS as { id, n, label } (id)}
    <a
      href="#{id}"
      class="text-label text-ink-muted hover:text-ink-primary flex shrink-0 items-center gap-2 px-2 py-1 whitespace-nowrap"
    >
      <span class="text-micro text-border-strong font-mono">{n}</span>
      {label}
    </a>
  {/each}
</nav>
