import { useMemo, type MouseEvent } from "react";
import { marked } from "marked";
import { useNavigate } from "react-router-dom";

import { renderMarkers } from "./markers";

marked.setOptions({ gfm: true, breaks: false });

const render = (markdown: string): string => marked.parse(renderMarkers(markdown)) as string;

export const Prose = ({ markdown, wide = false }: { markdown: string; wide?: boolean }) => {
  const navigate = useNavigate();
  const html = useMemo(() => render(markdown), [markdown]);

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest("a");
    if (!target) return;
    const href = target.getAttribute("href") ?? "";
    if (!href.startsWith("/")) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(href);
  };

  return <div className={wide ? "prose wide" : "prose"} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
};

export const Markdown = ({ text }: { text: string }) => {
  const navigate = useNavigate();
  const html = useMemo(() => marked.parse(text) as string, [text]);
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest("a");
    if (!target) return;
    const href = target.getAttribute("href") ?? "";
    if (!href.startsWith("/")) return;
    event.preventDefault();
    navigate(href);
  };
  return <div className="prose" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
};
