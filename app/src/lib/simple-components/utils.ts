import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class lists so the last conflicting Tailwind utility wins.
 *
 * `clsx` flattens conditionals; `twMerge` resolves conflicts — without it a
 * caller passing `class="bg-surface-panel"` to a component whose base already
 * sets `bg-card` would get both, and the winner would depend on stylesheet
 * order rather than intent.
 *
 * Shipped by the shadcn registry as `utils.ts`; kept verbatim so registry
 * components can be updated without patching their imports.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, "child"> : T;
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
