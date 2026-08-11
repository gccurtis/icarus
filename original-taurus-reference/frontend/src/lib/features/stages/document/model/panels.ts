import {
  BookOpenText,
  Clock,
  Info,
  LayoutTemplate,
  ListTodo,
  ListTree,
  MessageSquareText,
  Search,
  SlidersHorizontal,
  SquareStack,
  Tags
} from '@lucide/svelte';
import type { SurfaceContribution } from '$lib/features/shared/surface';
import AiTasksPanel from '../panels/AiTasksPanel.svelte';
import CommentsPanel from '../panels/CommentsPanel.svelte';
import DetailsPanel from '../panels/DetailsPanel.svelte';
import HistoryPanel from '../panels/HistoryPanel.svelte';
import InfoPanel from '../panels/InfoPanel.svelte';
import LayoutPanel from '../panels/LayoutPanel.svelte';
import NameManagerPanel from '../panels/NameManagerPanel.svelte';
import OutlinePanel from '../panels/OutlinePanel.svelte';
import ReferencesPanel from '../panels/ReferencesPanel.svelte';
import SearchPanel from '../panels/SearchPanel.svelte';
import TemplatesPanel from '../panels/TemplatesPanel.svelte';

/**
 * This surface's panel sections — what a document contributes to the shell rails.
 *
 * Kept out of the runtime so the sync machinery does not import ten Svelte
 * components just to name them. Panels read their own stores, so the runtime
 * only has to publish this list; it never passes data through it.
 */
export function documentSurface(docId: string, title: string): SurfaceContribution {
  return {
    id: `document:${docId}`,
    scope: `Document — ${title}`,
    context: [
      { id: 'info', label: 'Info', icon: Info, content: InfoPanel },
      { id: 'search', label: 'Search', icon: Search, content: SearchPanel },
      { id: 'outline', label: 'Outline', icon: ListTree, content: OutlinePanel },
      { id: 'layout', label: 'Layout', icon: LayoutTemplate, content: LayoutPanel },
      { id: 'templates', label: 'Templates', icon: SquareStack, content: TemplatesPanel },
      { id: 'references', label: 'References', icon: BookOpenText, content: ReferencesPanel },
      { id: 'name-manager', label: 'Name Manager', icon: Tags, content: NameManagerPanel },
      { id: 'comments', label: 'Comments', icon: MessageSquareText, content: CommentsPanel },
      { id: 'ai-tasks', label: 'AI Tasks', icon: ListTodo, content: AiTasksPanel },
      { id: 'history', label: 'History', icon: Clock, content: HistoryPanel }
    ],
    inspector: [
      { id: 'details', label: 'Details', icon: SlidersHorizontal, content: DetailsPanel }
    ]
  };
}
