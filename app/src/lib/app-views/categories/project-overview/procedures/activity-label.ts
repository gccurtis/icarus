const LABELS: Readonly<Record<string, string>> = {
  asked: "Started a research question",
  "accepted a finding on": "Accepted a finding",
  "commented on": "Added a comment",
  connected: "Connected a data source"
};

/** Consumer-facing event wording; stored verbs remain unchanged evidence. */
export const activityLabel = (verb: string): string => {
  const known = LABELS[verb.trim().toLocaleLowerCase()];
  if (known !== undefined) return known;
  const clean = verb.trim();
  return clean.length === 0
    ? "Updated"
    : `${clean[0].toLocaleUpperCase()}${clean.slice(1)}`;
};
