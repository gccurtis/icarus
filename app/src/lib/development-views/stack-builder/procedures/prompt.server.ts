import type { StackNode } from "$development-views/stack-builder/types";

export type PromptInput = {
  title: string;
  nodes: StackNode[];
  brief: string;
  sources: readonly { name: string; path: string; text: string }[];
  previous?: string;
  feedback?: string;
};

const SYSTEM = [
  "You produce a single static HTML fragment: the body of a mock screen.",
  "Return only HTML. No markdown fence, no commentary, no <html>, <head> or <body> tag.",
  "You may include one <style> element at the top of your output.",
  "Every colour, size, radius, font and duration must be a var(--token-*) reference.",
  "Never include a <script>. The frame is sandboxed and it will not run.",
  "",
  "The component sources below are written in Tailwind utility classes:",
  "text-caption, text-ink-muted, min-w-0, flex, gap-2 and the like.",
  "Those classes DO NOT EXIST in the document you are writing — it loads the token",
  "layer and no utility stylesheet, so any class name you copy renders as nothing.",
  "Take the structure and the semantics from the sources and translate every",
  "utility class into real CSS in your <style> element, against --token-* values.",
  "A class attribute is only for your own selectors, defined in that same block."
].join("\n");

const entry = (node: StackNode, index: number): string => {
  const shows = node.description.trim() || "(nothing said)";

  if (node.kind === "custom") {
    return `${index + 1}. ${node.name} — no component in our vocabulary; invent it.\n   Shows: ${shows}`;
  }

  if (node.kind === "substack") {
    const inner = node.children.map((child, at) => `   ${entry(child, at)}`).join("\n");
    return `${index + 1}. ${node.name} — a group.\n   Shows: ${shows}\n${inner}`;
  }

  return `${index + 1}. ${node.name} (${node.path})\n   Shows: ${shows}`;
};

export const buildMessages = (input: PromptInput): { system: string; user: string } => {
  const stack = input.nodes.map(entry).join("\n");

  const sources = input.sources
    .map((source) => `--- ${source.name} · ${source.path}\n${source.text}`)
    .join("\n\n");

  const task =
    input.feedback && input.previous
      ? [
          "Revise the mock below. Change what the feedback asks for and leave the rest alone.",
          "",
          `Feedback: ${input.feedback}`,
          "",
          "The mock to revise:",
          input.previous
        ].join("\n")
      : "Produce the mock.";

  const user = [
    `# The screen: ${input.title}`,
    "",
    "## The stack, top to bottom",
    stack,
    "",
    "## The token vocabulary — these are the only colours, sizes and fonts that exist",
    input.brief,
    "",
    "## The components named above, as they are actually written",
    sources,
    "",
    "## Task",
    task
  ].join("\n");

  return { system: SYSTEM, user };
};
