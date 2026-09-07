export type PageSlug = "overview" | "values" | "slicing" | "references" | "errors" | "built" | "variables";

export type NavItem = {
  readonly slug: PageSlug;
  readonly index: string;
  readonly label: string;
  readonly href: string;
};

export type Row = readonly string[];

export type Grid = {
  readonly columns: readonly string[];
  readonly rows: readonly Row[];
  readonly mono?: readonly number[];
};

export type Example = {
  readonly expression: string;
  readonly answers: string;
  readonly kind: string;
  readonly note?: string;
};

export type Card = {
  readonly title: string;
  readonly detail: string;
  readonly tag?: string;
  readonly tone?: "works" | "proposed" | "gap" | "ruled";
};

export type Stage = {
  readonly index: string;
  readonly title: string;
  readonly detail: string;
  readonly source: string;
};
