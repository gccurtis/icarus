import { cubicOut } from 'svelte/easing';

/**
 * Motion timings mirror the tokens in src/app.css (see the surfaces/motion
 * spec). Use these for Svelte JS transitions so component motion stays
 * consistent with CSS motion.
 */
export const DURATION = {
  micro: 100, // micro feedback     (80–120ms)
  small: 150, // small transitions (120–180ms)
  panel: 220, // panel changes     (180–240ms)
  overlay: 260 // overlays         (200–280ms)
} as const;

/** The calm ease-out used across Taurus (matches --ease-taurus intent). */
export const EASE = cubicOut;

/** True when the user asked for reduced motion. */
export function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Collapse a duration to 0 when reduced motion is requested. */
export function motionDuration(ms: number): number {
  return reducedMotion() ? 0 : ms;
}
