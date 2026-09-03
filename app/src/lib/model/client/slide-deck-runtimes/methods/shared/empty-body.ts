import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";

const mint = (letter: string): string => `#${letter}${Math.random().toString(36).slice(2, 8)}`;

export const emptyBody = (): SlideDeckBody => ({
  aspectRatio: "16:9",
  theme: {
    colors: {
      text: "--token-ink-primary",
      accent: "--token-color-accent-1-fill",
      muted: "--token-ink-muted"
    },
    fontFamily: "IBM Plex Sans"
  },
  styles: {
    defaultKey: "body",
    styles: {
      title: { name: "Title", fontSize: 44, bold: true, color: "--token-ink-primary" },
      body: { name: "Body", fontSize: 20, color: "--token-ink-secondary" }
    }
  },
  layouts: [],
  sections: [],
  slides: [{ id: mint("s"), notes: [], elements: [] }]
});
