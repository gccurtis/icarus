import type { ResourceRef } from "$shared/types/resource";
import type { ResourceSetExpression, Selector } from "$shared/types/resource-set-expression";

/**
 * The copilot — the message that has not been sent.
 *
 * Everything a conversation already contains is read from the server. Persona
 * threads, agent tasks and the messages inside them are rows, read with
 * `useQuery` — live subscriptions that update whenever anything anywhere writes.
 * This object holds no conversation content, no thread list, and no unread
 * count; each of those is a query, and a cache beside a live subscription is a
 * second answer that can disagree with the first.
 *
 * Which conversation the inspector is showing is **navigation**, and navigation
 * is an inspection: it lives on the active tab as a `copilot.*` inspection key,
 * set through `workbench.inspect()`.
 */

/** How the next message is treated. Global — a tab change does not alter it. */
export type Mode = "ask" | "act" | "plan";

/**
 * Where the next message goes.
 *
 * `new` is the only arm that needs a persona, because an existing thread already
 * carries its own — which is why `blocked` names exactly that pair.
 *
 * Ids are plain strings rather than `Id<"personaThreads">`. Neither table exists
 * yet, and the model would have to be loosened to admit a third destination
 * anyway.
 */
export type Destination =
  | { readonly kind: "new" }
  | { readonly kind: "persona-thread"; readonly id: string }
  | { readonly kind: "agent-task"; readonly id: string };

/**
 * A fetched link, as an attachment carries it.
 *
 * **It carries the result of its fetch**, so it is added once that fetch
 * resolves rather than before. The chip appears already knowing whether the link
 * worked, which is the only moment the user can act on it — and it is why
 * nothing in the attachment list is ever pending.
 */
export type LinkAttachment = {
  readonly kind: "link";
  readonly url: string;
  readonly triedAt: number;
  readonly ok: boolean;
  readonly fileId?: string;
  readonly error?: string;
};

/**
 * What the user pointed at, as opposed to what the response may search.
 *
 * Attachments are written onto the message, so they outlive the composer and the
 * conversation. Scope does not — it is a standing decision about what the *next*
 * message may draw on, which is why one survives a send and the other does not.
 *
 * **The ref arm is wrapped, and the design document has it bare.** `ResourceRef`
 * carries an *open* `kind: string`, so `ResourceRef | { kind: "link"; … }` is
 * not a discriminated union — `"link"` is a perfectly legal resource kind, and
 * nothing could tell the two arms apart at a type level or at runtime. Wrapping
 * makes the discriminant this object's own, which is the same move `Selector`
 * already makes for the same reason.
 */
export type Attachment =
  | { readonly kind: "resource"; readonly ref: ResourceRef }
  | LinkAttachment;

/** Why the message cannot be sent, or nothing. */
export type Blocked = "empty-draft" | "no-persona" | undefined;

export type CopilotModel = {
  readonly mode: Mode;
  readonly destination: Destination;
  /** Who answers a new conversation. An existing thread carries its own. */
  readonly personaId: string | undefined;
  /** The composer text. One draft, kept across a destination change. */
  readonly draft: string;
  /** What the response may draw on. Survives a send. */
  readonly scope: ResourceSetExpression;
  /** What this turn carries. Written onto the message and cleared on send. */
  readonly attachments: readonly Attachment[];

  setMode(mode: Mode): void;
  write(text: string): void;
  selectPersona(id?: string): void;
  /** Keeps the draft, the scope and the attachments: redirecting, not restarting. */
  address(destination: Destination): void;

  include(selector: Selector): void;
  exclude(selector: Selector): void;
  dropSelector(selector: Selector): void;
  clearScope(): void;

  attach(attachment: Attachment): void;
  detach(attachment: Attachment): void;
  clearAttachments(): void;

  /** Why the message cannot be sent, or `undefined`. */
  readonly blocked: Blocked;
  /**
   * Past tense. The dock calls the mutation and reports the result; this records
   * that it landed — clearing the draft and the attachments, keeping mode,
   * persona and scope, and addressing whatever the message landed in.
   *
   * A refused mutation leaves the draft in the composer, because this was never
   * called, and the failure is the dock's to render. That keeps the object
   * testable without a network and puts an error where it can be seen.
   */
  sent(destination: Destination): void;

  /** Bumps a counter the dock watches. The whole of the `copilot.focus` command. */
  focus(): void;
  readonly focusRequests: number;
};

/**
 * An empty scope, which resolves to **nothing** rather than everything.
 *
 * That is `shared`'s rule and it is the safe direction: an empty include list is
 * what an unfinished form produces, and a default that silently meant "the whole
 * project" is how a scope somebody meant to narrow leaks the lot. Everything is
 * `{ include: [{ kind: "project" }] }`, said out loud.
 *
 * A function rather than a frozen constant, because the definition wraps what it
 * is given in `$state` — sharing one object between two client instances would
 * make a proxy of it and let a write in one reach the other.
 */
export const emptyScope = (): ResourceSetExpression => ({ include: [], exclude: [] });
