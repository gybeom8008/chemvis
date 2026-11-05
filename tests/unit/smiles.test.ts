import { describe, expect, it } from 'vitest';
import { lookupMolecule, formulaCharge } from '../../src/chem/library';
import { parseSmiles } from '../../src/chem/smiles';
import { compile } from '../../src/engine/compile';
import { allComponents, formulaOf, type World } from '../../src/engine/world';

const labels = (smi: string) => parseSmiles(smi).atoms.map((a) => a.label);
const minDistance = (w: World) => {
  const atoms = [...w.atoms.values()];
  let m = Infinity;
  for (let i = 0; i < atoms.length; i++)
    for (let j = i + 1; j < atoms.length; j++) m = Math.min(m, Math.hypot(atoms[i].x - atoms[j].x, atoms[i].y - atoms[j].y));
  return m;
};

describe('SMILES', () => {
  it('ethanol: atoms named in SMILES order, hydrogens added', () => {
    expect(labels('CCO')).toEqual(['C1', 'C2', 'O', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
    const o = parseSmiles('CCO').atoms.find((a) => a.label === 'O')!;
    expect(o.lp).toBe(2);
  });
  it('charges in brackets', () => {
    expect(formulaCharge('smiles:CC(=O)[O-]')).toBe(-1);
    expect(formulaCharge('smiles:[NH4+]')).toBe(1);
    expect(formulaCharge('smiles:[O-][N+](=O)[O-]')).toBe(-1);
  });
  it('aromatic benzene becomes alternating double bonds', () => {
    const d = parseSmiles('c1ccccc1');
    expect(d.bonds.filter((b) => b[2] === 2).length).toBe(3);
    expect(d.atoms.filter((a) => a.el === 'H').length).toBe(6);
  });
  it('triple bond survives the # comment rule', () => {
    const r = compile('stage solution\nmol x = smiles:C#N\nstep "a"\n  wait\n');
    expect(r.errors).toEqual([]);
    const w = r.timeline!.initial;
    expect(formulaOf(w, allComponents(w)[0])).toBe('CHN');
  });
  it('reports a malformed SMILES on its line', () => {
    const r = compile('stage solution\nmol x = smiles:CC(C\nstep "a"\n  wait\n');
    expect(r.errors[0].line).toBe(2);
    expect(r.errors[0].message).toContain('괄호');
  });
  it('named SMILES molecules: glycine, glucose ring', () => {
    expect(lookupMolecule('Gly')!.atoms.map((a) => a.label).slice(0, 5)).toEqual(['N', 'C1', 'C2', 'O1', 'O2']);
    const r = compile('stage solution\nmol g = C6H12O6 at center\nstep "a"\n  wait\n');
    expect(r.errors).toEqual([]);
    // Ring layout keeps atoms apart.
    expect(minDistance(r.timeline!.initial)).toBeGreaterThan(14);
  });
  it('benzene ring is a regular hexagon', () => {
    const r = compile('stage solution\nmol b = C6H6 at center\nstep "a"\n  wait\n');
    const w = r.timeline!.initial;
    const cs = [...w.atoms.values()].filter((a) => a.el === 'C');
    const cx = cs.reduce((s, a) => s + a.x, 0) / 6;
    const cy = cs.reduce((s, a) => s + a.y, 0) / 6;
    const radii = cs.map((a) => Math.hypot(a.x - cx, a.y - cy));
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.5);
    expect(minDistance(w)).toBeGreaterThan(18);
  });
});
