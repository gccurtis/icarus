<script lang="ts">
  import SectionHeading from "$development-views/demo/components/section-heading.svelte";

  const LAWS = [
    {
      title: "Center first",
      body: "Reduce chrome intensity before reducing work-surface clarity. When something has to give, it is never the work."
    },
    {
      title: "The right things visible, in the right place",
      body: "What you show matters, and where you show it matters exactly as much. So does the order you show it in."
    },
    {
      title: "No secret essentials",
      body: "Shortcuts and context menus accelerate visible paths. They never replace them."
    },
    {
      title: "Panels are cognitive instruments",
      body: "Context is a map, the inspector is a lens, the drawer is a workbench for one object."
    },
    { title: "Intelligence is quiet until directed", body: "Derived work waits to be asked." },
    {
      title: "Beauty is legibility",
      body: "A person knows what they see, what is selected, what changed, where it came from, and what comes next."
    },
    {
      title: "Distinction is communication",
      body: "A change of ground, a rule, a divider, a plane — each is a sentence saying this is a different kind of thing."
    },
    {
      title: "Nothing moves without intent",
      body: "Motion without intent is disruption. Every movement must be caused and must say something."
    }
  ];
</script>

<section class="flex flex-col gap-5">
  <SectionHeading
    eyebrow="01 · Aesthetic"
    title="The laws"
    source="styles/aesthetic/aesthetic.md"
    lede="Eight commitments the rest of the system is downstream of. Every value below this section exists because one of them required it."
  />

  <div class="seam-grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
    {#each LAWS as law, index (law.title)}
      <article class="flex min-h-36 flex-col gap-2 p-4">
        <span class="text-micro text-ink-muted font-mono">{String(index + 1).padStart(2, "0")}</span>
        <h3 class="text-body font-semibold">{law.title}</h3>
        <p class="text-body-sm text-ink-secondary max-w-note m-0">{law.body}</p>
      </article>
    {/each}
  </div>

  <div class="rail rail-intelligence max-w-prose p-4">
    <p class="text-body-sm text-ink-secondary m-0">
      <strong class="text-ink-primary">Provenance is part of the aesthetic.</strong> If the system
      cannot establish where something came from, it does not show the something — it says it could
      not find it. A derived value with no traceable origin is not a low-confidence result to render
      with a caveat; it is an answer the system does not have.
    </p>
  </div>
</section>
