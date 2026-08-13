/**
 * The formatting vocabulary shared by private marks, the display projection,
 * and the runtime inputs that request a change. It sits apart from both
 * `raw-content.ts` and `display-content.ts` because all three depend on it.
 */

export interface StyleProperties {
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  readonly strike?: boolean;
  readonly code?: boolean;
  readonly fontFamily?: string;
  readonly fontSize?: number;
  readonly fontWeight?: number;
  readonly color?: string;
  readonly backgroundColor?: string;
  readonly letterSpacing?: number;
  readonly lineHeight?: number;
}

/** Every style property resolved to a concrete value for one display segment. */
export type ResolvedStyle = Readonly<Required<StyleProperties>>;

export type LinkTarget =
  | { readonly kind: "url"; readonly href: string }
  | {
      readonly kind: "resource";
      readonly resourceKind: string;
      readonly resourceId: string;
      readonly locator?: string;
    };

export type ListPresentation =
  | {
      readonly kind: "unordered";
      readonly marker: string;
      readonly separator: string;
    }
  | {
      readonly kind: "ordered";
      readonly start: number;
      readonly separator: string;
    };
