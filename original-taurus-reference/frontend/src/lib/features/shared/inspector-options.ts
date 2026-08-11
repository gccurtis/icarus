/**
 * Shared inspector OPTION LISTS — UI vocabulary used by both the document
 * panels and the Fabric.js slide editor's panels. Moved here from
 * `systems/documents/inspector.ts` in workstream D (catalog L5): slides
 * importing them from the *documents system* misstated who owns them — they
 * are cross-feature UI constants, not document-domain knowledge.
 */

export const inspectorFontOptions = [
  { value: 'plex-sans', label: 'IBM Plex Sans' },
  { value: 'plex-mono', label: 'IBM Plex Mono' },
  { value: 'serif', label: 'Editorial Serif' },
  { value: 'system', label: 'System Sans' }
];

export const inspectorReferenceOptions = [
  { value: 'link', label: 'Link' },
  { value: 'document', label: 'Document (Mock)' },
  { value: 'name', label: 'Named reference (Mock)' }
];

export const inspectorColorPalette = [
  '#202428',
  '#5b6470',
  '#b42318',
  '#b54708',
  '#297a3a',
  '#175cd3',
  '#6941c6',
  '#fffdf8',
  '#f2f0e9',
  '#f9e37d',
  '#b7e4c7',
  '#b8d8ff'
];
