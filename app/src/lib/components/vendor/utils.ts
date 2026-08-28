import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * This project's scales, told to tailwind-merge.
 *
 * It cannot infer them, and the failure is silent in both directions. Every
 * scale here is spelled with a word rather than a number or a t-shirt size, so
 * tailwind-merge has nothing to recognise: it read `text-caption` as a colour
 * and let a later colour delete it, and it did not recognise `rounded-control`
 * as a radius at all, so a later `rounded-full` never lost to it. One scale
 * dropped what it should have kept; the other kept what it should have dropped.
 *
 * Both showed up in the same afternoon — a caption rendering at the inherited
 * 16px, and a chip rendering as a pill. Neither produced a warning, because in
 * both cases the output was still a valid class list.
 *
 * `theme` rather than `classGroups`, because a scale registered here reaches
 * every group that reads it: naming the radii once covers `rounded-control` and
 * `rounded-e-control` and the ten other corners without listing any of them.
 *
 * **A new `--text-*`, `--radius-*`, `--shadow-*` or `--ease-*` in
 * `styles/x-integrations/tailwind/` belongs in this list too.** There is no
 * check that enforces it; what enforces it is that the next person to override
 * one loses, quietly.
 */
const SCALES = {
  text: ["h1", "h2", "h3", "h4", "body-lg", "body", "body-sm", "label", "caption", "mono"],
  radius: ["control", "overlay", "panel"],
  shadow: ["overlay", "panel", "raised"],
  ease: ["standard"]
};

/** Durations are the one scale with no theme key of its own to be read from. */
const DURATIONS = ["micro", "small", "panel", "overlay"];

const twMerge = extendTailwindMerge({
  extend: {
    theme: SCALES,
    classGroups: { duration: [{ duration: DURATIONS }] }
  }
});

/**
 * Merge class lists so the last conflicting Tailwind utility wins.
 *
 * `clsx` flattens conditionals; `twMerge` resolves conflicts — without it a
 * caller passing `class="bg-muted"` to a component whose base already sets
 * `bg-card` would get both, and the winner would depend on stylesheet order
 * rather than intent.
 *
 * Shipped by the shadcn registry as `utils.ts`. The export and its import path
 * are the registry's and stay that way, so registry components can be updated
 * without patching them; the configuration above is this project's, and belongs
 * here because there is exactly one merge for every component to share.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, "child"> : T;
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
