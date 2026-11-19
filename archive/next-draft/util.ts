import { element } from '../chem/elements';
import { LIBRARY } from '../chem/library';
import { allComponents, component, componentCharge, formulaOf, type Atom, type World } from '../engine/world';

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SUB = '₀₁₂₃₄₅₆₇₈₉';
/** H3O+ → H₃O⁺, CO32- → CO₃²⁻ (for showing, never for the engine). */
export function pretty(f: string): string {
  const m = f.match(/^(.*?)(\d?)([+-])$/);
  const body = m ? m[1] : f;
  const charge = m ? (m[2] ? '⁰¹²³⁴⁵⁶⁷⁸⁹'[+m[2]] : '') + (m[3] === '+' ? '⁺' : '⁻') : '';
  return body.replace(/(?<=[A-Za-z)])\d+/g, (d) => [...d].map((c) => SUB[+c]).join('')) + charge;
}

/** 을/를, 이/가, 은/는, 과/와 after a Korean word (or a formula read in Korean letters). */
export function josa(word: string, pair: '을를' | '이가' | '은는' | '과와'): string {
  const ch = word.charCodeAt(word.length - 1);
  const hasFinal = ch >= 0xac00 && ch <= 0xd7a3 ? (ch - 0xac00) % 28 !== 0 : /[lmnrLMNR136780]$/.test(word);
  return word + (hasFinal ? pair[0] : pair[1]);
}

/** The molecule or ion an atom belongs to: its atoms, formula and Korean name. */
export function speciesOf(w: World, id: string): { ids: string[]; formula: string; name: string; charge: number } {
  const ids = component(w, id);
  const formula = formulaOf(w, ids);
  const def = LIBRARY.get(formula);
  const single = ids.length === 1 ? w.atoms.get(ids[0])! : null;
  const name = def?.name ?? (single ? `${element(single.el).name} ${single.rad ? '원자' : '이온'}` : formula);
  return { ids, formula, name, charge: componentCharge(w, ids) };
}

/** What to call an atom when the pointer rests on it. */
export function atomTitle(w: World, a: Atom): string {
  const sp = speciesOf(w, a.id);
  if (sp.ids.length === 1) return `${sp.name} ${pretty(sp.formula)}`;
  return `${element(a.el).name} 원자 · ${sp.name} ${pretty(sp.formula)}`;
}

/** Every solute (non-solvent) molecule or ion in the world. */
export function solutes(w: World): string[][] {
  return allComponents(w).filter((c) => {
    const a = w.atoms.get(c[0])!;
    return !a.crowd && !a.gone;
  });
}
