/** Join truthy class values into a single className string. */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}

/** Stable unique id for label/aria wiring. */
let uid = 0;
export function useId(prefix = 'trs'): string {
  uid += 1;
  return `${prefix}-${uid}`;
}

/** Slug for filenames and identifiers, e.g. "My Project" → "my-project". */
export function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled';
}
