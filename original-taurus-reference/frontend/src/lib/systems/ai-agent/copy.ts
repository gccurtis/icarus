import type { AiMode, AiContextSource, AiContextSourceId } from './types';

export const aiModeOptions = [
  { value: 'ask', label: 'Ask' },
  { value: 'action', label: 'Action' },
  { value: 'plan', label: 'Plan' }
] as const;

export const aiModeCopy: Record<AiMode, { placeholder: string; cue: string }> = {
  ask: {
    placeholder: 'Ask about this document…',
    cue: 'Answer from the document and its working context, with trace when useful.'
  },
  action: {
    placeholder: 'Describe a change to make…',
    cue: 'Make a direct edit when possible; route larger work through Tasks.'
  },
  plan: {
    placeholder: 'Describe the outcome to plan…',
    cue: 'Turn an outcome into a reviewable sequence without leaving the document.'
  }
};

export const aiContextSourceOptions: AiContextSource[] = [
  {
    id: 'document',
    label: 'Document',
    detail: 'The open document and its current content',
    wired: true
  },
  {
    id: 'selection',
    label: 'Current selection',
    detail: 'Surfaced for review; not yet sent to the agent',
    wired: false
  },
  {
    id: 'knowledge',
    label: 'All knowledge',
    detail: 'Surfaced for review; not yet sent to the agent',
    wired: false
  },
  {
    id: 'sources',
    label: 'Linked sources',
    detail: 'Surfaced for review; not yet sent to the agent',
    wired: false
  }
];
