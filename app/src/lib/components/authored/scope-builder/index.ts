/**
 * The one place a scope is chosen.
 *
 * Four surfaces open it: a variable's default from either editor's Templates
 * panel or from the library inspector, the answer given while placing a
 * template, and the Contexts panel's own sets. They differ in what they call it
 * and what they do with the result, and in nothing else.
 */
export { default as ScopeBuilder } from "$authored-components/scope-builder/scope-builder.svelte";
