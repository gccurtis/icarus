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
