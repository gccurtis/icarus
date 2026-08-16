import { v, type Infer } from "convex/values";

/**
 * What a project holds and works over — the kinds a scope can select and the
 * kinds retrieval can index.
 *
 * **A finding is one of them.** It is durable project content with a body, it is
 * cited, and "answer from our findings only" is an obvious thing to want to scope
 * to. A question and a hypothesis are the project's *open threads* rather than
 * its material, so neither is here: retrieving over a question would return the
 * asking rather than an answer.
 *
 * **Messages are outside it deliberately.** A conversation is working material,
 * and a message worth keeping is promoted to a finding — the promotion is the
 * editorial act worth indexing, not the raw transcript.
 *
 * Not to be confused with the *general* resources, which are the three with a
 * body a change set edits, nor with what a comment can hang on — that set
 * includes the open threads, because remarking on a question is exactly what
 * people do with one.
 */
export const resourceKindValidator = v.union(
  v.literal("document"),
  v.literal("slides"),
  v.literal("spreadsheet"),
  v.literal("externalFile"),
  v.literal("finding"),
  v.literal("connector"),
  v.literal("template")
);

export type ResourceKind = Infer<typeof resourceKindValidator>;
