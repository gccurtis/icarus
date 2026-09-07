import type {
  SemanticLocator,
  SemanticLocatorSpan
} from "$representation/data/types/semantic/source";

export type ProjectionWriter = {
  append(text: string, locator: SemanticLocator): void;
  hardBoundary(): void;
  finish(): { text: string; locators: SemanticLocatorSpan[]; hardBoundaries: number[] };
};

export const projectionWriter = (): ProjectionWriter => {
  let text = "";
  const locators: SemanticLocatorSpan[] = [];
  const hardBoundaries = new Set<number>();
  return {
    append(value, locator) {
      const projected = value.trim();
      if (!projected) return;
      if (text.length > 0) text += "\n\n";
      const from = text.length;
      text += projected;
      locators.push({ from, to: text.length, locator });
    },
    hardBoundary() {
      if (text.length > 0) hardBoundaries.add(text.length);
    },
    finish: () => ({ text, locators, hardBoundaries: [...hardBoundaries].sort((a, b) => a - b) })
  };
};
