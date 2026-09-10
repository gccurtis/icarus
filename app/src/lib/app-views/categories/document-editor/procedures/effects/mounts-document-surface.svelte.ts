import type {
  DocumentCommands,
  DocumentSessionContext
} from "$app-views/categories/document-editor/procedures/document-session";

export type DocumentSurfaceContext = DocumentSessionContext & {
  readonly commands: DocumentCommands;
  readonly hasGutterLane: () => boolean;
  readonly zoom: () => number | undefined;
};

/** Owns browser resources whose lifetime is the mounted document surface. */
export const mountsDocumentSurface = (context: DocumentSurfaceContext): void => {
  $effect(() => {
    void context.zoom();
    void context.held.available;
    void context.runtime?.body;
    void context.hasGutterLane();
    const frame = requestAnimationFrame(context.commands.place);
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => () => {
    context.session.editor?.destroy();
    context.session.editor = undefined;
  });

  $effect(() => {
    const element = context.held.surface;
    if (element === undefined) return;
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      context.held.available = element.clientWidth / (rem > 0 ? rem : 16);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  });

  $effect(() => {
    const element = context.held.surface;
    if (element === undefined) return;
    const beside = (event: MouseEvent) => {
      const target = event.target;
      if (context.held.host !== undefined && target instanceof Node && context.held.host.contains(target)) return;
      if (target instanceof Element && target.closest(".lane") !== null) return;
      context.view.clear();
    };
    element.addEventListener("mousedown", beside);
    return () => element.removeEventListener("mousedown", beside);
  });
};
