import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../../src/tutorial/chapters';
import { GLOSSARY, findTerms } from '../../src/tutorial/glossary';

const words = (text: string, skip: string | null = null) => findTerms(text, skip).map((m) => text.slice(m.start, m.end));

describe('glossary', () => {
  it('every term leads to a lesson that exists', () => {
    const ids = new Set(CHAPTERS.map((c) => c.id));
    for (const t of GLOSSARY) expect(ids.has(t.lesson), t.term).toBe(true);
  });

  it('every meaning is a sentence or two that ends with a full stop', () => {
    for (const t of GLOSSARY) {
      expect(t.meaning.endsWith('다.'), t.term).toBe(true);
      expect(t.meaning.length, t.term).toBeLessThanOrEqual(70);
    }
  });

  it('finds terms with the endings Korean puts after them', () => {
    expect(words('산화와 환원이 함께 일어난다.')).toEqual(['산화', '환원']);
    expect(words('구리 이온이 환원되어 금속이 된다.')).toEqual(['환원']);
    expect(words('물속에 하이드로늄 이온이 생긴다.')).toEqual(['하이드로늄 이온']);
    expect(words('두 분자가 축합으로 이어진다.')).toEqual(['축합']);
  });

  it('does not find a term inside a longer word', () => {
    // 탄산 is not 산, 이산화탄소 is not 산화, 과산화수소 is not 산화, 충전지 is not 전지.
    expect(words('이산화탄소가 물에 녹아 탄산이 된다.')).toEqual([]);
    expect(words('과산화수소와 충전지')).toEqual([]);
  });

  it('reads the longer term first: 염기성 is not 염기, 산화수 is not 산화', () => {
    expect(words('염기성 용액')).toEqual(['염기성']);
    expect(words('산화수를 센다')).toEqual(['산화수']);
    // Also where the longer one is not linked again: 산성과 염기성 a second time is not 염기.
    expect(words('산성 용액과 염기성 용액을 섞으면 산성과 염기성이 함께 없어진다.')).toEqual(['산성', '염기성']);
  });

  it('links each term once, and not to the lesson being read', () => {
    expect(words('산화가 일어나고 다시 산화가 일어난다.')).toEqual(['산화']);
    expect(words('산화와 환원이 함께 일어난다.', 'redox')).toEqual([]);
  });

  it('links three terms at most in one caption', () => {
    expect(findTerms('확산, 증발, 응결, 용해, 삼투가 모두 물리 변화다.').length).toBe(3);
  });
});
