import { describe, expect, it } from 'vitest';
import { prettyFormula, prettyText } from '../../src/chem/format';

describe('formulas set as printed', () => {
  it('counts become subscripts', () => {
    expect(prettyFormula('H2O')).toBe('H₂O');
    expect(prettyFormula('C6H12O6')).toBe('C₆H₁₂O₆');
    expect(prettyFormula('Ca(OH)2')).toBe('Ca(OH)₂');
    expect(prettyFormula('NaCl')).toBe('NaCl');
  });

  it('a charge is told from a count the way chemists write it', () => {
    // Ions the library knows: their charge decides.
    expect(prettyFormula('Ca2+')).toBe('Ca²⁺');
    expect(prettyFormula('NH4+')).toBe('NH₄⁺');
    expect(prettyFormula('H3O+')).toBe('H₃O⁺');
    expect(prettyFormula('HCO3-')).toBe('HCO₃⁻');
    expect(prettyFormula('CO32-')).toBe('CO₃²⁻');
    expect(prettyFormula('SO42-')).toBe('SO₄²⁻');
    expect(prettyFormula('H2PO4-')).toBe('H₂PO₄⁻');
    expect(prettyFormula('Cl-')).toBe('Cl⁻');
    expect(prettyFormula('H+')).toBe('H⁺');
    // Others: one element carries its digits as charge; two digits are a count and a charge.
    expect(prettyFormula('Fe3+')).toBe('Fe³⁺');
    expect(prettyFormula('Al3+')).toBe('Al³⁺');
    expect(prettyFormula('PO43-')).toBe('PO₄³⁻');
    expect(prettyFormula('Cr2O72-')).toBe('Cr₂O₇²⁻');
    expect(prettyFormula('MnO4-')).toBe('MnO₄⁻');
  });

  it('what is not a formula is left as it is', () => {
    expect(prettyFormula('ATP')).toBe('ATP');
    expect(prettyFormula('SEI')).toBe('SEI');
    expect(prettyFormula('pH')).toBe('pH');
  });
});

describe('formulas in running text', () => {
  it('sets the formulas of a caption', () => {
    expect(prettyText('칼슘 이온(Ca2+)과 탄산수소 이온(HCO3-)이 들어 있어요')).toBe('칼슘 이온(Ca²⁺)과 탄산수소 이온(HCO₃⁻)이 들어 있어요');
    expect(prettyText('하이드로늄 이온(H3O+)과 염화 이온(Cl-)이 생긴다.')).toBe('하이드로늄 이온(H₃O⁺)과 염화 이온(Cl⁻)이 생긴다.');
    expect(prettyText('이산화탄소(CO2)가 빗물에 녹아들어요')).toBe('이산화탄소(CO₂)가 빗물에 녹아들어요');
    expect(prettyText('H+를 내준다')).toBe('H⁺를 내준다');
    expect(prettyText('Zn → Zn2+ + 2e-')).toBe('Zn → Zn²⁺ + 2e⁻');
    expect(prettyText('2H2O')).toBe('2H₂O');
  });

  it('leaves atoms, bonds, words and what is already set alone', () => {
    for (const s of ['O의 비공유 전자쌍', 'C=O 결합', 'O-H 결합이 사라진다', 'H–Cl', 'ATP와 ADP', 'H₃O⁺', 'NaCl 결정', 'pH 7']) {
      expect(prettyText(s)).toBe(s);
    }
  });
});
