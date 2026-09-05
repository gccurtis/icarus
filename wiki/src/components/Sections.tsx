import type { ReactNode } from "react";

import { Prose } from "./Prose";

export type Section = { id: string; title: string; body: string };

export const slug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const splitSections = (markdown: string, depth = 2): { lead: string; sections: Section[] } => {
  const marker = `${"#".repeat(depth)} `;
  const lines = markdown.split("\n");
  const sections: Section[] = [];
  const lead: string[] = [];
  let current: Section | null = null;
  let fence = false;
  for (const line of lines) {
    if (line.startsWith("```")) fence = !fence;
    if (!fence && line.startsWith(marker) && !line.startsWith(`${marker}#`)) {
      const title = line.slice(marker.length).trim();
      current = { id: slug(title), title, body: "" };
      sections.push(current);
      continue;
    }
    if (current) current.body += `${line}\n`;
    else lead.push(line);
  }
  return { lead: lead.join("\n"), sections };
};

export const Sections = ({ markdown, after, before, depth = 2, wide }: { markdown: string; after?: Record<string, ReactNode>; before?: Record<string, ReactNode>; depth?: number; wide?: boolean }) => {
  const { lead, sections } = splitSections(markdown, depth);
  const Heading = depth === 3 ? "h3" : "h2";
  return (
    <>
      {lead.trim() && <Prose markdown={lead} wide={wide} />}
      {sections.map((section) => (
        <section key={section.id} id={`section-${section.id}`}>
          <Heading id={section.id}>{section.title}</Heading>
          {before?.[section.id]}
          {section.body.trim() && <Prose markdown={section.body} wide={wide} />}
          {after?.[section.id]}
        </section>
      ))}
    </>
  );
};

export const sectionBody = (markdown: string, id: string, depth = 2): string | undefined => splitSections(markdown, depth).sections.find((section) => section.id === id)?.body;
