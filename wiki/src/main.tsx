import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

import "@app-styles/chromatic-themes/celestial/celestial.css";
import "@app-styles/chromatic-themes/cyberpunk/cyberpunk.css";
import "@app-styles/chromatic-themes/slots.css";
import "@app-styles/semantic-tokens/color.css";
import "@app-styles/semantic-tokens/typography.css";
import "@app-styles/semantic-tokens/spacing.css";
import "@app-styles/semantic-tokens/shape.css";
import "@app-styles/semantic-tokens/motion.css";

import "./styles.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
