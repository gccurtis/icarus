import type { Project } from './projects';
import type { Workspace } from './workspace';
import { slug } from '$lib/utils';

/**
 * PROJECT-level export: the whole workspace as one package.
 *
 * What it writes is real — the project's identity plus its actual tabs and
 * panel selections, in Taurus's own `.taurus` container.
 *
 * Per-RESOURCE export does NOT live here. That is the per-kind table in
 * `features/shared/transfer.ts`, which the editor's Export menu, the resource
 * rows' Download menu, and the shell top bar all read, so the formats they
 * offer cannot drift apart.
 *
 * This file used to also carry `exportTab` / `TAB_FORMATS`, which wrote a
 * **placeholder file for every format** — choosing Markdown downloaded a real
 * `.md` whose entire content was a sentence saying export was not connected.
 * Both are deleted: a file that lands in Downloads looking like an export but
 * holding none of your content is worse than no button at all.
 */
export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Export the whole project as a Taurus package (its current frontend state).
 *
 * **Currently unwired, on purpose.** The shell top bar's Export menu used to call
 * this, but that whole control is being redesigned — it may become a Share, and
 * its options may be an archive plus a package rather than document formats — so
 * every item there is mocked until the shape is decided. This function is kept
 * rather than deleted because it works and is the obvious thing to re-attach.
 */
export function exportProject(project: Project, ws: Workspace): void {
  const pkg = {
    kind: 'taurus.project',
    version: 1,
    project: { id: project.id, name: project.name, icon: project.icon, visibility: project.visibility },
    tabs: ws.tabs,
    panels: { context: ws.context, inspector: ws.inspector }
  };
  downloadText(`${slug(project.name)}.taurus`, JSON.stringify(pkg, null, 2), 'application/json');
}
