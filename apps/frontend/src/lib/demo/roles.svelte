<script lang="ts">
  import SectionHeading from "$lib/demo/section-heading.svelte";

  const SLOTS = ["surface", "surface-hover", "border", "fill", "fill-hover", "text", "on-fill"];

  /** Meaning is fixed in tokens/color.css and a set may not move it. */
  const SEMANTIC = [
    { role: "success", hue: "green", means: "Applied, accepted, valid, safe" },
    { role: "danger", hue: "red", means: "Failed, rejected, destructive, denied" },
    { role: "attention", hue: "amber", means: "Human judgment required; stale" },
    { role: "intelligence", hue: "violet", means: "Derived work" },
    { role: "interactive", hue: "blue", means: "Can be acted upon" },
    { role: "active", hue: "cyan", means: "Currently engaged, live" },
    { role: "inactive", hue: "grey", means: "Unavailable, disabled" },
  ];

  /** Identity resolves through an anchor, so the active set decides it. */
  const BRAND = [
    { role: "primary", hue: "blue" },
    { role: "secondary", hue: "violet" },
    { role: "accent-1", hue: "teal" },
    { role: "accent-2", hue: "pink" },
  ];
</script>

<section class="flex flex-col gap-4">
  <SectionHeading title="Semantic roles" source="system/color/roles.md" />
  <p class="text-body-sm text-ink-secondary max-w-[70ch]">
    Seven purpose slots per role. A component picks a job — <code class="font-mono">text</code>,
    <code class="font-mono">fill</code>, <code class="font-mono">border</code> — and the slot table
    picks the intensity, so no call site chooses a step. Meaning roles are fixed here; identity roles
    resolve through the active semantic set.
  </p>

  <!-- These swatches are why the Tailwind adapter registers tokens as `static`: a var() inside a
       style attribute is invisible to Tailwind's scanner, so without it most of
       the 77 role tokens are tree-shaken out of the build. -->
  <div class="flex flex-col gap-2">
    <div class="grid grid-cols-[9rem_repeat(7,1fr)_14rem] items-center gap-2">
      <span></span>
      {#each SLOTS as slot (slot)}
        <span class="text-caption text-ink-muted text-center">{slot}</span>
      {/each}
      <span></span>
    </div>
    {#each SEMANTIC as { role, hue, means } (role)}
      <div class="grid grid-cols-[9rem_repeat(7,1fr)_14rem] items-center gap-2">
        <span class="text-label font-mono">{role}</span>
        {#each SLOTS as slot (slot)}
          <div
            class="border-border-subtle rounded-control h-8 border"
            style="background-color: var(--token-color-{role}-{slot})"
            title="--token-color-{role}-{slot}"
          ></div>
        {/each}
        <span class="text-caption text-ink-muted">{hue} — {means}</span>
      </div>
    {/each}
  </div>

  <h3 class="text-h4 mt-2 font-semibold">Brand roles</h3>
  <div class="flex flex-col gap-2">
    {#each BRAND as { role, hue } (role)}
      <div class="grid grid-cols-[9rem_repeat(7,1fr)_14rem] items-center gap-2">
        <span class="text-label font-mono">{role}</span>
        {#each SLOTS as slot (slot)}
          <div
            class="border-border-subtle rounded-control h-8 border"
            style="background-color: var(--token-color-{role}-{slot})"
            title="--token-color-{role}-{slot}"
          ></div>
        {/each}
        <span class="text-caption text-ink-muted">{hue}</span>
      </div>
    {/each}
  </div>
</section>
