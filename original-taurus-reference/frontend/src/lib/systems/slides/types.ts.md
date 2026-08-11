# src/lib/systems/slides/types.ts — breakdown

Companion to [types.ts](types.ts). The slide-deck domain: the `Deck` / `Slide` /
`SlideObject` shapes, the view-state stores the editor reads, and the (currently
mock-backed) deck store with its slide/object/z-order/selection mutators. Slides is a
front-end mock editor today — there's no Omega deck model yet — so this module owns both
the data and its in-memory operations.

## Object, slide, and deck shapes

### The content model — objects on slides, slides in a deck

```ts
import { writable, get } from 'svelte/store';

export type SlideObjectKind = 'text' | 'shape' | 'image' | 'table' | 'chart' | 'line';

export type SlideObject = {
  id: string;
  kind: SlideObjectKind;
  frame: { x: number; y: number; width: number; height: number; rotation?: number };
  content?: string;
  style?: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    alignment?: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    cornerRadius?: number;
  };
};

export type Slide = {
  id: string;
  objects: SlideObject[];
  section: string | null;
  hidden: boolean;
  backgroundColor?: string;
  notes?: string;
};

export type Deck = {
  id: string;
  name: string;
  canvas: { width: number; height: number };
  slides: Slide[];
};

```

A `SlideObject` is a positioned element on the canvas (`frame` in deck-native coordinates)
with an optional text `content` and a `style` bag covering both text (font/alignment/weight)
and shape (fill/stroke/corner radius) properties. A `Slide` is an ordered list of objects
plus section/hidden/background/notes metadata. A `Deck` is the named set of slides with the
canvas dimensions (default 960×540) the FabricCanvas scales to.

## View-state stores and id helpers

### What slide/object is selected, plus id + default-slide factories

```ts
// View state for the active slide editor — what slide/object is selected.
export const activeSlideIndex = writable<number>(0);
export const activeObjectId = writable<string | null>(null);

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

const defaultSlide = (): Slide => ({
  id: newId('sld'),
  objects: [],
  section: null,
  hidden: false
});

```

`activeSlideIndex`/`activeObjectId` are the editor's selection stores the stage and panels
subscribe to. `newId` mints prefixed short ids; `defaultSlide` is an empty slide.

## Mock deck + load

### The seed deck and the `deck` store

```ts
function createMockDeck(title: string): Deck {
  const titleSlide = defaultSlide();
  titleSlide.objects = [
    {
      id: 'obj_title',
      kind: 'text',
      frame: { x: 100, y: 100, width: 720, height: 120 },
      content: title,
      style: { fontSize: 44, alignment: 'center' }
    },
    {
      id: 'obj_subtitle',
      kind: 'text',
      frame: { x: 100, y: 240, width: 720, height: 60 },
      content: 'Add your first slide to begin building this deck.',
      style: { fontSize: 20, alignment: 'center', color: '#58636d' }
    }
  ];
  return {
    id: newId('dck'),
    name: title,
    canvas: { width: 960, height: 540 },
    slides: [titleSlide]
  };
}

export const deck = writable<Deck | null>(null);

export function loadDeck(title: string): void {
  deck.set(createMockDeck(title));
}

```

`createMockDeck` fabricates a one-slide deck (title + subtitle) since there's no backend.
`deck` is the single source of truth for the editor; `loadDeck` seeds it. When Omega grows a
deck model, `loadDeck` becomes the fetch seam.

## Slide operations

### Add, section, background, notes, reorder, delete, duplicate

```ts
export function addSlide(): void {
  deck.update((d) => {
    if (!d) return d;
    const slide = defaultSlide();
    const current = get(activeSlideIndex);
    const afterIndex = current >= 0 && current < d.slides.length ? current : d.slides.length - 1;
    const num = d.slides.length + 1;
    slide.objects = [
      {
        id: newId('obj'),
        kind: 'text',
        frame: { x: 100, y: 180, width: 720, height: 120 },
        content: `Slide ${num}`,
        style: { fontSize: 32, alignment: 'center' }
      }
    ];
    const slides = [...d.slides];
    slides.splice(afterIndex + 1, 0, slide);
    activeSlideIndex.set(afterIndex + 1);
    return { ...d, slides };
  });
}

export function setSlideSection(slideId: string, section: string | null): void {
  deck.update((d) => {
    if (!d) return d;
    return {
      ...d,
      slides: d.slides.map((s) => (s.id === slideId ? { ...s, section } : s))
    };
  });
}

export function setSlideBackground(slideId: string, backgroundColor: string): void {
  deck.update((d) => {
    if (!d) return d;
    return {
      ...d,
      slides: d.slides.map((s) =>
        s.id === slideId ? { ...s, backgroundColor } : s
      )
    };
  });
}

export function setSlideNotes(slideId: string, notes: string): void {
  deck.update((d) => {
    if (!d) return d;
    return {
      ...d,
      slides: d.slides.map((s) =>
        s.id === slideId ? { ...s, notes } : s
      )
    };
  });
}

export function reorderSlides(fromIndex: number, toIndex: number): void {
  deck.update((d) => {
    if (!d || fromIndex === toIndex) return d;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= d.slides.length || toIndex >= d.slides.length) return d;
    const slides = [...d.slides];
    const [moved] = slides.splice(fromIndex, 1);
    slides.splice(toIndex, 0, moved);
    // Keep the active slide index tracking the moved slide.
    const current = get(activeSlideIndex);
    if (current === fromIndex) {
      activeSlideIndex.set(toIndex);
    } else if (fromIndex < current && toIndex >= current) {
      activeSlideIndex.set(current - 1);
    } else if (fromIndex > current && toIndex <= current) {
      activeSlideIndex.set(current + 1);
    }
    return { ...d, slides };
  });
}

export function deleteSlide(index: number): void {
  deck.update((d) => {
    if (!d) return d;
    if (d.slides.length <= 1) return d; // keep at least one slide
    if (index < 0 || index >= d.slides.length) return d;
    const slides = d.slides.filter((_, i) => i !== index);
    const current = get(activeSlideIndex);
    if (current === index) {
      activeSlideIndex.set(Math.min(current, slides.length - 1));
    } else if (current > index) {
      activeSlideIndex.set(current - 1);
    }
    return { ...d, slides };
  });
}

export function duplicateSlide(index: number): void {
  deck.update((d) => {
    if (!d) return d;
    if (index < 0 || index >= d.slides.length) return d;
    const source = d.slides[index];
    const copy: Slide = {
      id: newId('sld'),
      objects: source.objects.map((obj) => ({ ...obj, id: newId('obj') })),
      section: source.section,
      hidden: false,
      backgroundColor: source.backgroundColor,
      notes: source.notes
    };
    const slides = [...d.slides];
    slides.splice(index + 1, 0, copy);
    activeSlideIndex.set(index + 1);
    return { ...d, slides };
  });
}

```

Each mutator is an immutable `deck.update` producing a new deck. `addSlide` inserts a seeded
slide after the active one; `reorderSlides`/`deleteSlide`/`duplicateSlide` keep
`activeSlideIndex` tracking the right slide across the reorder/removal; `deleteSlide` keeps at
least one slide; `duplicateSlide` deep-copies objects with fresh ids. Section/background/notes
are simple field sets.

## Object operations

### Object CRUD

```ts
// --- object CRUD ------------------------------------------------------------

export function addSlideObject(slideId: string, object: SlideObject): void {
  deck.update((d) => {
    if (!d) return d;
    return {
      ...d,
      slides: d.slides.map((s) =>
        s.id === slideId ? { ...s, objects: [...s.objects, object] } : s
      )
    };
  });
}

export function updateSlideObject(
  slideId: string,
  objectId: string,
  patch: Partial<Pick<SlideObject, 'frame' | 'content' | 'style'>>
): void {
  deck.update((d) => {
    if (!d) return d;
    return {
      ...d,
      slides: d.slides.map((s) =>
        s.id === slideId
          ? {
              ...s,
              objects: s.objects.map((obj) =>
                obj.id === objectId ? { ...obj, ...patch } : obj
              )
            }
          : s
      )
    };
  });
}

export function removeSlideObject(slideId: string, objectId: string): void {
  deck.update((d) => {
    if (!d) return d;
    return {
      ...d,
      slides: d.slides.map((s) =>
        s.id === slideId
          ? { ...s, objects: s.objects.filter((obj) => obj.id !== objectId) }
          : s
      )
    };
  });
}

```

Add/patch/remove an object within a slide. `updateSlideObject` accepts a partial patch over
`frame`/`content`/`style` — the FabricCanvas calls it on drag/resize and the property panels
on style edits.

## Z-order and selection

### Reorder within the object stack, and set selection

```ts
// --- z-order ----------------------------------------------------------------

export function bringForward(slideId: string, objectId: string): void {
  deck.update((d) => {
    if (!d) return d;
    return {
      ...d,
      slides: d.slides.map((s) => {
        if (s.id !== slideId) return s;
        const idx = s.objects.findIndex((o) => o.id === objectId);
        if (idx < 0 || idx >= s.objects.length - 1) return s;
        const objects = [...s.objects];
        [objects[idx], objects[idx + 1]] = [objects[idx + 1], objects[idx]];
        return { ...s, objects };
      })
    };
  });
}

export function sendBackward(slideId: string, objectId: string): void {
  deck.update((d) => {
    if (!d) return d;
    return {
      ...d,
      slides: d.slides.map((s) => {
        if (s.id !== slideId) return s;
        const idx = s.objects.findIndex((o) => o.id === objectId);
        if (idx <= 0) return s;
        const objects = [...s.objects];
        [objects[idx], objects[idx - 1]] = [objects[idx - 1], objects[idx]];
        return { ...s, objects };
      })
    };
  });
}

export function bringToFront(slideId: string, objectId: string): void {
  deck.update((d) => {
    if (!d) return d;
    return {
      ...d,
      slides: d.slides.map((s) => {
        if (s.id !== slideId) return s;
        const idx = s.objects.findIndex((o) => o.id === objectId);
        if (idx < 0 || idx >= s.objects.length - 1) return s;
        const objects = s.objects.filter((o) => o.id !== objectId);
        objects.push(s.objects[idx]);
        return { ...s, objects };
      })
    };
  });
}

export function sendToBack(slideId: string, objectId: string): void {
  deck.update((d) => {
    if (!d) return d;
    return {
      ...d,
      slides: d.slides.map((s) => {
        if (s.id !== slideId) return s;
        const idx = s.objects.findIndex((o) => o.id === objectId);
        if (idx <= 0) return s;
        const objects = s.objects.filter((o) => o.id !== objectId);
        objects.unshift(s.objects[idx]);
        return { ...s, objects };
      })
    };
  });
}

// --- selection --------------------------------------------------------------

export function selectSlide(index: number): void {
  activeSlideIndex.set(index);
  activeObjectId.set(null);
}

export function selectObject(objectId: string | null): void {
  activeObjectId.set(objectId);
}
```

Object order in the array *is* the z-order (later = on top). The four z-order helpers swap or
splice the object within its slide's array. `selectSlide` moves to a slide and clears any
object selection; `selectObject` sets the active object (null deselects).
