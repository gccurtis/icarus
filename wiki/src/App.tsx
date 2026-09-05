import { useEffect, useLayoutEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";

import { Sidebar } from "./components/Sidebar";
import { Overview } from "./pages/Overview";
import { Architecture } from "./pages/Architecture";
import { TreePage } from "./pages/Tree";
import { Browse } from "./pages/Browse";
import { FilePage } from "./pages/File";
import { Checks } from "./pages/Checks";
import { CheckPage } from "./pages/Check";
import { Generators } from "./pages/Generators";
import { Tests } from "./pages/Tests";
import { DesignOverview } from "./pages/design/Overview";
import { Themes } from "./pages/design/Themes";
import { Slots } from "./pages/design/Slots";
import { Tokens } from "./pages/design/Tokens";
import { Integrations } from "./pages/design/Integrations";
import { DataModel } from "./pages/DataModel";
import { Views } from "./pages/Views";
import { Configuration } from "./pages/Configuration";
import { DocumentEditor } from "./pages/algorithms/DocumentEditor";
import { SemanticOverlay } from "./pages/algorithms/SemanticOverlay";
import { SlideDeck } from "./pages/algorithms/SlideDeck";
import { Charts } from "./pages/algorithms/Charts";
import { Workspace } from "./pages/algorithms/Workspace";
import { Revisions } from "./pages/algorithms/Revisions";
import { CapabilityTrace } from "./pages/traces/Capability";
import { ViewTrace } from "./pages/traces/View";
import { Gaps } from "./pages/Gaps";
import { NotFound } from "./pages/NotFound";

const THEME_KEY = "icarus-wiki.theme";

const readTheme = (): string => {
  if (typeof window === "undefined") return "celestial";
  try {
    const held = localStorage.getItem(THEME_KEY);
    return held === "cyberpunk" ? "cyberpunk" : "celestial";
  } catch {
    return "celestial";
  }
};

const ScrollToAnchor = () => {
  const location = useLocation();
  useLayoutEffect(() => {
    const main = document.querySelector(".main");
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ block: "start" });
        return;
      }
    }
    main?.scrollTo(0, 0);
  }, [location.pathname, location.hash]);
  return null;
};

export const App = () => {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      return;
    }
  }, [theme]);

  return (
    <div className="shell">
      <Sidebar theme={theme} onTheme={setTheme} />
      <main className="main">
        <ScrollToAnchor />
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/architecture" element={<Architecture />} />
          <Route path="/trees/:tree" element={<TreePage />} />
          <Route path="/browse/:tree" element={<Browse />} />
          <Route path="/files/*" element={<FilePage />} />
          <Route path="/checks" element={<Checks />} />
          <Route path="/checks/:tree/:name" element={<CheckPage />} />
          <Route path="/generators" element={<Generators />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/design-system" element={<DesignOverview />} />
          <Route path="/design-system/themes" element={<Themes />} />
          <Route path="/design-system/slots" element={<Slots />} />
          <Route path="/design-system/tokens" element={<Tokens />} />
          <Route path="/design-system/integrations" element={<Integrations />} />
          <Route path="/data-model" element={<DataModel />} />
          <Route path="/views" element={<Views />} />
          <Route path="/configuration" element={<Configuration />} />
          <Route path="/algorithms/document-editor" element={<DocumentEditor />} />
          <Route path="/algorithms/semantic-overlay" element={<SemanticOverlay />} />
          <Route path="/algorithms/slide-deck" element={<SlideDeck />} />
          <Route path="/algorithms/charts" element={<Charts />} />
          <Route path="/algorithms/workspace" element={<Workspace />} />
          <Route path="/algorithms/revisions" element={<Revisions />} />
          <Route path="/traces/capability" element={<CapabilityTrace />} />
          <Route path="/traces/view" element={<ViewTrace />} />
          <Route path="/gaps" element={<Gaps />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </div>
  );
};
