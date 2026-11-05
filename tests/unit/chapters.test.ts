import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { CHAPTERS } from '../../src/tutorial/chapters';

describe('tutorial chapters', () => {
  for (const c of CHAPTERS) {
    it(`${c.id} compiles without errors`, () => {
      const r = compile(c.script);
      expect(r.errors).toEqual([]);
      expect(r.timeline!.steps.length).toBeGreaterThan(0);
    });
  }
});
