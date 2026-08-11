import { Folder, Clock, Users, Info, SlidersHorizontal, Sparkles } from '@lucide/svelte';
import type { PanelSection, SurfaceContribution } from '$lib/features/shared/surface';
import ProjectPropertiesPanel from './panels/ProjectPropertiesPanel.svelte';
import ResourcesPanel from './panels/ResourcesPanel.svelte';
import HistoryPanel from './panels/HistoryPanel.svelte';
import MembersPanel from './panels/MembersPanel.svelte';
import QuarterbackPanel from './panels/QuarterbackPanel.svelte';
import DetailsFallbackPanel from './panels/DetailsFallbackPanel.svelte';

/**
 * The shell's SECTION POLICY — which panel sections each rail shows, extracted
 * from `AppShell.svelte` (catalog A4) so the shell component is pure
 * composition and this policy is readable in one place:
 *
 * - the project-context fallback set (left rail when no stage claims it),
 * - the permanent inspector sections (Details first, AI Agent last),
 * - the merge rule for surface contributions,
 * - the repair rule for persisted section state.
 */

/**
 * Project context is the left rail's fallback when a stage does not claim it
 * (notably Overview). A surface contribution replaces this ENTIRE set so a
 * resource editor never inherits irrelevant project-level views.
 */
const projectContext: PanelSection[] = [
  { id: 'properties', label: 'Properties', icon: Info, content: ProjectPropertiesPanel },
  { id: 'resources', label: 'All resources', icon: Folder, content: ResourcesPanel },
  { id: 'history', label: 'History', icon: Clock, content: HistoryPanel },
  { id: 'members', label: 'Members', icon: Users, content: MembersPanel }
];

/**
 * The inspector's PERMANENT sections: Details (first, the default — its content
 * is the fallback until a surface overrides it by contributing id 'details')
 * and AI Agent (last, opened by the bar). Surface extras sit between them.
 */
const universalDetails: PanelSection = {
  id: 'details',
  label: 'Details',
  icon: SlidersHorizontal,
  content: DetailsFallbackPanel
};
const universalAi: PanelSection = {
  id: 'ai',
  label: 'AI Agent',
  icon: Sparkles,
  content: QuarterbackPanel
};

/** The left rail: the surface's context set, or the project fallback. */
export function contextSectionsFor(surface: SurfaceContribution | null): PanelSection[] {
  return surface?.context ?? projectContext;
}

/**
 * The right rail: a contributed 'details' section replaces the universal one,
 * surface extras sit between it and the permanent AI Agent tail.
 */
export function inspectorSectionsFor(surface: SurfaceContribution | null): PanelSection[] {
  const contributed = surface?.inspector ?? [];
  const details = contributed.find((s) => s.id === 'details') ?? universalDetails;
  const extras = contributed.filter((s) => s.id !== 'details' && s.id !== 'ai');
  return [details, ...extras, universalAi];
}

/**
 * Persisted panel state may reference a section that isn't present (older
 * section set, or a contribution that isn't mounted). Returns the section id to
 * normalize to — the rail's first — or `null` when the current one resolves.
 */
export function repairSection(sections: PanelSection[], current: string): string | null {
  return sections.some((s) => s.id === current) ? null : sections[0].id;
}
