/**
 * The MOCK template catalog behind the Templates rail panel and its Add-template
 * modal (2026-07-28 plan). A fixed list, clearly badged Mock wherever it renders —
 * there is no template backend yet; when one is designed, a standalone backend
 * request precedes replacing this file with a real client.
 */

export type MockTemplate = {
  id: string;
  name: string;
  description: string;
  kind: 'document' | 'slides';
};

export const MOCK_TEMPLATES: MockTemplate[] = [
  {
    id: 'tpl-meeting-notes',
    name: 'Meeting notes',
    description: 'Attendees, agenda, decisions, and action items.',
    kind: 'document'
  },
  {
    id: 'tpl-prd',
    name: 'Product requirements',
    description: 'Problem, goals, requirements, and open questions.',
    kind: 'document'
  },
  {
    id: 'tpl-research-brief',
    name: 'Research brief',
    description: 'Question, sources, findings, and a summary.',
    kind: 'document'
  },
  {
    id: 'tpl-weekly-update',
    name: 'Weekly update',
    description: 'Highlights, lowlights, metrics, and next week.',
    kind: 'document'
  },
  {
    id: 'tpl-pitch-deck',
    name: 'Pitch deck',
    description: 'Title, problem, solution, market, and ask slides.',
    kind: 'slides'
  },
  {
    id: 'tpl-project-kickoff',
    name: 'Project kickoff',
    description: 'Goals, roles, timeline, and risks slides.',
    kind: 'slides'
  }
];

/** Case-insensitive substring match over name + description; blank returns all. */
export function searchTemplates(query: string): MockTemplate[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return MOCK_TEMPLATES;
  return MOCK_TEMPLATES.filter((t) =>
    `${t.name} ${t.description}`.toLocaleLowerCase().includes(needle)
  );
}
