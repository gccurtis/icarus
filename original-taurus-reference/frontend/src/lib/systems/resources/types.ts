export type ResourceKind = 'document' | 'spreadsheet' | 'slides' | 'chat' | 'general';

/** A resource's access scope (Omega `AccessScope`). `projectWide` = every project
 *  member can see it; otherwise only the owner plus the listed users/orgs. */
export type AccessScope = { projectWide: boolean; orgIds: string[]; userIds: string[] };

export type Resource = {
  id: string;
  name: string;
  kind: ResourceKind;
  updatedAt: number;
  /** When the resource was first created. Omega has always sent it on the
   *  catalog page; it is kept so the inspector can show it without a second
   *  per-resource fetch. */
  createdAt: number;
  /** Rendered at the top of the table when true (a per-project pin). */
  pinned: boolean;
  /** Who can see the resource within the project (Omega `AccessScope`). */
  access: AccessScope;
  /** The resource owner's user id; only the owner may change access. */
  creatorId?: string;
};

/** A project-wide scope with no user/org restrictions (Omega's default). */
export const projectWideAccess = (): AccessScope => ({ projectWide: true, orgIds: [], userIds: [] });

export const RESOURCE_KINDS: { id: ResourceKind; label: string }[] = [
  { id: 'document', label: 'Documents' },
  { id: 'spreadsheet', label: 'Sheets' },
  { id: 'slides', label: 'Slides' },
  { id: 'chat', label: 'Chats' },
  { id: 'general', label: 'General' }
];

const KNOWN_KINDS = new Set<string>(RESOURCE_KINDS.map((k) => k.id));
export function toKind(kind: string): ResourceKind {
  return KNOWN_KINDS.has(kind) ? (kind as ResourceKind) : 'general';
}
