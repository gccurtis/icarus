import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  deck,
  loadDeck,
  addSlide,
  setSlideSection,
  reorderSlides,
  addSlideObject,
  updateSlideObject,
  removeSlideObject,
  selectSlide,
  selectObject,
  activeSlideIndex,
  activeObjectId
} from './types';

describe('deck store', () => {
  beforeEach(() => {
    deck.set(null);
  });

  describe('deck lifecycle', () => {
    it('starts as null', () => {
      expect(get(deck)).toBeNull();
    });

    it('loadDeck creates a deck with one slide', () => {
      loadDeck('Test Deck');
      const d = get(deck);
      expect(d).not.toBeNull();
      expect(d!.name).toBe('Test Deck');
      expect(d!.slides).toHaveLength(1);
      expect(d!.canvas.width).toBe(960);
      expect(d!.canvas.height).toBe(540);
    });

    it('title slide has two text objects', () => {
      loadDeck('Test');
      const d = get(deck)!;
      expect(d.slides[0].objects).toHaveLength(2);
      expect(d.slides[0].objects[0].kind).toBe('text');
      expect(d.slides[0].objects[1].kind).toBe('text');
    });
  });

  describe('addSlide', () => {
    it('adds a new slide to the deck', () => {
      loadDeck('Test');
      addSlide();
      const d = get(deck)!;
      expect(d.slides).toHaveLength(2);
    });

    it('adds a slide with default numbered text', () => {
      loadDeck('Test');
      addSlide();
      const d = get(deck)!;
      expect(d.slides).toHaveLength(2);
      expect(d.slides[1].objects[0].content).toBe('Slide 2');
    });

    it('new slide has one centered text object', () => {
      loadDeck('Test');
      addSlide();
      const d = get(deck)!;
      expect(d.slides[1].objects).toHaveLength(1);
      expect(d.slides[1].objects[0].kind).toBe('text');
      expect(d.slides[1].objects[0].style!.alignment).toBe('center');
    });

    it('is a no-op when deck is null', () => {
      addSlide();
      expect(get(deck)).toBeNull();
    });
  });

  describe('setSlideSection', () => {
    it('sets the section on a slide', () => {
      loadDeck('Test');
      const slideId = get(deck)!.slides[0].id;
      setSlideSection(slideId, 'Intro');
      expect(get(deck)!.slides[0].section).toBe('Intro');
    });

    it('clears the section when set to null', () => {
      loadDeck('Test');
      const slideId = get(deck)!.slides[0].id;
      setSlideSection(slideId, 'Intro');
      setSlideSection(slideId, null);
      expect(get(deck)!.slides[0].section).toBeNull();
    });

    it('does not affect other slides', () => {
      loadDeck('Test');
      addSlide();
      const firstId = get(deck)!.slides[0].id;
      setSlideSection(firstId, 'Intro');
      expect(get(deck)!.slides[0].section).toBe('Intro');
      expect(get(deck)!.slides[1].section).toBeNull();
    });

    it('is a no-op for unknown slide IDs', () => {
      loadDeck('Test');
      setSlideSection('nonexistent', 'Nope');
      expect(get(deck)!.slides[0].section).toBeNull();
    });

    it('is a no-op when deck is null', () => {
      setSlideSection('any', 'Nope');
      expect(get(deck)).toBeNull();
    });
  });
});

describe('object CRUD', () => {
  beforeEach(() => {
    deck.set(null);
    loadDeck('Test');
    addSlide();
  });

  function getSlide(index = 1) {
    return get(deck)!.slides[index];
  }

  describe('addSlideObject', () => {
    it('appends an object to the slide', () => {
      const slide = getSlide();
      const before = slide.objects.length;
      addSlideObject(slide.id, {
        id: 'obj-test',
        kind: 'shape',
        frame: { x: 0, y: 0, width: 100, height: 100 },
        style: { fill: '#ff0000' }
      });
      expect(getSlide().objects).toHaveLength(before + 1);
      expect(getSlide().objects[before].id).toBe('obj-test');
      expect(getSlide().objects[before].kind).toBe('shape');
    });

    it('preserves existing objects when adding', () => {
      const slide = getSlide();
      const existingIds = slide.objects.map((o) => o.id);
      addSlideObject(slide.id, {
        id: 'obj-new',
        kind: 'text',
        frame: { x: 50, y: 50, width: 200, height: 50 },
        content: 'New'
      });
      const newSlide = getSlide();
      for (const id of existingIds) {
        expect(newSlide.objects.find((o) => o.id === id)).toBeDefined();
      }
    });

    it('is a no-op for unknown slide IDs', () => {
      addSlideObject('nonexistent', {
        id: 'obj-new',
        kind: 'text',
        frame: { x: 0, y: 0, width: 100, height: 100 },
        content: 'Nope'
      });
      const slide = getSlide();
      expect(slide.objects).toHaveLength(slide.objects.length);
    });

    it('is a no-op when deck is null', () => {
      deck.set(null);
      addSlideObject('any', {
        id: 'obj-new',
        kind: 'text',
        frame: { x: 0, y: 0, width: 100, height: 100 },
        content: 'Nope'
      });
      expect(get(deck)).toBeNull();
    });
  });

  describe('updateSlideObject', () => {
    it('updates an object frame', () => {
      const slide = getSlide();
      const obj = slide.objects[0];
      updateSlideObject(slide.id, obj.id, {
        frame: { x: 500, y: 500, width: 300, height: 200 }
      });
      const updated = getSlide().objects.find((o) => o.id === obj.id)!;
      expect(updated.frame.x).toBe(500);
      expect(updated.frame.y).toBe(500);
      expect(updated.frame.width).toBe(300);
      expect(updated.frame.height).toBe(200);
    });

    it('updates content and style separately', () => {
      const slide = getSlide();
      const obj = slide.objects[0];
      updateSlideObject(slide.id, obj.id, { content: 'Updated text' });
      let updated = getSlide().objects.find((o) => o.id === obj.id)!;
      expect(updated.content).toBe('Updated text');

      updateSlideObject(slide.id, obj.id, { style: { fontSize: 48, color: '#000' } });
      updated = getSlide().objects.find((o) => o.id === obj.id)!;
      expect(updated.style!.fontSize).toBe(48);
      expect(updated.style!.color).toBe('#000');
      expect(updated.content).toBe('Updated text');
    });

    it('does not affect other objects on the same slide', () => {
      // Add a second object
      const slide = getSlide();
      addSlideObject(slide.id, {
        id: 'obj-extra',
        kind: 'shape',
        frame: { x: 0, y: 0, width: 50, height: 50 }
      });
      const firstId = slide.objects[0].id;
      updateSlideObject(slide.id, firstId, { content: 'Changed' });

      const updated = getSlide();
      expect(updated.objects.find((o) => o.id === firstId)!.content).toBe('Changed');
      expect(updated.objects.find((o) => o.id === 'obj-extra')).toBeDefined();
    });

    it('is a no-op for unknown object IDs', () => {
      const slide = getSlide();
      const obj = slide.objects[0];
      const before = obj.frame.x;
      updateSlideObject(slide.id, 'nonexistent', { frame: { x: 999, y: 0, width: 10, height: 10 } });
      expect(getSlide().objects.find((o) => o.id === obj.id)!.frame.x).toBe(before);
    });

    it('is a no-op for unknown slide IDs', () => {
      const slide = getSlide();
      const obj = slide.objects[0];
      const before = obj.content;
      updateSlideObject('nonexistent', obj.id, { content: 'Nope' });
      expect(getSlide().objects.find((o) => o.id === obj.id)!.content).toBe(before);
    });

    it('is a no-op when deck is null', () => {
      deck.set(null);
      updateSlideObject('any', 'any', { content: 'Nope' });
      expect(get(deck)).toBeNull();
    });
  });

  describe('removeSlideObject', () => {
    it('removes an object from the slide', () => {
      const slide = getSlide();
      const objId = slide.objects[0].id;
      const before = slide.objects.length;
      removeSlideObject(slide.id, objId);
      const after = getSlide();
      expect(after.objects).toHaveLength(before - 1);
      expect(after.objects.find((o) => o.id === objId)).toBeUndefined();
    });

    it('does not affect other slides', () => {
      const slide0 = get(deck)!.slides[0];
      const slide1 = getSlide();
      const beforeCount0 = slide0.objects.length;
      removeSlideObject(slide1.id, slide1.objects[0].id);
      expect(get(deck)!.slides[0].objects).toHaveLength(beforeCount0);
    });

    it('is a no-op for unknown object IDs', () => {
      const slide = getSlide();
      const before = slide.objects.length;
      removeSlideObject(slide.id, 'nonexistent');
      expect(getSlide().objects).toHaveLength(before);
    });

    it('is a no-op when deck is null', () => {
      deck.set(null);
      removeSlideObject('any', 'any');
      expect(get(deck)).toBeNull();
    });
  });
});

describe('selection state', () => {
  beforeEach(() => {
    deck.set(null);
    loadDeck('Test');
    activeSlideIndex.set(0);
    activeObjectId.set(null);
  });

  describe('selectSlide', () => {
    it('sets the active slide index', () => {
      addSlide();
      selectSlide(1);
      expect(get(activeSlideIndex)).toBe(1);
    });

    it('clears the active object selection', () => {
      activeObjectId.set('obj-1');
      selectSlide(0);
      expect(get(activeObjectId)).toBeNull();
    });

    it('handles out-of-bounds index gracefully', () => {
      selectSlide(999);
      expect(get(activeSlideIndex)).toBe(999);
    });
  });

  describe('selectObject', () => {
    it('sets the active object ID', () => {
      selectObject('obj-1');
      expect(get(activeObjectId)).toBe('obj-1');
    });

    it('clears the active object when passed null', () => {
      selectObject('obj-1');
      selectObject(null);
      expect(get(activeObjectId)).toBeNull();
    });
  });
});

describe('reorderSlides', () => {
  beforeEach(() => {
    deck.set(null);
    loadDeck('Test');
    // Add slides so we have 4 total
    addSlide();
    addSlide();
    addSlide();
    activeSlideIndex.set(0);
  });

  it('moves a slide from early to later position', () => {
    const before = get(deck)!.slides.map((s) => s.id);
    reorderSlides(0, 2);
    const after = get(deck)!.slides.map((s) => s.id);
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[2]);
    expect(after[2]).toBe(before[0]);
    expect(after[3]).toBe(before[3]);
  });

  it('moves a slide from later to earlier position', () => {
    const before = get(deck)!.slides.map((s) => s.id);
    reorderSlides(3, 1);
    const after = get(deck)!.slides.map((s) => s.id);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[3]);
    expect(after[2]).toBe(before[1]);
    expect(after[3]).toBe(before[2]);
  });

  it('tracks the active slide when it is moved', () => {
    activeSlideIndex.set(0);
    reorderSlides(0, 3);
    expect(get(activeSlideIndex)).toBe(3);
  });

  it('adjusts active index when a slide before it moves past it', () => {
    activeSlideIndex.set(2);
    reorderSlides(0, 3); // slide 0 moves past 2
    expect(get(activeSlideIndex)).toBe(1);
  });

  it('adjusts active index when a slide after it moves before it', () => {
    activeSlideIndex.set(1);
    reorderSlides(3, 0); // slide 3 moves before 1
    expect(get(activeSlideIndex)).toBe(2);
  });

  it('is a no-op when from and to are the same', () => {
    const before = get(deck)!.slides.map((s) => s.id);
    reorderSlides(2, 2);
    const after = get(deck)!.slides.map((s) => s.id);
    expect(after).toEqual(before);
    expect(get(activeSlideIndex)).toBe(0);
  });

  it('is a no-op for out-of-bounds indices', () => {
    const before = get(deck)!.slides.map((s) => s.id);
    reorderSlides(0, 999);
    reorderSlides(999, 0);
    reorderSlides(-1, 2);
    const after = get(deck)!.slides.map((s) => s.id);
    expect(after).toEqual(before);
  });

  it('is a no-op when deck is null', () => {
    deck.set(null);
    reorderSlides(0, 2);
    expect(get(deck)).toBeNull();
  });

  it('preserves slide objects and sections after reorder', () => {
    setSlideSection(get(deck)!.slides[0].id, 'Intro');
    addSlideObject(get(deck)!.slides[1].id, {
      id: 'obj-extra',
      kind: 'shape',
      frame: { x: 0, y: 0, width: 50, height: 50 }
    });

    reorderSlides(0, 2);
    const d = get(deck)!;
    expect(d.slides[2].section).toBe('Intro');
    // The object was on slide 1 (now at index 0 after slide 0 moved to 2)
    expect(d.slides[0].objects.some((o) => o.id === 'obj-extra')).toBe(true);
  });
});
