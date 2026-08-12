<script lang="ts">
  import DemoPage from "#routes/DemoPage.svelte";
  import HomePage from "#routes/HomePage.svelte";
  import { Button } from "#simple-components/button";

  // Routing, in full. Hash-based so a deep link survives a refresh without the
  // backend needing a catch-all route.
  const read = () => location.hash.replace(/^#/, "") || "/";
  let path = $state(read());
  addEventListener("hashchange", () => (path = read()));

  // Theme is an explicit choice, never an OS reading — see
  // docs/style/catalog/color-system.md. We always set the attribute.
  let theme = $state<"celestial" | "cyberpunk-night">(
    (localStorage.getItem("icarus.theme") as "celestial" | "cyberpunk-night" | null) ?? "celestial",
  );
  $effect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("icarus.theme", theme);
  });

  const NAV = [
    { path: "/", title: "Home" },
    { path: "/demo", title: "Components" },
  ];
</script>

<div class="bg-surface-canvas flex min-h-screen flex-col">
  <header
    class="bg-surface-panel border-border-subtle flex h-topbar shrink-0 items-center gap-1 border-b px-3"
  >
    <span class="text-label text-ink-secondary mr-2 font-semibold tracking-wide">ICARUS</span>

    <nav class="flex items-center gap-1" aria-label="Primary">
      {#each NAV as item (item.path)}
        <a
          href="#{item.path}"
          aria-current={path === item.path ? "page" : undefined}
          class="text-label rounded-control duration-small ease-standard px-2 py-1 transition-colors
                 {path === item.path
            ? 'bg-active-muted text-active-strong'
            : 'text-ink-secondary hover:bg-accent hover:text-ink-primary'}"
        >
          {item.title}
        </a>
      {/each}
    </nav>

    <!-- The control names the theme it switches to, so the state is readable
         with color removed. -->
    <Button
      class="ml-auto"
      variant="outline"
      size="sm"
      onclick={() => (theme = theme === "celestial" ? "cyberpunk-night" : "celestial")}
    >
      {theme === "celestial" ? "Night" : "Light"}
    </Button>
  </header>

  <main class="bg-surface-work text-ink-primary flex-1">
    {#if path === "/demo"}
      <DemoPage />
    {:else}
      <HomePage />
    {/if}
  </main>
</div>
