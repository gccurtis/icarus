import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  deck,
  loadDeck,
  addSlide,
  addSlideObject,
  updateSlideObject,
  removeSlideObject,
  selectSlide,
  selectObject,
  deleteSlide,
  reorderSlides,
  bringForward,
  sendBackward,
  bringToFront,
  sendToBack,
  duplicateSlide,
  setSlideBackground,
  setSlideNotes,
  activeSlideIndex,
  activeObjectId
} from '$systems/slides';

describe('slide editor integration', () => {
  beforeEach(() => {
    deck.set(null);
    activeSlideIndex.set(0);
    activeObjectId.set(null);
  });

  describe('adding objects while canvas is synced', () => {
    it('addSlideObject appends and preserves order', () => {
      loadDeck('Test');
      addSlide();
      const slide = get(deck)!.slides[1];

      addSlideObject(slide.id, { id: 'a', kind: 'shape', frame: { x: 0, y: 0, width: 100, height: 100 } });
      addSlideObject(slide.id, { id: 'b', kind: 'text', frame: { x: 50, y: 50, width: 200, height: 50 }, content: 'Hello' });
      addSlideObject(slide.id, { id: 'c', kind: 'shape', frame: { x: 100, y: 100, width: 50, height: 50 } });

      const updated = get(deck)!.slides[1].objects;
      expect(updated).toHaveLength(4); // 1 default + 3 added
      expect(updated[1].id).toBe('a');
      expect(updated[2].id).toBe('b');
      expect(updated[3].id).toBe('c');
    });

    it('updateSlideObject modifies only the target', () => {
      loadDeck('Test');
      addSlide();
      const slide = get(deck)!.slides[1];
      const objId = slide.objects[0].id;

      updateSlideObject(slide.id, objId, { content: 'Changed' });
      const updated = get(deck)!.slides[1].objects[0];
      expect(updated.content).toBe('Changed');
    });

    it('removeSlideObject removes only the target object', () => {
      loadDeck('Test');
      addSlide();
      const slide = get(deck)!.slides[1];
      expect(slide.objects).toHaveLength(1);

      addSlideObject(slide.id, { id: 'extra', kind: 'shape', frame: { x: 0, y: 0, width: 100, height: 100 } });
      expect(get(deck)!.slides[1].objects).toHaveLength(2);

      removeSlideObject(slide.id, 'extra');
      expect(get(deck)!.slides[1].objects).toHaveLength(1);
      expect(get(deck)!.slides[1].objects[0].id).toBe(slide.objects[0].id);
    });
  });

  describe('selection during slide switches', () => {
    it('selectSlide clears object selection', () => {
      loadDeck('Test');
      addSlide();
      selectObject('obj-1');
      expect(get(activeObjectId)).toBe('obj-1');

      selectSlide(1);
      expect(get(activeSlideIndex)).toBe(1);
      expect(get(activeObjectId)).toBeNull();
    });

    it('selectObject sets and clears selection', () => {
      loadDeck('Test');
      selectObject('obj-x');
      expect(get(activeObjectId)).toBe('obj-x');

      selectObject(null);
      expect(get(activeObjectId)).toBeNull();
    });
  });

  describe('object frame updates preserve other properties', () => {
    it('updating frame does not clear content or style', () => {
      loadDeck('Test');
      const slide = get(deck)!.slides[0];
      const obj = slide.objects[0];

      updateSlideObject(slide.id, obj.id, { frame: { x: 500, y: 500, width: 300, height: 200 } });
      const updated = get(deck)!.slides[0].objects[0];
      expect(updated.frame.x).toBe(500);
      expect(updated.content).toBe(obj.content); // preserved
      expect(updated.style).toEqual(obj.style); // preserved
    });

    it('updating content does not clear frame or style', () => {
      loadDeck('Test');
      const slide = get(deck)!.slides[0];
      const obj = slide.objects[0];

      updateSlideObject(slide.id, obj.id, { content: 'New text' });
      const updated = get(deck)!.slides[0].objects[0];
      expect(updated.content).toBe('New text');
      expect(updated.frame).toEqual(obj.frame);
      expect(updated.style).toEqual(obj.style);
    });
  });

  describe('slide lifecycle through the store', () => {
    it('creates a deck with title slide, adds slides with sections, selects', () => {
      loadDeck('My Deck');
      expect(get(deck)!.slides).toHaveLength(1);

      addSlide();
      addSlide();
      addSlide();
      expect(get(deck)!.slides).toHaveLength(4);
    });

    it('each new slide gets a default centered text object', () => {
      loadDeck('Test');
      for (let i = 0; i < 3; i++) addSlide();
      const d = get(deck)!;
      for (const slide of d.slides.slice(1)) {
        expect(slide.objects).toHaveLength(1);
        expect(slide.objects[0].kind).toBe('text');
        expect(slide.objects[0].style!.alignment).toBe('center');
      }
    });
  });

  describe('selection state for inspector sections', () => {
    beforeEach(() => {
      deck.set(null);
      activeSlideIndex.set(0);
      activeObjectId.set(null);
      loadDeck('Inspector Test');
      addSlide();
      addSlide();
      selectSlide(1);
    });

    it('selectObject sets the active object ID', () => {
      selectObject('test-id');
      expect(get(activeObjectId)).toBe('test-id');
    });

    it('selectSlide clears the active object ID', () => {
      selectObject('obj-1');
      selectSlide(2);
      expect(get(activeObjectId)).toBeNull();
      expect(get(activeSlideIndex)).toBe(2);
    });

    it('selected object resolves to null when the object does not exist on the active slide', () => {
      selectObject('nonexistent');
      const d = get(deck)!;
      const slide = d.slides[1];
      const found = slide.objects.find((o) => o.id === 'nonexistent');
      expect(found).toBeUndefined();
      expect(get(activeObjectId)).toBe('nonexistent');
    });

    it('addSlide does not clear the active object ID', () => {
      const slide = get(deck)!.slides[1];
      selectObject(slide.objects[0].id);
      expect(get(activeObjectId)).toBe(slide.objects[0].id);

      addSlide();
      expect(get(activeObjectId)).toBe(slide.objects[0].id);
    });

    it('deleteSlide does not clear activeObjectId but the selected object resolves to null if deleted', () => {
      const slide = get(deck)!.slides[1];
      selectObject(slide.objects[0].id);
      expect(get(activeObjectId)).toBe(slide.objects[0].id);

      deleteSlide(1);

      const newSlide = get(deck)!.slides[1];
      const found = newSlide.objects.find((o) => o.id === slide.objects[0].id);
      expect(found).toBeUndefined();
    });

    it('removing a selected object does not clear activeObjectId', () => {
      const d = get(deck)!;
      const slide = d.slides[1];
      addSlideObject(slide.id, { id: 'to-remove', kind: 'shape', frame: { x: 0, y: 0, width: 50, height: 50 } });
      selectObject('to-remove');
      expect(get(activeObjectId)).toBe('to-remove');

      removeSlideObject(slide.id, 'to-remove');
      expect(get(activeObjectId)).toBe('to-remove');
      const obj = get(deck)!.slides[1].objects.find((o) => o.id === 'to-remove');
      expect(obj).toBeUndefined();
    });

    it('reorderSlides preserves activeObjectId when the slide with selection is not moved', () => {
      selectObject('obj-x');
      reorderSlides(0, 2);
      expect(get(activeObjectId)).toBe('obj-x');
    });

    it('selection state is clean on fresh deck load', () => {
      expect(get(activeSlideIndex)).toBe(1);
      expect(get(activeObjectId)).toBeNull();
    });

    it('re-selecting the same slide clears any stale activeObjectId', () => {
      selectObject('stale');
      selectSlide(1);
      expect(get(activeObjectId)).toBeNull();
    });
  });

  describe('z-order functions', () => {
    beforeEach(() => {
      deck.set(null);
      activeSlideIndex.set(0);
      activeObjectId.set(null);
      loadDeck('Z-Order Test');
      // Slide 0 has 2 pre-existing text objects (obj_title, obj_subtitle) from createMockDeck.
      // Add 4 shape objects with known IDs.
      const d = get(deck)!;
      const slide = d.slides[0];
      addSlideObject(slide.id, { id: 'o1', kind: 'shape', frame: { x: 0, y: 0, width: 50, height: 50 } });
      addSlideObject(slide.id, { id: 'o2', kind: 'shape', frame: { x: 60, y: 0, width: 50, height: 50 } });
      addSlideObject(slide.id, { id: 'o3', kind: 'shape', frame: { x: 120, y: 0, width: 50, height: 50 } });
      addSlideObject(slide.id, { id: 'o4', kind: 'shape', frame: { x: 180, y: 0, width: 50, height: 50 } });
      // Order: obj_title, obj_subtitle, o1, o2, o3, o4
    });

    function objectOrder(): string[] {
      return get(deck)!.slides[0].objects.map((o) => o.id);
    }

    it('bringForward swaps the object with the one after it', () => {
      expect(objectOrder()[2]).toBe('o1');
      expect(objectOrder()[3]).toBe('o2');
      bringForward(get(deck)!.slides[0].id, 'o2');
      expect(objectOrder()[2]).toBe('o1');
      expect(objectOrder()[3]).toBe('o3');
      expect(objectOrder()[4]).toBe('o2');
    });

    it('sendBackward swaps the object with the one before it', () => {
      expect(objectOrder()[3]).toBe('o2');
      sendBackward(get(deck)!.slides[0].id, 'o2');
      expect(objectOrder()[2]).toBe('o2');
      expect(objectOrder()[3]).toBe('o1');
    });

    it('bringToFront moves the object to the end', () => {
      expect(objectOrder()[2]).toBe('o1');
      bringToFront(get(deck)!.slides[0].id, 'o1');
      expect(objectOrder()[objectOrder().length - 1]).toBe('o1');
    });

    it('sendToBack moves the object to the start', () => {
      expect(objectOrder()[objectOrder().length - 1]).toBe('o4');
      sendToBack(get(deck)!.slides[0].id, 'o4');
      expect(objectOrder()[0]).toBe('o4');
    });

    it('bringForward on the last object is a no-op', () => {
      const before = objectOrder();
      bringForward(get(deck)!.slides[0].id, 'o4');
      expect(objectOrder()).toEqual(before);
    });

    it('sendBackward on the first object is a no-op', () => {
      const before = objectOrder();
      sendBackward(get(deck)!.slides[0].id, 'obj_title');
      expect(objectOrder()).toEqual(before);
    });

    it('bringToFront on the last object is a no-op', () => {
      const before = objectOrder();
      bringToFront(get(deck)!.slides[0].id, 'o4');
      expect(objectOrder()).toEqual(before);
    });

    it('sendToBack on the first object is a no-op', () => {
      const before = objectOrder();
      sendToBack(get(deck)!.slides[0].id, 'obj_title');
      expect(objectOrder()).toEqual(before);
    });

    it('z-order operations on a non-existent object ID leave state unchanged', () => {
      const before = objectOrder();
      bringForward(get(deck)!.slides[0].id, 'nope');
      sendBackward(get(deck)!.slides[0].id, 'nope');
      bringToFront(get(deck)!.slides[0].id, 'nope');
      sendToBack(get(deck)!.slides[0].id, 'nope');
      expect(objectOrder()).toEqual(before);
    });

    it('z-order functions are no-ops when deck is null', () => {
      deck.set(null);
      // Should not throw.
      bringForward('any', 'any');
      sendBackward('any', 'any');
      bringToFront('any', 'any');
      sendToBack('any', 'any');
      expect(get(deck)).toBeNull();
    });
  });

  describe('style patches with Phase 3 fields', () => {
    it('updateSlideObject replaces style entirely (shallow merge)', () => {
      loadDeck('Style Test');
      const slide = get(deck)!.slides[0];
      const obj = slide.objects[0];

      // set initial rich style
      updateSlideObject(slide.id, obj.id, {
        style: { fontSize: 36, alignment: 'center', fontFamily: 'plex-sans' }
      });
      const initial = get(deck)!.slides[0].objects[0];
      expect(initial.style!.fontSize).toBe(36);
      expect(initial.style!.alignment).toBe('center');

      // solo patch loses other fields (shallow merge at SlideObject level)
      updateSlideObject(slide.id, obj.id, { style: { fontFamily: 'plex-mono' } });
      const after = get(deck)!.slides[0].objects[0];
      expect(after.style!.fontFamily).toBe('plex-mono');
      expect(after.style!.fontSize).toBeUndefined();
    });

    it('merge before passing to updateSlideObject preserves fields', () => {
      loadDeck('Merge Test');
      const slide = get(deck)!.slides[0];
      const obj = slide.objects[0];

      // Set base style using merge pattern (what inspector panels do)
      const base = { ...obj.style, fontSize: 48, bold: true, italic: true };
      updateSlideObject(slide.id, obj.id, { style: base });

      // Toggle one field while merging current
      const current = get(deck)!.slides[0].objects[0];
      updateSlideObject(slide.id, obj.id, {
        style: { ...current.style, bold: false }
      });
      const after = get(deck)!.slides[0].objects[0];
      expect(after.style!.bold).toBe(false);
      expect(after.style!.italic).toBe(true);
      expect(after.style!.fontSize).toBe(48);
    });

    it('shape fill, stroke, strokeWidth, cornerRadius work via merge', () => {
      loadDeck('Shape Style Test');
      addSlide();
      const slide = get(deck)!.slides[1];
      addSlideObject(slide.id, { id: 'rect', kind: 'shape', frame: { x: 100, y: 100, width: 200, height: 100 } });

      const obj = get(deck)!.slides[1].objects.find((o) => o.id === 'rect')!;
      updateSlideObject(slide.id, 'rect', {
        style: { ...obj.style, fill: '#ff0000', stroke: '#0000ff', strokeWidth: 3 }
      });
      const after = get(deck)!.slides[1].objects.find((o) => o.id === 'rect')!;
      expect(after.style!.fill).toBe('#ff0000');
      expect(after.style!.stroke).toBe('#0000ff');
      expect(after.style!.strokeWidth).toBe(3);

      updateSlideObject(slide.id, 'rect', {
        style: { ...after.style, cornerRadius: 12 }
      });
      const afterCorner = get(deck)!.slides[1].objects.find((o) => o.id === 'rect')!;
      expect(afterCorner.style!.cornerRadius).toBe(12);
      expect(afterCorner.style!.fill).toBe('#ff0000');
      expect(afterCorner.style!.strokeWidth).toBe(3);
    });
  });

  describe('frame merge with rotation', () => {
    it('full frame replacement works', () => {
      loadDeck('Full Frame Test');
      const slide = get(deck)!.slides[0];
      const obj = slide.objects[0];

      updateSlideObject(slide.id, obj.id, {
        frame: { x: 200, y: 150, width: 600, height: 80, rotation: 15 }
      });
      const updated = get(deck)!.slides[0].objects[0];
      expect(updated.frame.x).toBe(200);
      expect(updated.frame.y).toBe(150);
      expect(updated.frame.width).toBe(600);
      expect(updated.frame.height).toBe(80);
      expect(updated.frame.rotation).toBe(15);
    });

    it('merge before passing preserves other frame fields', () => {
      loadDeck('Merge Frame Test');
      const slide = get(deck)!.slides[0];
      const obj = slide.objects[0];

      updateSlideObject(slide.id, obj.id, {
        frame: { ...obj.frame, rotation: 45 }
      });
      const rotated = get(deck)!.slides[0].objects[0];
      expect(rotated.frame.rotation).toBe(45);
      expect(rotated.frame.x).toBe(obj.frame.x);
      expect(rotated.frame.y).toBe(obj.frame.y);

      updateSlideObject(slide.id, obj.id, {
        frame: { ...rotated.frame, x: 300 }
      });
      const moved = get(deck)!.slides[0].objects[0];
      expect(moved.frame.x).toBe(300);
      expect(moved.frame.rotation).toBe(45);
      expect(moved.frame.y).toBe(obj.frame.y);
    });

    it('rotation defaults to undefined when not set', () => {
      loadDeck('No Rotation Test');
      const slide = get(deck)!.slides[0];
      const obj = slide.objects[0];
      expect(obj.frame.rotation).toBeUndefined();
    });
  });

  describe('slide-level properties (Phase 4)', () => {
    it('setSlideBackground updates the slide background', () => {
      loadDeck('BG Test');
      const slide = get(deck)!.slides[0];
      expect(slide.backgroundColor).toBeUndefined();

      setSlideBackground(slide.id, '#ff0000');
      const updated = get(deck)!.slides[0];
      expect(updated.backgroundColor).toBe('#ff0000');
    });

    it('setSlideNotes updates the slide notes', () => {
      loadDeck('Notes Test');
      const slide = get(deck)!.slides[0];
      expect(slide.notes).toBeUndefined();

      setSlideNotes(slide.id, 'These are speaker notes');
      const updated = get(deck)!.slides[0];
      expect(updated.notes).toBe('These are speaker notes');
    });

    it('each slide retains its own background and notes', () => {
      loadDeck('Per-Slide Test');
      addSlide();
      addSlide();
      const d = get(deck)!;
      setSlideBackground(d.slides[0].id, '#202428');
      setSlideNotes(d.slides[0].id, 'Slide 0 notes');
      setSlideBackground(d.slides[1].id, '#ffffff');
      setSlideNotes(d.slides[1].id, 'Slide 1 notes');

      const updated = get(deck)!;
      expect(updated.slides[0].backgroundColor).toBe('#202428');
      expect(updated.slides[0].notes).toBe('Slide 0 notes');
      expect(updated.slides[1].backgroundColor).toBe('#ffffff');
      expect(updated.slides[1].notes).toBe('Slide 1 notes');
      expect(updated.slides[2].backgroundColor).toBeUndefined();
      expect(updated.slides[2].notes).toBeUndefined();
    });

    it('setSlideBackground is a no-op when deck is null', () => {
      deck.set(null);
      setSlideBackground('any', '#000');
      expect(get(deck)).toBeNull();
    });

    it('setSlideNotes is a no-op when deck is null', () => {
      deck.set(null);
      setSlideNotes('any', 'notes');
      expect(get(deck)).toBeNull();
    });

    it('duplicateSlide deep-clones slide with new IDs', () => {
      loadDeck('Duplicate Test');
      addSlide();
      setSlideBackground(get(deck)!.slides[1].id, '#abcdef');
      setSlideNotes(get(deck)!.slides[1].id, 'Original notes');

      duplicateSlide(1);
      const d = get(deck)!;
      const original = d.slides[1];
      const copy = d.slides[2];

      expect(copy.id).not.toBe(original.id);
      expect(copy.objects).toHaveLength(original.objects.length);
      expect(copy.objects[0].id).not.toBe(original.objects[0].id);
      expect(copy.objects[0].kind).toBe(original.objects[0].kind);
      expect(copy.backgroundColor).toBe('#abcdef');
      expect(copy.notes).toBe('Original notes');
      expect(copy.hidden).toBe(false);
      expect(get(activeSlideIndex)).toBe(2);
    });

    it('duplicateSlide is a no-op on out-of-bounds index', () => {
      loadDeck('Dup OOB');
      const before = get(deck)!.slides.length;
      duplicateSlide(-1);
      duplicateSlide(99);
      expect(get(deck)!.slides).toHaveLength(before);
    });

    it('slides start with no background or notes by default', () => {
      loadDeck('Defaults');
      const slide = get(deck)!.slides[0];
      expect(slide.backgroundColor).toBeUndefined();
      expect(slide.notes).toBeUndefined();
    });
  });
});
