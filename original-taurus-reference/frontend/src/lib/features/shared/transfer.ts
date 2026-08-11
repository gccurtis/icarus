import type { ResourceKind } from '$data/resources';
import {
  downloadMarkdown,
  exportDocumentMarkdown,
  importMarkdownFile
} from '$systems/documents/io';

/**
 * The per-kind FILE-TRANSFER table — which resource kinds can move through a
 * file, and how. The shell's Resources panel renders whatever this table
 * declares and knows no kind by name (catalog L4); adding transfer support for
 * a kind is an entry here, not a shell edit.
 *
 * This is deliberately a static table, not a contribution store like
 * `surface.ts`: import/export is project-level and must work with no tab of
 * that kind open, so there is no live stage to publish a contribution.
 */

/** How one kind imports from a file. `run` resolves to the created resource. */
export type ImportSpec = {
  /** The file-input `accept` attribute. */
  accept: string;
  /** Modal copy explaining what an import of this kind does. */
  description: string;
  /** The file-picker label, e.g. "Choose a Markdown file…". */
  prompt: string;
  busyLabel: string;
  run: (file: File) => Promise<{ id: string; name: string; kind: ResourceKind }>;
};

/** How one kind exports to a file. `run` triggers the download itself. */
export type ExportSpec = {
  /** Modal copy explaining what an export of this kind produces. */
  description: string;
  run: (id: string, name: string) => Promise<void>;
};

export type KindTransfer = { import?: ImportSpec; export?: ExportSpec };

/**
 * The export formats the UI offers for a document, in menu order.
 *
 * Only Markdown round-trips today; Word and PDF are
 * [deliberately deferred](../../../../docs/roadmap/deferred-pdf-docx-import-export.md),
 * and `.tdoc` — the native Taurus document — has no serializer yet. The three
 * unbuilt ones are still listed, because the menu is where a user looks to
 * learn what is possible, but each carries "soon" in its own label so the
 * state is legible without clicking, and choosing one says so plainly rather
 * than downloading something fake.
 *
 * One table, three surfaces: the editor's Export menu, the resource row's
 * download menu, and the bulk Export dialog all read it, so the offered set
 * cannot drift between them.
 */
export type ExportFormat = {
  id: 'md' | 'docx' | 'pdf' | 'tdoc';
  /** Menu label — carries "soon" itself when the format is not built. */
  label: string;
  /** Short name for toast copy ("PDF export isn't built yet"). */
  name: string;
  built: boolean;
};

export const exportFormats: ExportFormat[] = [
  { id: 'md', label: 'Markdown (.md)', name: 'Markdown', built: true },
  { id: 'docx', label: 'Word (.docx) — soon', name: 'Word', built: false },
  { id: 'pdf', label: 'PDF (.pdf) — soon', name: 'PDF', built: false },
  { id: 'tdoc', label: 'Taurus (.tdoc) — soon', name: 'Taurus document', built: false }
];

/** The honest line shown when a user picks a format that has no serializer. */
export function unbuiltFormatMessage(format: ExportFormat): string {
  return `${format.name} export isn’t built yet — Markdown is the only format that works today.`;
}

const kindTransfers: Partial<Record<ResourceKind, KindTransfer>> = {
  document: {
    import: {
      accept: '.md,.markdown,text/markdown',
      description:
        'Import a Markdown (.md) file as a new document in this project. Other formats (Word, PDF) are coming soon.',
      prompt: 'Choose a Markdown file…',
      busyLabel: 'Importing…',
      run: async (file) => {
        const doc = await importMarkdownFile(file);
        return { id: doc.id, name: doc.name, kind: 'document' };
      }
    },
    export: {
      description: 'Download a document as Markdown.',
      run: async (id, name) => downloadMarkdown(name, await exportDocumentMarkdown(id))
    }
  }
};

/** Every kind that can import from a file, with its spec, in table order. */
export const importers: { kind: ResourceKind; spec: ImportSpec }[] = Object.entries(
  kindTransfers
).flatMap(([kind, transfer]) =>
  transfer?.import ? [{ kind: kind as ResourceKind, spec: transfer.import }] : []
);

/** The export spec for a kind, or `undefined` when the kind has none. */
export function exporterFor(kind: ResourceKind): ExportSpec | undefined {
  return kindTransfers[kind]?.export;
}
