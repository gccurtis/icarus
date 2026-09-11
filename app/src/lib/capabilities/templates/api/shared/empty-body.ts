import type { TemplateBody } from "$representation/data/types/templates/template";
import type { TemplateTarget } from "$capabilities/templates/types/templates";

const defaultPage = {
  paper: "letter" as const,
  orientation: "portrait" as const,
  margins: { top: 0.75, right: 0.75, bottom: 0.75, left: 0.75 }
};

const defaultStyles = {
  defaultKey: "body",
  styles: {
    body: { name: "Body", fontFamily: "IBM Plex Sans" }
  }
};

const emptyPresentation = () => ({
  aspectRatio: "16:9" as const,
  theme: {
    colors: {
      text: "--token-ink-primary",
      accent: "--token-color-accent-1-fill",
      muted: "--token-ink-muted"
    },
    fontFamily: "IBM Plex Sans"
  },
  styles: defaultStyles,
  layouts: [],
  sections: []
});

export const emptyTemplateBody = (target: TemplateTarget): TemplateBody => {
  if (target === "document") return { resource: "document", rows: [] };
  if (target === "presentation") return { resource: "presentation", ...emptyPresentation(), slides: [] };
  return {
    resource: "spreadsheet",
    cells: {},
    formatRules: [],
    print: { page: defaultPage, gridlines: true, headings: true },
    styles: defaultStyles
  };
};
