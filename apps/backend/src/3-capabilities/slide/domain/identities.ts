import type {
  DeckSnapshot,
  Slide,
  SlideElement
} from "./model.js";

export type SlideIdentityKind =
  | "style"
  | "slide"
  | "group"
  | "shape"
  | "rich-text-atom"
  | "rich-text-mark";

export interface SlideIdentity {
  kind: SlideIdentityKind;
  id: string;
}

export interface SlideIdentityTransitions {
  added: SlideIdentity[];
  removed: SlideIdentity[];
}

export type SlideIdentityLedgerState = "active" | "tombstoned";

export interface SlideIdentityLedgerEntry extends SlideIdentity {
  deckId: string;
  state: SlideIdentityLedgerState;
  firstRevision: number;
  lastTransitionRevision: number;
  tombstonedRevision?: number;
}

export type SlideIdentityReactivation = "forbid" | "same-kind-compensation";

const compareIdentities = (left: SlideIdentity, right: SlideIdentity): number => {
  if (left.id !== right.id) return left.id < right.id ? -1 : 1;
  if (left.kind !== right.kind) return left.kind < right.kind ? -1 : 1;
  return 0;
};

const identityKey = (identity: SlideIdentity): string =>
  `${identity.id}\u0000${identity.kind}`;

const collectRichContentIdentities = (
  content: Slide["notes"],
  identities: SlideIdentity[]
): void => {
  for (const atom of content.atoms) identities.push({ kind: "rich-text-atom", id: atom.id });
  for (const mark of content.marks) identities.push({ kind: "rich-text-mark", id: mark.id });
};

const collectElementIdentities = (
  element: SlideElement,
  identities: SlideIdentity[]
): void => {
  identities.push({
    kind: element.elementKind === "group" ? "group" : "shape",
    id: element.id
  });
  if (element.elementKind === "shape" && element.shapeKind === "text") {
    collectRichContentIdentities(element.content, identities);
  }
};

/** External Derived Output and image IDs are references, not Slide identities. */
export const collectSlideIdentities = (snapshot: DeckSnapshot): SlideIdentity[] => {
  const identities: SlideIdentity[] = snapshot.styles.styles.map((style) => ({
    kind: "style",
    id: style.id
  }));
  for (const slideId of snapshot.slideOrder) {
    const slide = Object.hasOwn(snapshot.slides, slideId) ? snapshot.slides[slideId] : undefined;
    if (!slide) continue;
    identities.push({ kind: "slide", id: slide.id });
    collectRichContentIdentities(slide.notes, identities);
    for (const element of Object.values(slide.elements)) {
      collectElementIdentities(element, identities);
    }
  }
  return identities.sort(compareIdentities);
};

export const computeSlideIdentityTransitions = (
  before: DeckSnapshot,
  after: DeckSnapshot
): SlideIdentityTransitions => {
  const beforeIdentities = collectSlideIdentities(before);
  const afterIdentities = collectSlideIdentities(after);
  const beforeKeys = new Set(beforeIdentities.map(identityKey));
  const afterKeys = new Set(afterIdentities.map(identityKey));
  return {
    added: afterIdentities.filter((identity) => !beforeKeys.has(identityKey(identity))),
    removed: beforeIdentities.filter((identity) => !afterKeys.has(identityKey(identity)))
  };
};
