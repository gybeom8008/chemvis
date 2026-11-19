/**
 * Chemical formulas written the plain way, as scripts and the engine write them, set the way they
 * are printed: "H3O+" → "H₃O⁺", "Ca2+" → "Ca²⁺", "CO32-" → "CO₃²⁻", "2e-" → "2e⁻".
 * For showing only (captions, titles, labels); the engine keeps the plain spelling.
 */
import { formulaCharge, lookupMolecule } from './library';

const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sub = (d: string): string => [...d].map((c) => SUB[+c]).join('');
const sup = (d: string): string => [...d].map((c) => SUP[+c]).join('');

/** Every element symbol: a run of capitals is a formula only if it reads as one ("ATP" does not). */
const SYMBOLS = new Set(
  (
    'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr ' +
    'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm ' +
    'Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr'
  ).split(' '),
);

/** The parts of a formula's body (no charge), or null if it is not one: "Ca(OH)2" → Ca ( O H ) 2. */
function parts(body: string): string[] | null {
  const out = body.match(/[A-Z][a-z]?|\d+|[()]/g);
  if (!out || out.join('') !== body) return null;
  let depth = 0;
  for (const p of out) {
    if (p === '(') depth++;
    else if (p === ')' && --depth < 0) return null;
    else if (/^[A-Z]/.test(p) && !SYMBOLS.has(p)) return null;
  }
  return depth === 0 ? out : null;
}

const bodyText = (ps: string[]): string => ps.map((p) => (/^\d/.test(p) ? sub(p) : p)).join('');

/**
 * How many of the digits before the sign are the charge. The library knows the ions it has
 * (NH4+ is NH₄⁺, Ca2+ is Ca²⁺); for others, the plain spelling's habit: an ion of one element
 * carries its digits as charge (Fe3+), two digits are a count and a charge (SO42-), and one digit
 * after a group of several elements is a count (NO3-).
 */
function chargeDigits(body: string, ps: string[], sign: '+' | '-'): number {
  const tail = body.match(/\d+$/)?.[0] ?? '';
  if (!tail) return 0;
  try {
    if (lookupMolecule(body + sign)) {
      const q = Math.abs(formulaCharge(body + sign));
      if (q === 1) return 0;
      if (q > 1 && tail.endsWith(String(q))) return String(q).length;
    }
  } catch {
    /* not a library molecule */
  }
  if (tail.length >= 2) return 1;
  const symbols = ps.filter((p) => /^[A-Z]/.test(p));
  return symbols.length === 1 && ps.length === 2 ? tail.length : 0;
}

/** One formula, written plainly: "H2O" → "H₂O", "HCO3-" → "HCO₃⁻". Anything else is returned as it is. */
export function prettyFormula(f: string): string {
  const m = f.match(/^(.*?)([+\-−])?$/)!;
  const body = m[1];
  const sign = m[2] ? (m[2] === '+' ? '+' : '-') : null;
  const ps = parts(body);
  if (!ps) return f;
  if (!sign) return bodyText(ps);
  const n = chargeDigits(body, ps, sign);
  const rest = n ? body.slice(0, -n) : body;
  const charge = n ? body.slice(-n) : '';
  return bodyText(parts(rest) ?? ps) + sup(charge) + (sign === '+' ? '⁺' : '⁻');
}

/**
 * A formula in running text: it starts with a capital or a parenthesis, is not part of a longer
 * Latin word, and may end in a charge sign that nothing but a space, a bracket, a mark or a Korean
 * letter follows ("O-H" is a bond, not an ion).
 */
const IN_TEXT = /(?<![A-Za-z])(\(?[A-Z][A-Za-z\d()]*)([+\-−](?![A-Za-z\d]))?(?![A-Za-z\d])/g;

/** Every formula in a sentence set as printed; words, atom letters and bonds ("C=O", "O-H") stay. */
export function prettyText(s: string): string {
  return s
    .replace(IN_TEXT, (m: string, body: string, sign?: string) => {
      if (!/\d/.test(body) && !sign) return m;
      // A bracket that closes after the formula without opening in it ("(탄산칼슘, CaCO3)") is the sentence's.
      let after = '';
      while (body.endsWith(')') && (body.match(/\)/g)!.length > (body.match(/\(/g) ?? []).length)) {
        body = body.slice(0, -1);
        after = ')' + after;
      }
      if (after) return prettyText(body) + after;
      // A bracket that opens before the formula and closes after it ("(HCO3-)") is the sentence's.
      if (body.startsWith('(') && !body.includes(')')) return `(${prettyFormula(body.slice(1) + (sign ?? ''))}`;
      return prettyFormula(body + (sign ?? ''));
    })
    .replace(/(?<![A-Za-z])e-(?![A-Za-z\d])/g, 'e⁻');
}
