import { createRoot } from "react-dom/client";

import { measurer } from "$authored-components/sheet-surface/sheet-surface-theme";
import type { SurfaceHeld } from "$authored-components/sheet-surface/sheet-surface.state.svelte";
import type { SurfaceApi, SurfaceSelection } from "$authored-components/sheet-surface/sheet-surface-types";

const PORTAL = "portal";

const ensurePortal = () => {
  if (document.getElementById(PORTAL) !== null) return;

  const portal = document.createElement("div");
  portal.id = PORTAL;
  portal.style.position = "fixed";
  portal.style.left = "0";
  portal.style.top = "0";
  portal.style.zIndex = "60";
  document.body.appendChild(portal);
};

export type Mounting = {
  readonly held: SurfaceHeld;
  readonly selection: () => SurfaceSelection | undefined;
  readonly ondelete: (selection: SurfaceSelection) => void;
  readonly api: (api: SurfaceApi) => void;
};

/**
 * The React root, the measurement it draws with, and the two observers that
 * keep both honest.
 *
 * The theme is read from the document rather than passed, so a change of
 * appearance is a mutation to watch for; the size is the element's, so it is a
 * resize. Both dispose with the component, and the root unmounts in a
 * microtask because React refuses to unmount inside its own render.
 */
export const mountsTheGrid = (mounting: Mounting): void => {
  const held = mounting.held;

  $effect(() => {
    const element = held.host;
    const outer = held.frame;
    if (element === undefined || outer === undefined) return;

    ensurePortal();
    held.measure = measurer(outer);
    held.root = createRoot(element);

    const themed = new MutationObserver(() => {
      held.measure?.dispose();
      held.measure = measurer(outer);
    });
    themed.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-appearance", "data-theme", "class", "style"]
    });

    mounting.api({
      copy: () => void held.ref.current?.emit("copy"),
      cut: () => {
        void held.ref.current?.emit("copy");
        const chosen = mounting.selection();
        if (chosen !== undefined) mounting.ondelete(chosen);
      },
      paste: () => void held.ref.current?.emit("paste"),
      focus: () => held.ref.current?.focus()
    });

    const watcher = new ResizeObserver(() => {
      held.size = { width: outer.clientWidth, height: outer.clientHeight };
    });
    watcher.observe(outer);
    held.size = { width: outer.clientWidth, height: outer.clientHeight };

    return () => {
      watcher.disconnect();
      themed.disconnect();
      held.measure?.dispose();
      const mounted = held.root;
      held.root = undefined;
      queueMicrotask(() => mounted?.unmount());
    };
  });
};
