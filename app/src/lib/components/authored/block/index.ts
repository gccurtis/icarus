/**
 * Content blocks: the things a document and a slide are made of.
 *
 * **The block is data; the box is a rendering decision.** Everything here draws
 * content and nothing else unless asked. Chrome — edges, handles, a hover state
 * — is an opt-in layer a surface turns on for its own reasons, which means
 * slides and never documents. A document whose blocks are visible reads as a
 * form, and the block boundaries are an implementation detail that has escaped
 * onto the page.
 *
 * The three sizings are the three surfaces: `flow` is a document's paragraph,
 * `grow` is a slide's text object, `fixed` is a shape.
 */
export { default as ContentBlock } from "$authored-components/block/content-block.svelte";
export { default as BlockText } from "$authored-components/block/block-text.svelte";
