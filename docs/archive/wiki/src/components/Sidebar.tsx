import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { GROUPS, PAGES } from "../pages/registry";
import { Search } from "./Search";

const STORAGE_KEY = "icarus-wiki.nav";

const readOpen = (): Record<string, boolean> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const DEFAULT_OPEN: Record<string, boolean> = { Start: true, Trees: true, Law: true, "Design system": true, Data: true, Algorithms: true, Traces: true, Gaps: true, Browse: false };

export const Sidebar = ({ theme, onTheme }: { theme: string; onTheme: (next: string) => void }) => {
  const location = useLocation();
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ ...DEFAULT_OPEN, ...readOpen() }));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
    } catch {
      return;
    }
  }, [open]);

  const toggle = (group: string) => setOpen((held) => ({ ...held, [group]: !held[group] }));

  return (
    <aside className="side">
      <div className="side-head">
        <div className="wordmark">
          <NavLink to="/">ICARUS WIKI</NavLink>
          <small>app/src</small>
        </div>
        <Search />
      </div>
      <nav className="nav" aria-label="Sections">
        {GROUPS.map((group) => {
          const pages = PAGES.filter((page) => page.group === group);
          const isOpen = open[group] ?? true;
          const holdsActive = pages.some((page) => page.route === location.pathname);
          return (
            <section key={group} className={`group ${isOpen ? "is-open" : ""}`}>
              <button type="button" className="group-title" aria-expanded={isOpen} onClick={() => toggle(group)}>
                <span className="chevron">▸</span>
                {group}
                {!isOpen && holdsActive && <span className="chip active">·</span>}
              </button>
              {isOpen && (
                <div className="group-items">
                  {pages.map((page) => (
                    <NavLink key={page.route} to={page.route} end className={({ isActive }) => `nav-link ${isActive ? "is-active" : ""} ${page.route.startsWith("/design-system/") || page.route.startsWith("/algorithms/") || page.route.startsWith("/traces/") ? "" : ""}`}>
                      {page.title.replace(/^Browse /, "")}
                    </NavLink>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </nav>
      <div className="side-foot">
        <span>{PAGES.length} pages</span>
        <button type="button" className="theme-toggle" onClick={() => onTheme(theme === "celestial" ? "cyberpunk" : "celestial")}>
          theme: {theme}
        </button>
      </div>
    </aside>
  );
};
