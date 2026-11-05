import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { CHAPTERS, PARTS } from '../../src/tutorial/chapters';
import { EXAMPLES } from '../../src/tutorial/examples';

describe('tutorial chapters', () => {
  for (const c of CHAPTERS) {
    it(`${c.id} compiles without errors`, () => {
      const r = compile(c.script);
      expect(r.errors).toEqual([]);
      expect(r.timeline!.steps.length).toBeGreaterThan(0);
    });
  }
  it('chapters run part by part, in order', () => {
    const parts = CHAPTERS.map((c) => c.part);
    expect(parts).toEqual([...parts].sort((a, b) => a - b));
    for (const p of PARTS) expect(parts).toContain(p.id);
  });
  it('ids are unique across chapters and examples', () => {
    const ids = [...CHAPTERS, ...EXAMPLES].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('examples', () => {
  for (const e of EXAMPLES) {
    it(`${e.id} compiles without errors`, () => {
      const r = compile(e.script);
      expect(r.errors).toEqual([]);
      expect(r.timeline!.steps.length).toBeGreaterThan(1);
    });
  }
});
