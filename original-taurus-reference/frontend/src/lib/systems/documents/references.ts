import { api } from '$data/api';

/**
 * Document reference graph (Omega `opts.References`). Edges are derived from the
 * inline links each document carries: `references` are this document's outgoing
 * edges (what it links to); `backlinks` are the edges that point at it. Replaces
 * the mock reference lists.
 */

/** One endpoint of a reference edge — a resource by kind + id (+ display name). */
export interface ReferenceRef {
  kind: string;
  id: string;
  name?: string;
}

/** A reference edge between two resources, with the link's kind + optional anchor. */
export interface ReferenceEdge {
  fromResource: ReferenceRef;
  toResource: ReferenceRef;
  kind: string;
  anchor?: string;
}

/** This document's outgoing reference edges (what it links to). */
export async function loadReferences(documentId: string): Promise<ReferenceEdge[]> {
  if (!documentId) return [];
  const res = await api<{ references: ReferenceEdge[] }>(
    `/documents/${encodeURIComponent(documentId)}/references`
  );
  return res.references ?? [];
}

/** The edges that point at this document (backlinks). */
export async function loadBacklinks(documentId: string): Promise<ReferenceEdge[]> {
  if (!documentId) return [];
  const res = await api<{ backlinks: ReferenceEdge[] }>(
    `/documents/${encodeURIComponent(documentId)}/backlinks`
  );
  return res.backlinks ?? [];
}
