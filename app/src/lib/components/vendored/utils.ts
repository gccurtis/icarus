import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const SCALES = {
  font: ["sans", "reading", "mono"],
  text: [
    "display",
    "h1",
    "h2",
    "h3",
    "h4",
    "body-lg",
    "body",
    "body-sm",
    "label",
    "caption",
    "micro",
    "mono"
  ],
  tracking: ["display", "heading", "body", "label", "caps"],
  leading: ["reading"],
  container: ["title", "lede", "prose", "note"],
  radius: ["control", "overlay", "panel"],
  shadow: ["glow", "overlay", "panel", "raised"],
  blur: ["veil"],
  ease: ["arrival", "standard"]
};

const DURATIONS = ["micro", "small", "panel", "overlay", "arrival"];

const twMerge = extendTailwindMerge({
  extend: {
    theme: SCALES,
    classGroups: { duration: [{ duration: DURATIONS }] }
  }
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, "child"> : T;
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, "children"> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
