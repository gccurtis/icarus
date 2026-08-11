# Change record — 2026-07-20 — Component library

A broad, cohesive component corpus — the Lego blocks for building Taurus surfaces
— built entirely on the authoritative design tokens.

## Added a 46-component library under src/lib/components/

```text
Atoms        Button IconButton Spinner Badge Chip StatusDot StatePill Kbd
             Divider Avatar Code Skeleton
Forms        Label Field Input Textarea Select Checkbox Switch RadioGroup
             Slider SegmentedControl
Data         Card Stat Progress Table KeyValue
Overlay      Alert Banner Tooltip Modal Drawer Popover Menu Toaster
Navigation   Tabs Accordion Breadcrumbs Pagination Stepper
Surfaces     TopBar Toolbar InspectorSection PromptBlock QuarterbackBar EmptyState
```

**Why:** the app needs reusable building blocks before real surfaces can be
assembled. **Purpose:** cover the component types the product will need, each
capturing the aesthetic (light in the mind, futuristic through calm precision,
intuitive by default). **Why this way:** every component consumes the
authoritative tokens (`bg-canvas`, `text-primary`, `rounded-panel`, semantic
roles) and the surface utilities — no hardcoded colors or sizes — so the library
inherits both themes for free and stays consistent with `docs/style/`.

## Established shared component conventions

```ts
// $lib/utils — cn() class merge + useId(); $lib/motion — DURATION, EASE,
// reduced-motion aware timings; $lib/components/types — Tone, Size.
let { value = $bindable(''), class: className = '', children, ...rest } = $props();
```

**Why:** a large library needs one consistent API. **Purpose:** predictable
props across all components. **Why this way:** Svelte 5 runes throughout
(`$props`, `$bindable`, `$derived`); universal `class` passthrough merged with
`cn()`; snippet-based composition (`children`, `header`, `trigger`, `actions`);
JS transitions drawn from `$lib/motion` so they honor `prefers-reduced-motion`;
icon-only controls require a `label`, and semantic state always pairs color with
copy + icon per the accessibility baseline.

## Toast store, barrel export, README, and showcase route

```svelte
import { Button, Modal, toast } from '$lib/components';
```

**Why:** the library needs a single import surface, discoverability, and
verification. **Purpose:** `$lib/components` re-exports everything (plus the
`toast()` store helpers); the README indexes the catalog and conventions; the
`/components` route is a live gallery of every component in both themes.
**Why this way:** the showcase doubles as real-usage coverage for `svelte-check`
(0 errors / 0 warnings) and a visual reference. Per AGENTS.md, the component
directory is exempt from markdown companions — the README is its index.
