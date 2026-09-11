import { useEffect, useState } from "react";

const loaders = import.meta.glob("../../../app/src/**/*", { query: "?raw", import: "default" }) as Record<string, () => Promise<string>>;

const loaderFor = (app: string) => loaders[`../../../app/${app}`];

export const Source = ({ app }: { app: string }) => {
  const [text, setText] = useState<string | null>(null);
  const [wanted, setWanted] = useState(false);
  const [failed, setFailed] = useState(false);
  const loader = loaderFor(app);

  useEffect(() => {
    if (!wanted || text !== null || !loader) return;
    let live = true;
    loader()
      .then((loaded) => {
        if (live) setText(loaded);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [wanted, text, loader]);

  if (!loader) return <p className="chip danger">source not served</p>;

  if (!wanted) {
    return (
      <button type="button" className="theme-toggle" onClick={() => setWanted(true)}>
        Show source
      </button>
    );
  }

  if (failed) return <p className="chip danger">source failed to load</p>;
  if (text === null) return <p className="chip">loading…</p>;

  const lines = text.split("\n");
  return (
    <pre className="source">
      {lines.map((line, index) => (
        <span key={index} style={{ display: "block" }}>
          <span className="ln">{index + 1}</span>
          {line}
        </span>
      ))}
    </pre>
  );
};

export const sourceServed = (app: string): boolean => Boolean(loaderFor(app));
