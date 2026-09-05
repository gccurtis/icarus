import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import { search, searchSize, type SearchEntry } from "../search";

export const Search = () => {
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
      if (event.key === "/" && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => search(query), [query]);
  const shown = focused && query.trim().length > 0;

  const go = (entry: SearchEntry) => {
    setQuery("");
    setFocused(false);
    input.current?.blur();
    navigate(entry.route);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((held) => Math.min(held + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((held) => Math.max(held - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (results[active]) go(results[active]);
    } else if (event.key === "Escape") {
      setQuery("");
      setFocused(false);
      input.current?.blur();
    }
  };

  useEffect(() => setActive(0), [query]);

  return (
    <div className="search">
      <input
        ref={input}
        type="search"
        placeholder={`Search ${searchSize.toLocaleString()} things`}
        aria-label="Search the wiki"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 120)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        spellCheck={false}
      />
      {!focused && <kbd>⌘K</kbd>}
      {shown && (
        <div className="results" role="listbox" aria-label="Search results">
          {results.length === 0 && <div className="empty">Nothing named that.</div>}
          {results.map((entry, index) => (
            <button
              key={`${entry.kind}:${entry.route}:${entry.title}`}
              type="button"
              role="option"
              aria-selected={index === active}
              className={`result ${index === active ? "is-active" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => go(entry)}
            >
              <span className="kind">{entry.kind}</span>
              <span className="title">{entry.title}</span>
              {entry.path && <span className="path">{entry.path}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
