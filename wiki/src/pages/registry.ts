import registry from "./registry.json";

export type PageEntry = {
  route: string;
  title: string;
  group: string;
  file: string;
  summary: string;
  keywords?: string;
  headings: { id: string; text: string }[];
};

export const PAGES = registry as PageEntry[];

export const GROUPS = [...new Set(PAGES.map((page) => page.group))];

export const pageAt = (route: string): PageEntry | undefined => PAGES.find((page) => page.route === route);
