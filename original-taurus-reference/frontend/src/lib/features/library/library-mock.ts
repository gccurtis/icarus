/**
 * MOCK fixtures behind the library console (`/library/context`, `/library/templates`).
 *
 * The screens are real and shipped; the data behind them is not yet. Every
 * surface that renders this carries a Mock badge, because a library that looks
 * live while inventing its contents is exactly the kind of fake this repo does
 * not ship. Replace this file with real clients as each slice is wired.
 *
 * Shapes here deliberately mirror Omega's actual models so the UI does not
 * quietly assume something the backend cannot express:
 *
 * - a context is `{name, description, includes[], excludes[]}` over `Ref{kind,id,name}`
 *   (`core/capability/contexts`), resolving to leaf refs — `description` is the
 *   one field being added backend-side;
 * - a template is a document with `base.template.isTemplate` plus named
 *   `ContextVariable`s (`core/capability/document/template.go`).
 *
 * Two things here have NO Omega equivalent, and are kept in named types so the
 * gaps stay visible: `Owner` (every context/template route is project-scoped
 * today) and `Shared` (there is no per-asset sharing model).
 */

import type { Component } from 'svelte';
import { Layers } from '@lucide/svelte';
import type { Tone } from '$lib/components';
import type { ResourceKind } from '$data/resources';
import { kindMeta } from '$lib/features/shared/kinds';

export type Owner = { id: string; label: string; kind: 'user' | 'org' };

export const OWNERS: Owner[] = [
  { id: 'you', label: 'You', kind: 'user' },
  { id: 'org-atlas', label: 'Atlas Research', kind: 'org' },
  { id: 'org-northwind', label: 'Northwind', kind: 'org' }
];

/** Who an asset reaches beyond its owner. No Omega model backs this yet. */
export type Shared = { id: string; name: string; kind: 'user' | 'org'; access: 'Can use' | 'Can edit' };

/** The identity every library asset shares — contexts, templates, and the Agents
 *  space's personalities — so `LibraryDetails` renders all of them unchanged. */
export type LibraryAsset = {
  name: string;
  description: string;
  ownerId: string;
  sharedWith: Shared[];
  origin: { project: string; date: string };
  usedIn: string[];
  lastEdited: string;
  editedBy: string;
};

/**
 * A member of a context definition: any resource kind, plus `context` — which
 * nests, contributing the union of its own leaves. Reusing `ResourceKind` keeps
 * the shared `kindMeta` icon/tone table authoritative for everything but
 * `context`, which the library adds.
 */
export type MemberKind = ResourceKind | 'context';

export type Member = {
  id: string;
  name: string;
  kind: MemberKind;
  /** For nested contexts: what it expands to, so the mockup can show the union. */
  expands?: string[];
};

/**
 * One flattened leaf. `via` holds the FULL nesting path because that is what
 * Omega resolution actually knows — the screen chooses to show only `via[0]`,
 * the top-level member you can find in the Included list. Keeping the whole
 * path here means that display choice stays a design decision, not a data limit.
 */
export type Resolved = { name: string; kind: MemberKind; via: string[] };

export type LibraryContext = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  sharedWith: Shared[];
  includes: Member[];
  excludes: Member[];
  /** Flattened includes − excludes, as Omega's `/contexts/:id/resolved` returns. */
  resolved: Resolved[];
  origin: { project: string; date: string };
  usedIn: string[];
  lastEdited: string;
  editedBy: string;
};

export const CONTEXTS: LibraryContext[] = [
  {
    id: 'ctx-q3',
    name: 'Q3 research inputs',
    description:
      'Primary interview material from the Q3 push. Transcripts are the source of truth; the summary deck is derived and may lag.',
    ownerId: 'you',
    sharedWith: [
      { id: 'org-atlas', name: 'Atlas Research', kind: 'org', access: 'Can use' },
      { id: 'u-rivera', name: 'Sam Rivera', kind: 'user', access: 'Can edit' },
      { id: 'u-okafor', name: 'Ada Okafor', kind: 'user', access: 'Can use' },
      { id: 'u-lindqvist', name: 'Mika Lindqvist', kind: 'user', access: 'Can use' },
      { id: 'u-navarro', name: 'Petra Navarro', kind: 'user', access: 'Can use' }
    ],
    includes: [
      { id: 'r1', name: 'Interview transcripts', kind: 'document' },
      { id: 'r2', name: 'Field notes — October', kind: 'document' },
      {
        id: 'ctx-brand',
        name: 'Brand voice',
        kind: 'context',
        expands: ['Voice and tone guide', 'Approved phrasing', 'Legal-approved claims (context)']
      },
      { id: 'r4', name: 'Findings deck', kind: 'slides' }
    ],
    excludes: [{ id: 'r5', name: 'Draft synthesis v1', kind: 'document' }],
    resolved: [
      { name: 'Interview transcripts', kind: 'document', via: [] },
      { name: 'Field notes — October', kind: 'document', via: [] },
      { name: 'Voice and tone guide', kind: 'document', via: ['Brand voice'] },
      { name: 'Approved phrasing', kind: 'document', via: ['Brand voice'] },
      { name: 'Claims register', kind: 'spreadsheet', via: ['Brand voice', 'Legal-approved claims'] },
      { name: 'Substantiation memo', kind: 'document', via: ['Brand voice', 'Legal-approved claims'] },
      { name: 'Findings deck', kind: 'slides', via: [] }
    ],
    origin: { project: 'Helios', date: '12 Jul 2026' },
    usedIn: ['Helios', 'Vanguard'],
    lastEdited: '2 days ago',
    editedBy: 'You'
  },
  {
    id: 'ctx-brand',
    name: 'Brand voice',
    description: 'How we write. Use for anything customer-facing.',
    ownerId: 'org-atlas',
    sharedWith: [{ id: 'org-northwind', name: 'Northwind', kind: 'org', access: 'Can use' }],
    includes: [
      { id: 'r6', name: 'Voice and tone guide', kind: 'document' },
      { id: 'r7', name: 'Approved phrasing', kind: 'document' },
      {
        id: 'ctx-legal',
        name: 'Legal-approved claims',
        kind: 'context',
        expands: ['Claims register', 'Substantiation memo']
      }
    ],
    excludes: [],
    resolved: [
      { name: 'Voice and tone guide', kind: 'document', via: [] },
      { name: 'Approved phrasing', kind: 'document', via: [] },
      { name: 'Claims register', kind: 'spreadsheet', via: ['Legal-approved claims'] },
      { name: 'Substantiation memo', kind: 'document', via: ['Legal-approved claims'] }
    ],
    origin: { project: 'Brandmark', date: '3 Mar 2026' },
    usedIn: ['Helios', 'Vanguard', 'Brandmark', 'Orbit'],
    lastEdited: '3 weeks ago',
    editedBy: 'Sam Rivera'
  },
  {
    id: 'ctx-legal',
    name: 'Legal-approved claims',
    description: 'Claims we are cleared to make, and what backs each one.',
    ownerId: 'org-atlas',
    sharedWith: [],
    includes: [
      { id: 'r15', name: 'Claims register', kind: 'spreadsheet' },
      { id: 'r16', name: 'Substantiation memo', kind: 'document' }
    ],
    excludes: [],
    resolved: [
      { name: 'Claims register', kind: 'spreadsheet', via: [] },
      { name: 'Substantiation memo', kind: 'document', via: [] }
    ],
    origin: { project: 'Brandmark', date: '3 Mar 2026' },
    usedIn: ['Brandmark'],
    lastEdited: '2 months ago',
    editedBy: 'Ada Okafor'
  },
  {
    id: 'ctx-competitors',
    name: 'Competitor filings',
    description: 'Public filings and press for the four named competitors.',
    ownerId: 'org-atlas',
    sharedWith: [{ id: 'u-okafor', name: 'Ada Okafor', kind: 'user', access: 'Can edit' }],
    includes: [
      { id: 'r9', name: 'SEC filings 2024–2026', kind: 'general' },
      { id: 'r10', name: 'Press archive', kind: 'general' },
      { id: 'r11', name: 'Pricing teardown', kind: 'spreadsheet' }
    ],
    excludes: [],
    resolved: [
      { name: 'SEC filings 2024–2026', kind: 'general', via: [] },
      { name: 'Press archive', kind: 'general', via: [] },
      { name: 'Pricing teardown', kind: 'spreadsheet', via: [] }
    ],
    origin: { project: 'Vanguard', date: '28 Jun 2026' },
    usedIn: ['Vanguard'],
    lastEdited: '5 days ago',
    editedBy: 'You'
  },
  {
    id: 'ctx-launch',
    name: 'Launch inputs',
    description: 'Everything the launch note should be written from.',
    ownerId: 'you',
    sharedWith: [],
    includes: [
      { id: 'r12', name: 'Product spec', kind: 'document' },
      {
        id: 'ctx-q3',
        name: 'Q3 research inputs',
        kind: 'context',
        expands: ['Interview transcripts', 'Field notes — October', 'Brand voice (context)', '+4 more']
      }
    ],
    excludes: [{ id: 'r13', name: 'Findings deck', kind: 'slides' }],
    resolved: [
      { name: 'Product spec', kind: 'document', via: [] },
      { name: 'Interview transcripts', kind: 'document', via: ['Q3 research inputs'] },
      { name: 'Field notes — October', kind: 'document', via: ['Q3 research inputs'] },
      { name: 'Voice and tone guide', kind: 'document', via: ['Q3 research inputs', 'Brand voice'] },
      { name: 'Approved phrasing', kind: 'document', via: ['Q3 research inputs', 'Brand voice'] },
      {
        name: 'Claims register',
        kind: 'spreadsheet',
        via: ['Q3 research inputs', 'Brand voice', 'Legal-approved claims']
      },
      {
        name: 'Substantiation memo',
        kind: 'document',
        via: ['Q3 research inputs', 'Brand voice', 'Legal-approved claims']
      }
    ],
    origin: { project: 'Helios', date: '21 Jul 2026' },
    usedIn: [],
    lastEdited: 'yesterday',
    editedBy: 'You'
  },
  {
    id: 'ctx-support',
    name: 'Support transcripts',
    description: 'Rolling 90 days of support conversations.',
    ownerId: 'org-northwind',
    sharedWith: [],
    includes: [{ id: 'r14', name: 'Zendesk export', kind: 'general' }],
    excludes: [],
    resolved: [{ name: 'Zendesk export', kind: 'general', via: [] }],
    origin: { project: 'Orbit', date: '9 May 2026' },
    usedIn: ['Orbit'],
    lastEdited: '1 month ago',
    editedBy: 'Sam Rivera'
  }
];

/**
 * One piece of background material a template needs (Omega `ContextVariable`).
 *
 * This is NOT a text placeholder substituted into prompt copy. It is a named
 * slot that a **library context** fills: the template declares "I need evidence
 * to reason over", and the person using it points that slot at a context. Prompt
 * blocks then draw on the slot by name (Omega's `BlockContext{Include, Exclude}`),
 * which is why `DocBlock.context` names a slot rather than interpolating one.
 *
 * `bound` is null throughout these fixtures on purpose: choosing is what the
 * person using the template does, so a library template that arrived pre-bound
 * would design the choice away.
 */
export type TemplateVar = { name: string; description: string; bound: string | null };

/**
 * Templates are not document-only. `slides` is real but deliberately NOT mocked:
 * a slide template is either a single slide or a deck, and in both cases the
 * preview has to be the actual rendered slide — faking it with an outline would
 * design the wrong thing.
 */
export type TemplateKind = 'document' | 'slides' | 'spreadsheet';

/** `context` names the slot a prompt block draws on — never text substitution. */
export type DocBlock = {
  type: 'heading' | 'body' | 'prompt' | 'list';
  text: string;
  context?: string;
};
export type SheetPreview = { columns: string[]; rows: string[][]; formulaContext?: string };

export type LibraryTemplate = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  sharedWith: Shared[];
  kind: TemplateKind;
  variables: TemplateVar[];
  /** Exactly one of these is set, matching `kind`. */
  doc?: DocBlock[];
  sheet?: SheetPreview;
  origin: { project: string; date: string };
  usedIn: string[];
  lastEdited: string;
  editedBy: string;
};

export const TEMPLATES: LibraryTemplate[] = [
  {
    id: 'tpl-research-brief',
    name: 'Research brief',
    description: 'Question, sources, findings, and a summary — with the evidence context bound.',
    ownerId: 'you',
    sharedWith: [{ id: 'org-atlas', name: 'Atlas Research', kind: 'org', access: 'Can use' }],
    kind: 'document',
    variables: [
      { name: 'Evidence', description: 'The material this brief reasons over', bound: null },
      { name: 'House style', description: 'Voice and formatting rules to follow', bound: null }
    ],
    doc: [
      { type: 'heading', text: 'Research brief' },
      { type: 'body', text: 'One paragraph on the question this brief answers and why it matters now.' },
      { type: 'heading', text: 'Question' },
      { type: 'body', text: 'State the question in a single sentence.' },
      { type: 'heading', text: 'Sources' },
      {
        type: 'prompt',
        text: 'Summarise every source as a one-line claim with its origin.',
        context: 'Evidence'
      },
      { type: 'heading', text: 'Findings' },
      { type: 'list', text: 'Finding — what it implies — confidence' },
      { type: 'heading', text: 'Method' },
      { type: 'body', text: 'How the material was gathered, and what that rules out.' },
      { type: 'heading', text: 'Limitations' },
      { type: 'body', text: 'What this brief cannot tell you, stated plainly.' },
      { type: 'heading', text: 'Summary' },
      {
        type: 'prompt',
        text: 'Write the summary, grounded only in the findings above.',
        context: 'House style'
      }
    ],
    origin: { project: 'Helios', date: '14 Jul 2026' },
    usedIn: ['Helios', 'Vanguard'],
    lastEdited: '4 days ago',
    editedBy: 'You'
  },
  {
    id: 'tpl-model',
    name: 'Pricing model',
    description: 'Tiered pricing with sensitivity rows, ready to point at real cost data.',
    ownerId: 'org-atlas',
    sharedWith: [{ id: 'u-rivera', name: 'Sam Rivera', kind: 'user', access: 'Can edit' }],
    kind: 'spreadsheet',
    variables: [{ name: 'Cost data', description: 'Unit costs the margin column reads', bound: null }],
    sheet: {
      columns: ['Tier', 'Seats', 'List', 'Discount', 'Effective', 'Margin'],
      rows: [
        ['Starter', '1–10', '$29', '0%', '=C2*(1-D2)', '=(E2-unit)/E2'],
        ['Team', '11–50', '$24', '10%', '=C3*(1-D3)', '=(E3-unit)/E3'],
        ['Business', '51–250', '$19', '20%', '=C4*(1-D4)', '=(E4-unit)/E4'],
        ['Enterprise', '250+', 'Custom', '—', '—', '—']
      ],
      formulaContext: 'Cost data'
    },
    origin: { project: 'Vanguard', date: '11 Jun 2026' },
    usedIn: ['Vanguard', 'Orbit'],
    lastEdited: '2 weeks ago',
    editedBy: 'Sam Rivera'
  },
  {
    id: 'tpl-prd',
    name: 'Product requirements',
    description: 'Problem, goals, requirements, open questions.',
    ownerId: 'org-atlas',
    sharedWith: [],
    kind: 'document',
    variables: [{ name: 'Discovery', description: 'Research behind the problem statement', bound: null }],
    doc: [
      { type: 'heading', text: 'Product requirements' },
      { type: 'heading', text: 'Problem' },
      {
        type: 'prompt',
        text: 'Restate the problem in the user’s own words.',
        context: 'Discovery'
      },
      { type: 'heading', text: 'Goals' },
      { type: 'list', text: 'Goal — how we measure it' },
      { type: 'heading', text: 'Requirements' },
      { type: 'list', text: 'Must / should / could' },
      { type: 'heading', text: 'Open questions' },
      { type: 'body', text: 'What we still do not know, and who can answer it.' }
    ],
    origin: { project: 'Brandmark', date: '2 Feb 2026' },
    usedIn: ['Brandmark', 'Orbit', 'Helios'],
    lastEdited: '2 months ago',
    editedBy: 'Ada Okafor'
  },
  {
    id: 'tpl-weekly',
    name: 'Weekly update',
    description: 'Highlights, lowlights, metrics, next week.',
    ownerId: 'you',
    sharedWith: [],
    kind: 'document',
    variables: [],
    doc: [
      { type: 'heading', text: 'Weekly update' },
      { type: 'heading', text: 'Highlights' },
      { type: 'list', text: 'What went well' },
      { type: 'heading', text: 'Lowlights' },
      { type: 'list', text: 'What did not' },
      { type: 'heading', text: 'Metrics' },
      { type: 'body', text: 'The three numbers we steer by.' },
      { type: 'heading', text: 'Next week' },
      { type: 'list', text: 'Commitments' }
    ],
    origin: { project: 'Helios', date: '30 Jun 2026' },
    usedIn: ['Helios'],
    lastEdited: '1 week ago',
    editedBy: 'You'
  }
];

export const PROJECTS = ['Helios', 'Vanguard', 'Brandmark', 'Orbit'];

/**
 * Icon / tone / label for every member kind. Resource kinds defer to the shared
 * `kindMeta` so a document looks the same here as in the resource table; only
 * `context` is added, in the AI/derived violet it carries everywhere else.
 */
export const memberMeta: Record<MemberKind, { icon: Component; tone: Tone; label: string }> = {
  ...kindMeta,
  context: { icon: Layers, tone: 'intel', label: 'Context' }
};

/** 7 · 1.2k · 340k · 1.4M — a resolved set can be very large. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}k`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}
