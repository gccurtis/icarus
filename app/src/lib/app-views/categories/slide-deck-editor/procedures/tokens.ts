export type Palette = (colour: string | undefined, fallback: string) => string;

const isToken = (value: string): boolean => value.startsWith("--");

let probe: HTMLSpanElement | undefined;

const prober = (): HTMLSpanElement => {
  if (probe !== undefined) return probe;

  const made = document.createElement("span");
  made.style.position = "absolute";
  made.style.visibility = "hidden";
  made.style.pointerEvents = "none";
  document.body.appendChild(made);

  probe = made;
  return made;
};

export const palette = (): Palette => {
  if (typeof document === "undefined") return (colour, fallback) => colour ?? fallback;

  const root = getComputedStyle(document.documentElement);
  const resolved = new Map<string, string>();

  const declared = (name: string): boolean => root.getPropertyValue(name).trim() !== "";

  const read = (name: string): string => {
    const seen = resolved.get(name);
    if (seen !== undefined) return seen;

    const element = prober();
    element.style.color = `var(${name})`;
    const answer = getComputedStyle(element).color;

    resolved.set(name, answer);
    return answer;
  };

  return (colour, fallback) => {
    const wanted = colour === undefined || colour === "" ? fallback : colour;
    if (!isToken(wanted)) return wanted;

    return read(declared(wanted) ? wanted : fallback);
  };
};
