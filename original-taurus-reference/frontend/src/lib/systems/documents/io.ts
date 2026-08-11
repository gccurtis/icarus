import { api } from '$data/api';

/**
 * Document import / export (Markdown). Omega exports a document as raw Markdown
 * (`GET /documents/:id/export`) and imports one via a two-step flow: upload the
 * file bytes (`POST /files`, base64) then create a document from the uploaded
 * file id (`POST /documents/import`). Only Markdown is supported today (pdf/docx
 * are backend follow-ups).
 */

/** Fetch a document as raw Markdown text. */
export async function exportDocumentMarkdown(id: string): Promise<string> {
  const res = await fetch(`/api/documents/${encodeURIComponent(id)}/export`, {
    credentials: 'include'
  });
  if (!res.ok) {
    const message = (await res.text().catch(() => '')) || `Export failed (${res.status})`;
    throw { status: res.status, message } satisfies { status: number; message: string };
  }
  return res.text();
}

/** Trigger a browser download of Markdown text as `<name>.md`. */
export function downloadMarkdown(name: string, markdown: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${(name || 'document').replace(/\.md$/i, '')}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// Base64-encode a file's bytes (UTF-8 safe) for the /files upload body.
async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/**
 * Import a Markdown file as a new document: upload the bytes, then create the
 * document from the file id. Returns the new document's id + name (open it with
 * `openTab(name, id, 'document')`).
 */
export async function importMarkdownFile(file: File): Promise<{ id: string; name: string }> {
  const content = await fileToBase64(file);
  const uploaded = await api<{ id: string }>('/files', {
    method: 'POST',
    body: JSON.stringify({
      name: file.name,
      contentType: file.type || 'text/markdown',
      content
    })
  });
  const name = file.name.replace(/\.md$/i, '').trim();
  const doc = await api<{ id: string; name: string }>('/documents/import', {
    method: 'POST',
    body: JSON.stringify({ fileId: uploaded.id, name })
  });
  return { id: doc.id, name: doc.name };
}
