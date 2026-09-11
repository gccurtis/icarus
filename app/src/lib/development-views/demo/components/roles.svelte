<script lang="ts">
  import SectionHeading from "$development-views/demo/components/section-heading.svelte";

  const SLOTS = ["surface", "surface-hover", "border", "fill", "fill-hover", "text", "on-fill"];

  const ROLES = [
    { kind: "Meaning", role: "success", hue: "green", means: "Applied, accepted, valid, safe" },
    { kind: "Meaning", role: "danger", hue: "red", means: "Failed, rejected, destructive" },
    { kind: "Meaning", role: "attention", hue: "amber", means: "Human judgment required; stale" },
    { kind: "Meaning", role: "inactive", hue: "grey", means: "Unavailable, disabled, out of scope" },
    { kind: "Identity", role: "interactive", hue: "blue", means: "Can be acted upon" },
    { kind: "Identity", role: "active", hue: "cyan", means: "Engaged, selected, live, resolving" },
    { kind: "Identity", role: "intelligence", hue: "violet", means: "Derived work" },
    { kind: "Brand", role: "primary", hue: "blue", means: "What the product wears by default" },
    { kind: "Brand", role: "secondary", hue: "cyan", means: "The quieter alternative" },
    { kind: "Brand", role: "accent-1", hue: "pink", means: "Categorical work" },
    { kind: "Brand", role: "accent-2", hue: "teal", means: "Categorical work" },
    { kind: "Brand", role: "slide", hue: "orange", means: "Slide-presentation identity" }
  ];
</script>

<section class="flex flex-col gap-5">
  <SectionHeading
    eyebrow="02 · Material"
    title="Roles and slots"
    source="styles/tokens/tokens.md"
    lede="A role binds one family across seven jobs. This is the only place a hue is chosen, and a component picks a job — never an intensity, never a hue."
  />

  <div class="surface-table-frame surface-table-scroll">
    <table class="surface-data-table min-w-[52rem]">
      <thead>
        <tr>
          <th scope="col">Role</th>
          {#each SLOTS as slot (slot)}
            <th scope="col">{slot}</th>
          {/each}
          <th scope="col">Means</th>
        </tr>
      </thead>
      <tbody>
        {#each ROLES as { role, hue, means } (role)}
          <tr>
            <th scope="row" class="text-ink-primary text-body-sm border-border-subtle border-r px-3 py-2 text-left font-medium">
              <span class="font-mono">{role}</span>
              <span class="text-micro text-ink-muted block font-mono">{hue}</span>
            </th>
            {#each SLOTS as slot (slot)}
              <td>
                <span
                  class="border-border-subtle mx-auto block h-6 w-full max-w-16 rounded-sm border"
                  style="background-color: var(--token-color-{role}-{slot})"
                  title="--token-color-{role}-{slot}"
                ></span>
              </td>
            {/each}
            <td class="text-ink-secondary text-left">{means}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="surface-rail surface-rail-quiet max-w-prose p-4">
    <p class="text-body-sm text-ink-secondary m-0">
      Meaning roles are fixed. Identity and brand roles may share a hue with one another but never
      with a meaning hue — someone who learnt that red means danger learnt it everywhere.
      <code class="text-micro font-mono">yellow</code> is declared and claimed by no role.
      <code class="text-micro font-mono">orange</code> carries presentation identity.
    </p>
  </div>
</section>
