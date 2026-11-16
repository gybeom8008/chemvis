import { describe, expect, it } from 'vitest';
import { compile } from '../../src/engine/compile';
import { formalCharge } from '../../src/engine/world';
import { StageView } from '../../src/render/view';
import { CHAPTERS } from '../../src/tutorial/chapters';

/**
 * Charge that follows the electrons (looks 'cause', 'tangible' and 'reach') must not make charge from
 * nowhere: while pairs change hands, the charges the atoms are lit with add up to what the
 * molecules had before. Checked through the real drawing (StageView.draw), on a stand-in for the SVG.
 */
const node = () => ({ innerHTML: '' });
const fakeSvg = () => {
  const parts: Record<string, { innerHTML: string }> = { '.bg': node(), '.dyn': node() };
  return {
    innerHTML: '',
    dataset: {} as Record<string, string>,
    clientWidth: 0,
    clientHeight: 0,
    setAttribute() {},
    querySelector: (sel: string) => parts[sel],
  } as unknown as SVGSVGElement;
};
const lens = { charge: true, attract: false, numbers: false, oxidation: false, arrows: false };
const scene = (id: string) => CHAPTERS.find((c) => c.id === id)!.script;
// Scenes whose electrons move as pairs that stay on atoms (single electrons in flight are not on any atom).
const scenes = ['acid-hcl', 'base-nh3', 'neutralization', 'substitution', 'addition', 'condensation', 'coordination'];

for (const look of ['cause', 'tangible', 'reach'] as const) {
  describe(`charge that follows the electrons (${look})`, () => {
    it('adds up to the same at every moment of a step', { timeout: 120000 }, () => {
      const worst: string[] = [];
      for (const id of scenes) {
        const tl = compile(scene(id), { tight: true, tangible: look !== 'cause', reach: look === 'reach' }).timeline!;
        const view = new StageView(fakeSvg());
        view.setTimeline(tl);
        tl.steps.forEach((s, k) => {
          const solutes = (w: typeof s.before) => [...w.atoms.values()].filter((a) => !a.crowd).map((a) => a.id).sort().join(' ');
          // A step in which water of the crowd joins in changes what is counted: not a closed sum.
          if (solutes(s.before) !== solutes(s.after) || s.appear.size) return;
          if (s.arrows.some((ar) => ar.kind !== 'pair')) return;
          const total = [...s.before.atoms.values()].filter((a) => !a.crowd).reduce((sum, a) => sum + formalCharge(s.before, a), 0);
          let off = 0;
          let at = 0;
          for (let i = 0; i <= 100; i++) {
            view.draw(k, i / 100, { lens, clock: 0, motion: false, style: 'pairs', look });
            const sum = [...view.lit.values()].reduce((x, y) => x + y, 0);
            if (Math.abs(sum - total) > Math.abs(off)) {
              off = sum - total;
              at = i / 100;
            }
          }
          if (Math.abs(off) > 0.02) worst.push(`${id} step ${k + 1} t ${at}: off by ${off.toFixed(3)}`);
        });
      }
      expect(worst).toEqual([]);
    });
  });
}
