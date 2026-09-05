import { checkByName, fileById, fileRoute, findCheck, tokenNames } from "../data";

export type Marker =
  | { kind: "file"; id: string; label: string }
  | { kind: "check"; name: string; tree: string | null; label: string }
  | { kind: "token"; name: string }
  | { kind: "symbol"; name: string; id: string }
  | { kind: "tree"; name: string }
  | { kind: "page"; route: string; label: string };

const MARKER = /\[\[(file|check|token|symbol|tree|page):([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export const parseMarker = (kind: string, body: string, label?: string): Marker => {
  switch (kind) {
    case "file":
      return { kind: "file", id: body.trim(), label: label ?? body.trim().replace(/^app\//, "") };
    case "check": {
      const [first, second] = body.trim().split("/");
      return second
        ? { kind: "check", name: second, tree: first, label: label ?? second }
        : { kind: "check", name: first, tree: null, label: label ?? first };
    }
    case "token":
      return { kind: "token", name: body.trim() };
    case "symbol": {
      const [name, id] = body.trim().split("@");
      return { kind: "symbol", name, id };
    }
    case "tree":
      return { kind: "tree", name: body.trim() };
    default:
      return { kind: "page", route: body.trim(), label: label ?? body.trim() };
  }
};

export const markerRoute = (marker: Marker): string | null => {
  switch (marker.kind) {
    case "file":
      return fileById.has(marker.id) ? fileRoute(marker.id) : null;
    case "check": {
      const found = marker.tree ? checkByName.get(`${marker.tree}/${marker.name}`) : findCheck(marker.name)[0];
      return found ? `/checks/${found.tree}/${found.name}` : null;
    }
    case "token":
      return tokenNames.has(marker.name) ? `/design-system/tokens#${encodeURIComponent(marker.name)}` : null;
    case "symbol": {
      const file = fileById.get(marker.id);
      if (!file) return null;
      return file.symbols.some((symbol) => symbol.name === marker.name) ? `${fileRoute(marker.id)}#symbol-${marker.name}` : null;
    }
    case "tree":
      return `/trees/${marker.name}`;
    case "page":
      return marker.route;
  }
};

export const renderMarkers = (markdown: string): string =>
  markdown.replace(MARKER, (whole, kind: string, body: string, label?: string) => {
    const marker = parseMarker(kind, body, label);
    const route = markerRoute(marker);
    const text = (() => {
      switch (marker.kind) {
        case "file":
          return marker.label;
        case "check":
          return marker.label;
        case "token":
          return marker.name;
        case "symbol":
          return marker.name;
        case "tree":
          return marker.name;
        case "page":
          return marker.label;
      }
    })();
    if (!route && marker.kind === "file" && !marker.id.startsWith("app/src/")) return `<code class="mark-file">${text}</code>`;
    if (!route) return `<span class="mark-${marker.kind} missing" title="unresolved: ${whole.replace(/"/g, "&quot;")}">${text}</span>`;
    const dot = marker.kind === "token" ? `<span class="token-dot" style="background: var(${marker.name})"></span>` : "";
    return `<a class="mark-${marker.kind}" href="${route}" data-internal="true">${dot}${text}</a>`;
  });
