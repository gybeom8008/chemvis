import { element } from './elements';
import { parseSmiles } from './smiles';

/**
 * Molecules the script can name directly. Only topology is stored (atoms,
 * lone pairs, bonds); the 2D drawing is computed by geometry.ts, so adding a
 * molecule never needs hand-made coordinates.
 */
export interface MolAtomDef {
  label: string;
  el: string;
  lp: number;
  rad?: number;
}

export interface MolDef {
  formula: string;
  name: string;
  atoms: MolAtomDef[];
  /** [atom index, atom index, bond order] */
  bonds: [number, number, number][];
}

const a = (label: string, el: string, lp = 0, rad = 0): MolAtomDef => ({ label, el, lp, rad });

function hydride(formula: string, name: string, center: string, lp: number, nH: number): MolDef {
  const atoms = [a(center, center, lp)];
  const bonds: [number, number, number][] = [];
  for (let i = 1; i <= nH; i++) {
    atoms.push(a(nH === 1 ? 'H' : `H${i}`, 'H'));
    bonds.push([0, i, 1]);
  }
  return { formula, name, atoms, bonds };
}

function ion(formula: string, name: string, el: string, lp: number): MolDef {
  return { formula, name, atoms: [a(el, el, lp)], bonds: [] };
}

function diatomic(formula: string, name: string, el: string, lp: number, order: number): MolDef {
  return { formula, name, atoms: [a(`${el}1`, el, lp), a(`${el}2`, el, lp)], bonds: [[0, 1, order]] };
}

const DEFS: MolDef[] = [
  hydride('H2O', '물', 'O', 2, 2),
  hydride('H3O+', '하이드로늄 이온', 'O', 1, 3),
  hydride('OH-', '수산화 이온', 'O', 3, 1),
  hydride('NH3', '암모니아', 'N', 1, 3),
  hydride('NH4+', '암모늄 이온', 'N', 0, 4),
  hydride('CH4', '메테인', 'C', 0, 4),
  hydride('HCl', '염화수소', 'Cl', 3, 1),
  hydride('HF', '플루오린화수소', 'F', 3, 1),
  hydride('HBr', '브로민화수소', 'Br', 3, 1),
  hydride('H2S', '황화수소', 'S', 2, 2),
  ion('H+', '수소 이온', 'H', 0),
  ion('Li+', '리튬 이온', 'Li', 0),
  ion('Na+', '나트륨 이온', 'Na', 0),
  ion('K+', '칼륨 이온', 'K', 0),
  ion('Mg2+', '마그네슘 이온', 'Mg', 0),
  ion('Ca2+', '칼슘 이온', 'Ca', 0),
  ion('Al3+', '알루미늄 이온', 'Al', 0),
  ion('F-', '플루오린화 이온', 'F', 4),
  ion('Cl-', '염화 이온', 'Cl', 4),
  ion('Br-', '브로민화 이온', 'Br', 4),
  ion('I-', '아이오딘화 이온', 'I', 4),
  diatomic('H2', '수소 분자', 'H', 0, 1),
  diatomic('O2', '산소 분자', 'O', 2, 2),
  diatomic('N2', '질소 분자', 'N', 1, 3),
  diatomic('Cl2', '염소 분자', 'Cl', 3, 1),
  diatomic('Br2', '브로민 분자', 'Br', 3, 1),
  diatomic('I2', '아이오딘 분자', 'I', 3, 1),
  diatomic('F2', '플루오린 분자', 'F', 3, 1),
  hydride('HI', '아이오딘화수소', 'I', 3, 1),
  {
    formula: 'CO2',
    name: '이산화탄소',
    atoms: [a('C', 'C'), a('O1', 'O', 2), a('O2', 'O', 2)],
    bonds: [
      [0, 1, 2],
      [0, 2, 2],
    ],
  },
  // Radicals: an unpaired electron is written with "·" (also accepted: "." or "*").
  { formula: 'H·', name: '수소 라디칼', atoms: [a('H', 'H', 0, 1)], bonds: [] },
  { formula: 'Cl·', name: '염소 라디칼', atoms: [a('Cl', 'Cl', 3, 1)], bonds: [] },
  { formula: 'Br·', name: '브로민 라디칼', atoms: [a('Br', 'Br', 3, 1)], bonds: [] },
  { formula: 'OH·', name: '하이드록실 라디칼', atoms: [a('O', 'O', 2, 1), a('H', 'H')], bonds: [[0, 1, 1]] },
  {
    formula: 'CH3·',
    name: '메틸 라디칼',
    atoms: [a('C', 'C', 0, 1), a('H1', 'H'), a('H2', 'H'), a('H3', 'H')],
    bonds: [
      [0, 1, 1],
      [0, 2, 1],
      [0, 3, 1],
    ],
  },
  // Metal atoms and their ions (outer electrons drawn as dots).
  { formula: 'Na', name: '나트륨 원자', atoms: [a('Na', 'Na', 0, 1)], bonds: [] },
  { formula: 'Zn', name: '아연 원자', atoms: [a('Zn', 'Zn', 1)], bonds: [] },
  ion('Zn2+', '아연 이온', 'Zn', 0),
  { formula: 'Cu', name: '구리 원자', atoms: [a('Cu', 'Cu', 1)], bonds: [] },
  ion('Cu2+', '구리 이온', 'Cu', 0),
  { formula: 'Ag', name: '은 원자', atoms: [a('Ag', 'Ag', 0, 1)], bonds: [] },
  ion('Ag+', '은 이온', 'Ag', 0),
];

/** Larger molecules are defined by SMILES; atom names then follow SMILES order (see smiles.ts). */
const NAMED_SMILES: [string, string, string][] = [
  ['Gly', '글라이신', 'NCC(=O)O'],
  ['Ala', '알라닌', 'CC(N)C(=O)O'],
  ['CH3OH', '메탄올', 'CO'],
  ['C2H5OH', '에탄올', 'CCO'],
  ['CH3COOH', '아세트산', 'CC(=O)O'],
  ['CH3COO-', '아세트산 이온', 'CC(=O)[O-]'],
  ['CH3Br', '브로모메테인', 'CBr'],
  ['CH3Cl', '클로로메테인', 'CCl'],
  ['C2H4', '에텐', 'C=C'],
  ['C6H6', '벤젠', 'c1ccccc1'],
  ['C6H12O6', '포도당(고리형)', 'OCC1OC(O)C(O)C(O)C1O'],
  ['H2CO3', '탄산', 'OC(=O)O'],
  ['HCO3-', '탄산수소 이온', 'OC(=O)[O-]'],
  ['CO32-', '탄산 이온', '[O-]C(=O)[O-]'],
  ['NO3-', '질산 이온', '[O-][N+](=O)[O-]'],
  ['H3PO4', '인산', 'OP(=O)(O)O'],
  ['H2PO4-', '인산이수소 이온', 'OP(=O)(O)[O-]'],
  ['SO42-', '황산 이온', '[O-]S(=O)(=O)[O-]'],
  ['H2O2', '과산화수소', 'OO'],
];

export const LIBRARY: Map<string, MolDef> = new Map(DEFS.map((d) => [d.formula, d]));
for (const [key, name, smi] of NAMED_SMILES) {
  const def = parseSmiles(smi);
  LIBRARY.set(key, { ...def, formula: key, name });
}

const smilesCache = new Map<string, MolDef>();

/** Accepts a few common spellings, e.g. "Ca++" or "Ca+2" for "Ca2+". */
export function normalizeFormula(f: string): string {
  let s = f.trim().replace('−', '-');
  if (s.startsWith('smiles:')) return s;
  // Radical dot: "Cl." / "Cl*" / "Cl•" → "Cl·"
  s = s.replace(/[.*•]$/, '·');
  const m = s.match(/^(.*?)(\+\+|--|\+(\d)|-(\d))$/);
  if (m) {
    const n = m[2] === '++' || m[2] === '--' ? '2' : m[3] ?? m[4];
    const sign = m[2].startsWith('+') ? '+' : '-';
    s = `${m[1]}${n}${sign}`;
  }
  return s;
}

/**
 * A library molecule by formula/name, or any molecule written as `smiles:...`.
 * Throws SmilesError (with a readable message) for a malformed SMILES.
 */
export function lookupMolecule(f: string): MolDef | undefined {
  if (f.startsWith('smiles:')) {
    const key = f.slice(7);
    if (!smilesCache.has(key)) smilesCache.set(key, parseSmiles(key));
    return smilesCache.get(key);
  }
  return LIBRARY.get(normalizeFormula(f));
}

export function isFormula(word: string): boolean {
  return lookupMolecule(word) !== undefined;
}

/** Net charge of a library molecule (sum of formal charges). */
export function formulaCharge(f: string): number {
  const def = lookupMolecule(f);
  if (!def) return 0;
  const bondSum = def.atoms.map(() => 0);
  for (const [i, j, o] of def.bonds) {
    bondSum[i] += o;
    bondSum[j] += o;
  }
  return def.atoms.reduce((q, at, i) => q + element(at.el).valence - at.lp * 2 - (at.rad ?? 0) - bondSum[i], 0);
}
