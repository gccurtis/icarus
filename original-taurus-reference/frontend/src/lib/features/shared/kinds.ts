import type { Component } from 'svelte';
import { FileText, Table, Presentation, MessageSquare, File } from '@lucide/svelte';
import type { Tone } from '$lib/components';
import { RESOURCE_KINDS, type ResourceKind } from '$data/resources';

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

/**
 * The plural name of a kind — "Documents", "Slides" — for anything describing a
 * SET of resources rather than one ("All documents", a group header).
 *
 * `kindMeta.label` is deliberately singular (it labels one resource), and the
 * plurals already exist as the display labels in `RESOURCE_KINDS`, so this reads
 * them rather than introducing a second table that could disagree. It matters:
 * a filter chip built from the singular label read "All document".
 */
export function kindPluralLabel(kind: ResourceKind): string {
  return RESOURCE_KINDS.find((k) => k.id === kind)?.label ?? kindMeta[kind].label;
}
