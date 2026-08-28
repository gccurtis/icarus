/**
 * Take a picture of a chart.
 *
 * The point is that a chart made here can leave — into a slide, into a message,
 * into anything that takes an image. A chart nobody can get out of the screen it
 * was made on is a chart that gets rebuilt by hand somewhere else.
 *
 * **Every colour has to be inlined first.** The chart is drawn in custom
 * properties, which is what lets it follow a theme, and a detached SVG has no
 * document to resolve them against — serialize it as-is and every fill comes out
 * black. So the clone is walked and each element's *computed* paint is written
 * onto it, which is the moment the theme is baked in.
 *
 * **Rasterized at 2×**, because the destination for these is a slide, and a
 * slide gets projected.
 */
const PAINT = [
  "fill",
  "stroke",
  "stroke-width",
  "stroke-dasharray",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "font-family",
  "font-size",
  "font-weight"
] as const;

const inlinePaint = (source: Element, clone: Element) => {
  const computed = getComputedStyle(source);
  const declarations = PAINT.map((property) => `${property}:${computed.getPropertyValue(property)}`);
  clone.setAttribute("style", `${clone.getAttribute("style") ?? ""};${declarations.join(";")}`);

  const sources = source.children;
  const clones = clone.children;
  for (let index = 0; index < sources.length; index += 1) {
    inlinePaint(sources[index], clones[index]);
  }
};

/**
 * The colour actually behind the chart.
 *
 * Every surface in this application is painted with a token, so the ground for
 * a picture of the chart is whatever the first ancestor with an opaque
 * background resolved to. Falling back to the document element rather than to a
 * chosen colour is what keeps this theme-following and literal-free.
 */
const opaque = (color: string) => {
  // Read the alpha rather than compare against a written-out transparent, which
  // would be a colour literal in a file the style lint forbids them in — and
  // would also miss every other fully-transparent spelling.
  const channels = color.match(/[\d.]+/g);
  if (!channels) return false;
  return channels.length < 4 || Number(channels[3]) > 0;
};

const groundOf = (element: Element): string => {
  let node: Element | null = element;
  while (node) {
    const painted = getComputedStyle(node).backgroundColor;
    if (painted && opaque(painted)) return painted;
    node = node.parentElement;
  }
  return getComputedStyle(document.documentElement).backgroundColor;
};

/** The chart as a PNG blob, theme baked in. */
export const chartToPng = async (svg: SVGSVGElement, scale = 2): Promise<Blob> => {
  const box = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(box.width));
  clone.setAttribute("height", String(box.height));
  inlinePaint(svg, clone);

  const markup = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("the chart could not be rasterized"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(box.width * scale));
    canvas.height = Math.max(1, Math.round(box.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");

    // The surface is painted first: a transparent PNG dropped onto a dark slide
    // shows dark axis labels on dark, which is not what was on screen. The
    // colour is found rather than chosen — walking up to the first ancestor
    // that actually paints something keeps this following the theme, and keeps
    // a literal colour out of a file that must not contain one.
    context.fillStyle = groundOf(svg);
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("no blob"))), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * Put the chart on the clipboard as an image.
 *
 * Returns what went wrong, or `undefined`. Clipboard images are refused outside
 * a user gesture and in browsers that do not implement `ClipboardItem`, and both
 * are cases the caller has to be able to say something about rather than fail
 * silently.
 */
export const copyChart = async (svg: SVGSVGElement): Promise<string | undefined> => {
  try {
    const png = await chartToPng(svg);
    if (typeof ClipboardItem === "undefined") return "this browser cannot put an image on the clipboard";
    await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "the chart could not be copied";
  }
};
