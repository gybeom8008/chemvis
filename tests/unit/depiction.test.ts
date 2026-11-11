import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { neighbors } from '../../src/engine/world';
import { bystanders } from '../../src/render/pairs';
import { CHAPTERS } from '../../src/tutorial/chapters';

const chapter = (id: string) => compile(CHAPTERS.find((c) => c.id === id)!.script).timeline!;
const cross = (o: { x: number; y: number }, p: { x: number; y: number }, q: { x: number; y: number }) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);

describe('condensation: the molecule that comes up brings its H beside the -OH', () => {
  it('the pair that takes the H does not cross the pair that makes the new bond', () => {
    const tl = chapter('condensation');
    const k = tl.steps.findIndex((s) => s.shifts?.length);
    const w = tl.steps[k].before;
    const [make, , take] = tl.steps[k].shifts!;
    // N's pair goes to C; the leaving O's pair goes to one of N's H atoms.
    const N = w.atoms.get(make.src.a)!;
    const C = w.atoms.get(make.dst.b!)!;
    const O = w.atoms.get(take.src.a)!;
    const H = w.atoms.get(take.dst.b!)!;
    expect(neighbors(w, N.id).some((n) => n.id === H.id)).toBe(true);
    // O and H lie on the same side of the line N–C, so O→H does not cross N→C.
    expect(Math.sign(cross(N, C, O))).toBe(Math.sign(cross(N, C, H)));
  });
});

describe('molecules that take no part are drawn without electrons', () => {
  it('the sulfate ions of a cell stand aside; the metals and their ions do not', () => {
    const tl = chapter('cell');
    const aside = bystanders(tl);
    const atoms = [...tl.initial.atoms.values()];
    const sulfur = atoms.filter((a) => a.el === 'S');
    expect(sulfur.length).toBeGreaterThan(0);
    for (const s of sulfur) expect(aside.has(s.id)).toBe(true);
    const moved = new Set(tl.steps.flatMap((s) => s.arrows.map((a) => a.free?.atom ?? a.src?.a)).filter(Boolean) as string[]);
    expect(moved.size).toBeGreaterThan(0);
    for (const id of moved) expect(aside.has(id)).toBe(false);
  });
  it('nothing stands aside in a scene without reactions', () => {
    expect(bystanders(chapter('dissolving')).size).toBe(0);
  });
  it('both molecules of an acid–base reaction keep their electrons', () => {
    const tl = chapter('neutralization');
    const aside = bystanders(tl);
    for (const a of tl.initial.atoms.values()) if (!a.crowd) expect(aside.has(a.id)).toBe(false);
  });
});
