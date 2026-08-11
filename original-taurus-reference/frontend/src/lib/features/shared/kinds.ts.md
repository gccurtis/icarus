# src/lib/features/shared/kinds.ts — breakdown

Companion to [kinds.ts](kinds.ts). Shared UI metadata for each resource kind, so a
kind looks identical across the stages (Overview, New tab) and the resource table.

## Imports

### Icon components, the Tone type, and ResourceKind

```ts
import type { Component } from 'svelte';
import { FileText, Table, Presentation, MessageSquare, File } from '@lucide/svelte';
import type { Tone } from '$lib/components';
import { RESOURCE_KINDS, type ResourceKind } from '$data/resources';

```

The five Lucide glyphs are the per-kind icons; `Tone` is the component library's
semantic-color union (keeping the tones type-checked against real variants); and
`ResourceKind` keys the map so every kind must be covered. `RESOURCE_KINDS` is imported as a
*value* (not just a type) for `kindPluralLabel` below — its display labels are already the plurals.

## The kind → metadata map

### Icon, tone, and label per resource kind

```ts
/**
 * UI metadata for each resource kind: the icon, the semantic tone (drives the colored
 * tile/badge), and the display label. Shared by the stages (Overview, New tab) and the
 * resource table so a kind looks the same everywhere.
 */
// Tones track the traditional product colors: document = blue (Word), sheet = green
// (Sheets/Excel), slides = amber/orange (PowerPoint), chat = violet (it's an AI chat
// space, so it shares the AI/intel color), general = neutral.
export const kindMeta: Record<ResourceKind, { icon: Component; tone: Tone; label: string }> = {
  document: { icon: FileText, tone: 'action', label: 'Document' },
  spreadsheet: { icon: Table, tone: 'success', label: 'Sheet' },
  slides: { icon: Presentation, tone: 'attention', label: 'Slides' },
  chat: { icon: MessageSquare, tone: 'intel', label: 'Chat' },
  general: { icon: File, tone: 'neutral', label: 'General' }
};
```

One record keyed by `ResourceKind`, each entry a Lucide `icon`, a semantic `tone`
(drives the colored icon tile and the kind `Badge`), and a display `label`. Tones track
the **traditional product colors** — document blue (Word), sheet green (Sheets/Excel),
slides amber (PowerPoint), chat violet (it's an AI chat space, so it shares the AI/intel
color). Extracted here so Overview, the New-tab launcher, `NewResourcePanel`, and
`ResourceTable` all reference the same source of truth rather than each defining their
own copy.

## The plural label

```ts
export function kindPluralLabel(kind: ResourceKind): string {
  return RESOURCE_KINDS.find((k) => k.id === kind)?.label ?? kindMeta[kind].label;
}
```

`kindMeta.label` is **singular** on purpose: it labels one resource ("Document", "Sheet"). Anything
describing a *set* needs the plural, and the plurals already exist as `RESOURCE_KINDS`' display
labels — so this reads them rather than adding a second table that could disagree with the first.

Added 2026-07-29 because the activity filter's kind chip, built from the singular label, read "All
document". Callers: the filter chips, and anywhere else naming a whole kind.
