/**
 * The formatting vocabulary shared by private marks, the display projection, and
 * the inputs that request a change.
 *
 * It sits apart from both `raw-content.ts` and `display-content.ts` because all
 * three depend on it, and folding it into either would make the private
 * representation and the public projection import each other.
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

/**
 * Every style property resolved to a concrete value for one display segment.
 *
 * `Required` rather than optional: a renderer should never have to decide what
 * an absent `fontSize` means, and resolving it once here is what keeps that
 * decision out of every consumer.
 */
export type ResolvedStyle = Readonly<Required<StyleProperties>>;

/**
 * A link points at a URL or at another resource in this application.
 *
 * The resource form carries the kind and id rather than a rendered href, because
 * what a resource link should resolve to depends on where it is being displayed
 * — and a stored href would be wrong the moment that changed.
 */
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
