/**
 * The one place a scope is chosen.
 *
 * Template defaults, template answers, and document or slide Prompt Blocks all
 * open it at the point where that scope is needed. They differ in what they call
 * the value and what they do with the result, and in nothing else. There is no
 * global Resource Sets management surface.
 */
export { default as ScopeBuilder } from "$authored-components/scope-builder/scope-builder.svelte";
