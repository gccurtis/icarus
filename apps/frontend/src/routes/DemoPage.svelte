<script lang="ts">
  import { Badge } from "#simple-components/badge";
  import { Button } from "#simple-components/button";
  import * as Card from "#simple-components/card";
  import { Input } from "#simple-components/input";
  import { Label } from "#simple-components/label";
  import { Separator } from "#simple-components/separator";

  const PALETTE_STEPS = ["faded", "muted", "light", "normal", "emphasized", "strong", "deep"];
  const CHROMATIC = [
    "red",
    "orange",
    "amber",
    "yellow",
    "green",
    "teal",
    "cyan",
    "blue",
    "violet",
    "pink",
  ];
  const NEUTRAL = ["white", "grey", "black"];

  const ROLE_STEPS = ["muted", "light", "normal", "emphasized", "strong"];
  const SEMANTIC = [
    { role: "success", hue: "green", means: "Applied, accepted, valid, safe" },
    { role: "danger", hue: "red", means: "Failed, rejected, destructive, denied" },
    { role: "attention", hue: "amber", means: "Human judgment required; stale" },
    { role: "intelligence", hue: "violet", means: "Derived work" },
    { role: "interactive", hue: "blue", means: "Can be acted upon" },
    { role: "active", hue: "cyan", means: "Currently engaged, live" },
    { role: "inactive", hue: "grey", means: "Unavailable, disabled" },
  ];
  const BRAND = [
    { role: "primary", hue: "blue" },
    { role: "secondary", hue: "violet" },
    { role: "accent-1", hue: "teal" },
    { role: "accent-2", hue: "pink" },
  ];

  const TYPE_SCALE = [
    { step: "h1", use: "Major screen or page title" },
    { step: "h2", use: "Document section or modal title" },
    { step: "h3", use: "Panel major heading, object title" },
    { step: "h4", use: "Inspector and drawer section heading" },
    { step: "body-lg", use: "Optional long-form editor body" },
    { step: "body", use: "Main prose and document content" },
    { step: "body-sm", use: "Panels, tables, inspector body" },
    { step: "label", use: "Controls, tabs, field labels" },
    { step: "caption", use: "Metadata, helper text, status" },
  ];

  // docs/style/component/components-and-states.md → State matrix.
  // Every row pairs its color with copy, so the whole set stays readable with
  // color removed.
  const STATES = [
    { name: "Idle", cue: "Neutral boundary, no fill", cls: "border-border-subtle text-ink-primary" },
    { name: "Hover", cue: "Border or background shift only", cls: "border-border-strong text-ink-primary" },
    { name: "Focus", cue: "2px interactive ring, 2px offset", cls: "border-interactive-normal text-ink-primary" },
    { name: "Selected", cue: "Persistent, distinguishable without color", cls: "border-active-normal bg-active-muted text-active-strong" },
    { name: "Disabled", cue: "Reduced contrast plus a reason", cls: "border-border-subtle text-inactive-normal" },
    { name: "Pending", cue: "Copy naming the wait. No motion", cls: "border-border-subtle text-ink-secondary" },
    { name: "Resolving", cue: "Progress plus current stage", cls: "border-active-normal text-active-strong" },
    { name: "Applied", cue: "Icon plus copy", cls: "border-success-normal text-success-strong" },
    { name: "Failed", cue: "Icon, copy, and a recovery action", cls: "border-danger-normal text-danger-strong" },
    { name: "Needs review", cue: "An explicit review affordance", cls: "border-attention-normal text-attention-strong" },
    { name: "Stale", cue: "Names what changed, offers refresh", cls: "border-attention-normal text-attention-strong" },
  ];

  const SURFACES = [
    { token: "canvas", cls: "bg-surface-canvas", role: "Atmospheric field" },
    { token: "work", cls: "bg-surface-work", role: "Reading and editing plane" },
    { token: "panel", cls: "bg-surface-panel", role: "Context, inspector, cards" },
    { token: "elevated", cls: "bg-surface-elevated", role: "Overlays and drawers" },
  ];

  let inputValue = $state("");
</script>

{#snippet section(title: string, source: string)}
  <div class="flex flex-col gap-1">
    <h2 class="text-h3 font-semibold">{title}</h2>
    <p class="text-caption text-ink-muted font-mono">{source}</p>
  </div>
{/snippet}

<div class="mx-auto flex max-w-5xl flex-col gap-10 p-8">
  <header class="flex flex-col gap-2">
    <h1 class="text-h1 font-semibold">Design system</h1>
    <p class="text-body text-ink-secondary max-w-[70ch]">
      Every value below resolves through the palette. Toggle the theme in the top bar — nothing on
      this page is hard-coded, so the whole surface should move together.
    </p>
  </header>

  <!-- ── Palette ─────────────────────────────────────────────────────── -->
  <section class="flex flex-col gap-4">
    {@render section("Palette", "catalog/palette.md")}
    <p class="text-body-sm text-ink-secondary max-w-[70ch]">
      Theme-independent primitives, ordered by lightness. These generate no utilities — a component
      cannot reference them, which is the docs' rule enforced by the build.
    </p>

    <div class="flex flex-col gap-3">
      <div class="grid grid-cols-[6rem_repeat(7,1fr)] items-center gap-1">
        <span></span>
        {#each PALETTE_STEPS as step (step)}
          <span class="text-caption text-ink-muted text-center">{step}</span>
        {/each}
      </div>
      {#each [...CHROMATIC, ...NEUTRAL] as hue (hue)}
        <div class="grid grid-cols-[6rem_repeat(7,1fr)] items-center gap-1">
          <span class="text-label text-ink-secondary font-mono">{hue}</span>
          {#each PALETTE_STEPS as step (step)}
            <div
              class="border-border-subtle h-8 rounded-control border"
              style="background-color: var(--palette-{hue}-{step})"
              title="--palette-{hue}-{step}"
            ></div>
          {/each}
        </div>
      {/each}
    </div>
  </section>

  <Separator />

  <!-- ── Semantic roles ──────────────────────────────────────────────── -->
  <section class="flex flex-col gap-4">
    {@render section("Semantic roles", "catalog/color-system.md")}
    <p class="text-body-sm text-ink-secondary max-w-[70ch]">
      Five emphasis steps per role, resolved through the step mapping. In Celestial Light these read
      down the ramp from the middle; in Cyberpunk Night they read out from both ends.
    </p>

    <div class="flex flex-col gap-2">
      {#each SEMANTIC as { role, hue, means } (role)}
        <div class="grid grid-cols-[9rem_repeat(5,1fr)_14rem] items-center gap-2">
          <span class="text-label font-mono">{role}</span>
          {#each ROLE_STEPS as step (step)}
            <div
              class="border-border-subtle h-8 rounded-control border"
              style="background-color: var(--color-{role}-{step})"
              title="--color-{role}-{step}"
            ></div>
          {/each}
          <span class="text-caption text-ink-muted">{hue} — {means}</span>
        </div>
      {/each}
    </div>

    <h3 class="text-h4 mt-2 font-semibold">Brand roles</h3>
    <div class="flex flex-col gap-2">
      {#each BRAND as { role, hue } (role)}
        <div class="grid grid-cols-[9rem_repeat(5,1fr)_14rem] items-center gap-2">
          <span class="text-label font-mono">{role}</span>
          {#each ROLE_STEPS as step (step)}
            <div
              class="border-border-subtle h-8 rounded-control border"
              style="background-color: var(--color-{role}-{step})"
              title="--color-{role}-{step}"
            ></div>
          {/each}
          <span class="text-caption text-ink-muted">{hue}</span>
        </div>
      {/each}
    </div>
  </section>

  <Separator />

  <!-- ── Surfaces, ink, borders ──────────────────────────────────────── -->
  <section class="flex flex-col gap-4">
    {@render section("Surfaces and ink", "catalog/surfaces.md")}
    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
      {#each SURFACES as { token, cls, role } (token)}
        <div class="border-border-subtle rounded-panel flex flex-col gap-2 border p-4 {cls}">
          <span class="text-label font-mono">--surface-{token}</span>
          <span class="text-caption text-ink-muted">{role}</span>
        </div>
      {/each}
    </div>

    <div class="flex flex-col gap-1">
      <p class="text-body text-ink-primary">--ink-primary — body and headings</p>
      <p class="text-body text-ink-secondary">--ink-secondary — supporting text, provenance</p>
      <p class="text-body text-ink-muted">--ink-muted — metadata a reader may skip</p>
    </div>
  </section>

  <Separator />

  <!-- ── Typography ──────────────────────────────────────────────────── -->
  <section class="flex flex-col gap-4">
    {@render section("Typography", "catalog/typography.md")}
    <div class="flex flex-col gap-3">
      {#each TYPE_SCALE as { step, use } (step)}
        <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span class="text-caption text-ink-muted w-24 shrink-0 font-mono">{step}</span>
          <span class="text-{step}">The work surface is sacred</span>
          <span class="text-caption text-ink-muted">{use}</span>
        </div>
      {/each}
      <div class="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span class="text-caption text-ink-muted w-24 shrink-0 font-mono">mono</span>
        <span class="text-mono font-mono tabular-nums">2026-08-12T09:41:07.284Z</span>
        <span class="text-caption text-ink-muted">Identifiers, timestamps, technical data</span>
      </div>
    </div>
  </section>

  <Separator />

  <!-- ── Components ──────────────────────────────────────────────────── -->
  <section class="flex flex-col gap-4">
    {@render section("Components", "shadcn-svelte, bridged to our tokens")}
    <p class="text-body-sm text-ink-secondary max-w-[70ch]">
      Unmodified registry components. They reference shadcn's own vocabulary — <code
        class="font-mono">bg-primary</code
      >, <code class="font-mono">border-input</code> — which the bridge aliases onto our roles.
    </p>

    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">Button</h3>
      <div class="flex flex-wrap items-center gap-2">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
        <Button variant="destructive">Destructive</Button>
        <Button disabled>Disabled</Button>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm">Small</Button>
        <Button>Default</Button>
        <Button size="lg">Large</Button>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">Badge</h3>
      <div class="flex flex-wrap items-center gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">Input and Label</h3>
      <div class="flex max-w-sm flex-col gap-2">
        <Label for="demo-input">Project name</Label>
        <Input id="demo-input" bind:value={inputValue} placeholder="Enter a name" />
        <!-- Placeholder never substitutes for a label; it disappears exactly
             when the user needs it. -->
        <p class="text-caption text-ink-muted">
          {inputValue === "" ? "Nothing entered yet" : `Bound value: ${inputValue}`}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-h4 font-semibold">Card</h3>
      <div class="grid gap-4 md:grid-cols-2">
        <Card.Root>
          <Card.Header>
            <Card.Title>Bounded surface</Card.Title>
            <Card.Description>Background plus a 1px border.</Card.Description>
          </Card.Header>
          <Card.Content>
            <p class="text-body-sm text-ink-secondary">
              Depth is earned by behaviour: a surface floats only if it can be dismissed.
            </p>
          </Card.Content>
          <Card.Footer>
            <Button variant="outline" size="sm">Action</Button>
          </Card.Footer>
        </Card.Root>

        <Card.Root>
          <Card.Header>
            <Card.Title>With an action</Card.Title>
            <Card.Description>One primary action per region.</Card.Description>
            <Card.Action>
              <Badge variant="outline">Live</Badge>
            </Card.Action>
          </Card.Header>
          <Card.Content>
            <p class="text-body-sm text-ink-secondary">
              Never a stack of cards — two levels of separation is the hard limit.
            </p>
          </Card.Content>
        </Card.Root>
      </div>
    </div>
  </section>

  <Separator />

  <!-- ── State matrix ────────────────────────────────────────────────── -->
  <section class="flex flex-col gap-4">
    {@render section("State matrix", "component/components-and-states.md")}
    <p class="text-body-sm text-ink-secondary max-w-[70ch]">
      Every state names itself. Remove color from this section and each row is still readable — that
      is the requirement, not a nicety.
    </p>
    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {#each STATES as { name, cue, cls } (name)}
        <div class="rounded-panel flex flex-col gap-1 border p-3 {cls}">
          <span class="text-label font-semibold">{name}</span>
          <span class="text-caption text-ink-muted">{cue}</span>
        </div>
      {/each}
    </div>
  </section>

  <Separator />

  <!-- ── Geometry and motion ─────────────────────────────────────────── -->
  <section class="flex flex-col gap-4">
    {@render section("Geometry and motion", "catalog/spacing.md, surfaces.md, motion.md")}

    <h3 class="text-h4 font-semibold">Radii</h3>
    <div class="flex flex-wrap gap-4">
      {#each [["control", "rounded-control"], ["panel", "rounded-panel"], ["overlay", "rounded-overlay"]] as [name, cls] (name)}
        <div class="flex flex-col items-center gap-2">
          <div class="bg-surface-panel border-border-subtle size-20 border {cls}"></div>
          <span class="text-caption text-ink-muted font-mono">--radius-{name}</span>
        </div>
      {/each}
    </div>

    <h3 class="text-h4 font-semibold">Elevation</h3>
    <div class="flex flex-wrap gap-4">
      <div class="bg-surface-panel border-border-subtle rounded-panel border p-4">
        <span class="text-label">Bounded</span>
      </div>
      <div class="bg-surface-panel border-border-subtle rounded-panel border p-4 shadow-panel">
        <span class="text-label">Raised — shadow-panel</span>
      </div>
      <div class="bg-surface-elevated border-border-subtle rounded-overlay border p-4 shadow-overlay">
        <span class="text-label">Floating — shadow-overlay</span>
      </div>
    </div>

    <h3 class="text-h4 font-semibold">Motion</h3>
    <p class="text-body-sm text-ink-secondary max-w-[70ch]">
      One easing curve, four durations. Hover a swatch — each transitions at its own duration. All of
      it collapses under <code class="font-mono">prefers-reduced-motion</code>.
    </p>
    <div class="flex flex-wrap gap-3">
      {#each [["micro", "duration-micro"], ["small", "duration-small"], ["panel", "duration-panel"], ["overlay", "duration-overlay"]] as [name, cls] (name)}
        <div
          class="bg-surface-panel hover:bg-interactive-muted border-border-subtle rounded-control ease-standard cursor-default border px-4 py-3 transition-colors {cls}"
        >
          <span class="text-label font-mono">--motion-{name}</span>
        </div>
      {/each}
    </div>

    <h3 class="text-h4 font-semibold">Shell geometry</h3>
    <div class="flex flex-col gap-2">
      {#each [["topbar", "h-topbar"], ["tabstrip", "h-tabstrip"], ["rail", "h-rail"], ["status", "h-status"], ["composer", "h-composer"]] as [name, cls] (name)}
        <div class="flex items-center gap-3">
          <span class="text-caption text-ink-muted w-28 shrink-0 font-mono">{name}</span>
          <div class="bg-interactive-muted border-interactive-normal w-40 rounded-control border {cls}"></div>
        </div>
      {/each}
    </div>
  </section>
</div>
