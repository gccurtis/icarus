import { createElement } from "react";
import { DataEditor } from "@glideapps/glide-data-grid";

import { editorPropsOf, type Editor } from "$authored-components/sheet-surface/sheet-surface-editor";
import type { SurfaceHeld } from "$authored-components/sheet-surface/sheet-surface.state.svelte";

/**
 * The library, re-rendered from the scene whenever anything it draws changes.
 *
 * React owns the canvas, so this is the one place the two worlds meet: every
 * other arrangement changes the scene, and the scene arrives here.
 */
export const rendersTheGrid = (held: SurfaceHeld, editor: () => Editor | undefined): void => {
  $effect(() => {
    const mounted = held.root;
    const asked = editor();
    if (mounted === undefined || asked === undefined) return;
    if (asked.width === 0 || asked.height === 0) return;

    mounted.render(createElement(DataEditor, { ...editorPropsOf(asked), ref: held.ref }));
  });
};
