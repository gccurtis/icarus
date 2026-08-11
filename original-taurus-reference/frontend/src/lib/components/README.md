# Taurus Alpha component library

The Lego blocks for building Taurus surfaces. Every component is built on the
authoritative [design tokens](../../../docs/style/README.md) (`src/app.css`) — no
hardcoded colors or sizes — and follows the aesthetic: light in the mind,
futuristic through calm precision, intuitive by default.

## Usage

```svelte
<script lang="ts">
  import { Button, Card, Modal, toast } from '$lib/components';
  let open = $state(false);
</script>

<Button onclick={() => (open = true)}>Open</Button>
<Modal bind:open title="Hello">A dialog built from tokens.</Modal>
```

A live gallery of everything lives at the [`/components`](../../routes/components/+page.svelte) route.

## Conventions

- **Svelte 5 runes.** Props via `$props()`; two-way values via `$bindable()`
  (`bind:value`, `bind:open`, `bind:checked`).
- **`class` passthrough.** Every component accepts `class` and merges it last via
  `cn()`, so callers can extend styling.
- **Snippets, not slots.** Composition uses `children` and named snippets
  (`header`, `footer`, `actions`, `trigger`, `icon`).
- **Motion.** JS transitions use the shared timings in `$lib/motion` and respect
  `prefers-reduced-motion`.
- **Accessibility.** Focus is visible (global ring), icon-only controls take a
  `label`, state pairs color with copy + icon.
- **Context-neutral fields.** Reusable controls do not bake in caller-specific
  labels. `NumberField` stays compact and receives its visible context from the
  composing surface while retaining its own accessible name.
- **No companions.** This directory is exempt from the markdown-companion rule
  (see `AGENTS.md`); this README is its index.

## Catalog

**Atoms:** Button, IconButton, Spinner, Badge, Chip, StatusDot, StatePill, Kbd,
Divider, Avatar, Code, Skeleton.

**Forms:** Label, Field, Input, Textarea, Select, Combobox, NumberField, Checkbox,
Switch, RadioGroup, Slider, SegmentedControl.

**Data / display:** Card, Stat, Progress, Table, KeyValue.

**Feedback / overlay:** Alert, Banner, Tooltip, Modal, Drawer, Popover, Menu,
Toaster (+ `toast()` / `dismiss()` from `$lib/toast`).

**Navigation / disclosure:** Tabs, Accordion, Breadcrumbs, Pagination, Stepper.

**Taurus surfaces:** TopBar, Toolbar, InspectorSection, PromptBlock,
QuarterbackBar (the AI Agent composer), EmptyState.

## Semantic tones

Tone-aware components (`Badge`, `Chip`, `Alert`, `Banner`, `Progress`,
`StatusDot`, `Stat` delta) accept a `tone`: `neutral | action | intel | focus |
attention | success | danger`, mapping to the [color roles](../../../docs/style/color-system.md)
(action = blue, intel = violet, focus = cyan, attention = amber, success = green,
danger = red). Use them by meaning, never for decoration.
