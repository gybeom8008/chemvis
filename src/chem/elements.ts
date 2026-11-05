/**
 * Element data. Colours follow the CPK/Jmol convention used by most molecular
 * model kits and textbooks, toned down slightly so text stays readable.
 */
export interface ElementInfo {
  symbol: string;
  name: string;
  /** Valence (outer-shell) electrons of the neutral atom. */
  valence: number;
  /** Max electrons around the atom before we report an error (H: 2, period 2: 8). */
  maxElectrons: number;
  /** Electrons allowed with a warning only (expanded octet, period 3+). */
  softMax: number;
  color: string;
  /** Text colour drawn on top of the atom. */
  ink: string;
  /** Drawing radius in world units. */
  r: number;
}

const E = (
  symbol: string,
  name: string,
  valence: number,
  period: number,
  color: string,
  ink: string,
  r: number,
): ElementInfo => ({
  symbol,
  name,
  valence,
  maxElectrons: period === 1 ? 2 : period === 2 ? 8 : 8,
  softMax: period >= 3 ? 12 : period === 1 ? 2 : 8,
  color,
  ink,
  r,
});

export const ELEMENTS: Record<string, ElementInfo> = {
  H: E('H', '수소', 1, 1, '#f4f4f4', '#333', 9),
  He: E('He', '헬륨', 2, 1, '#d9ffff', '#333', 9),
  Li: E('Li', '리튬', 1, 2, '#c58cf0', '#fff', 14),
  C: E('C', '탄소', 4, 2, '#5f6368', '#fff', 13),
  N: E('N', '질소', 5, 2, '#3b5bdb', '#fff', 13),
  O: E('O', '산소', 6, 2, '#e03131', '#fff', 13),
  F: E('F', '플루오린', 7, 2, '#74b816', '#fff', 12),
  Na: E('Na', '나트륨', 1, 3, '#9b5de5', '#fff', 15),
  Mg: E('Mg', '마그네슘', 2, 3, '#66a80f', '#fff', 14),
  Al: E('Al', '알루미늄', 3, 3, '#a79c9c', '#fff', 14),
  Si: E('Si', '규소', 4, 3, '#d4a373', '#222', 14),
  P: E('P', '인', 5, 3, '#f08c00', '#fff', 14),
  S: E('S', '황', 6, 3, '#e6c700', '#222', 14),
  Cl: E('Cl', '염소', 7, 3, '#2f9e44', '#fff', 15),
  K: E('K', '칼륨', 1, 4, '#7e3fbf', '#fff', 17),
  Ca: E('Ca', '칼슘', 2, 4, '#37b24d', '#fff', 16),
  Br: E('Br', '브로민', 7, 4, '#a12b2b', '#fff', 16),
  I: E('I', '아이오딘', 7, 5, '#862e9c', '#fff', 17),
  // Metals: only the outer electrons that take part in the reactions shown here are counted
  // (Zn 4s², Cu → Cu²⁺ uses two, Ag → Ag⁺ uses one).
  Zn: E('Zn', '아연', 2, 4, '#7d80b0', '#fff', 15),
  Cu: E('Cu', '구리', 2, 4, '#c88033', '#fff', 15),
  Ag: E('Ag', '은', 1, 5, '#b8b8b8', '#222', 16),
};

/** Pauling electronegativity, for oxidation states. */
export const ELECTRONEGATIVITY: Record<string, number> = {
  H: 2.2,
  Li: 0.98,
  C: 2.55,
  N: 3.04,
  O: 3.44,
  F: 3.98,
  Na: 0.93,
  Mg: 1.31,
  Al: 1.61,
  Si: 1.9,
  P: 2.19,
  S: 2.58,
  Cl: 3.16,
  K: 0.82,
  Ca: 1.0,
  Br: 2.96,
  I: 2.66,
  Zn: 1.65,
  Cu: 1.9,
  Ag: 1.93,
};

export function element(symbol: string): ElementInfo {
  const e = ELEMENTS[symbol];
  if (!e) throw new Error(`모르는 원소 기호: ${symbol}`);
  return e;
}

/** Ideal drawn bond length between two atoms. */
export function bondLength(a: string, b: string, order = 1): number {
  const base = 12 + element(a).r + element(b).r;
  return order >= 2 ? base * 0.9 : base;
}
