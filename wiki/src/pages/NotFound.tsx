import { Link } from "react-router-dom";

import { Page } from "../components/common";

export const NotFound = () => (
  <Page title="Nothing here" lede="No page answers to that route.">
    <p>
      <Link to="/">Back to the overview</Link>, or search for what you meant with <span className="kbd">⌘K</span>.
    </p>
  </Page>
);
