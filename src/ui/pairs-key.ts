/**
 * What the marks of the electron-pair drawing mean (docs/plan/depiction.md): the rows of a
 * legend, as small pictures in the stage's own colours. Shared by the app's legend and the compare page.
 */
export const POUCH = (hot: boolean, shared: boolean, tint = '') => {
  const c = hot ? tint || 'rgba(240,140,0,.62)' : 'rgba(70,78,96,.2)';
  const e = hot && !tint ? '#e8890c' : '#17233a';
  const w = shared ? 74 : 48;
  return `<svg width="${w}" height="30" viewBox="0 0 ${w} 30" aria-hidden="true">
    <line x1="20" y1="15" x2="${shared ? 56 : 33}" y2="15" stroke="${c}" stroke-width="15" stroke-linecap="round"/>
    <circle cx="13" cy="15" r="11.500" fill="#fdfdfb" stroke="#2b3140" stroke-width="1.500"/>
    ${shared ? '<circle cx="63" cy="15" r="8.500" fill="#fdfdfb" stroke="#2b3140" stroke-width="1.500"/>' : ''}
    <circle cx="${shared ? 40 : 33}" cy="11.200" r="2.700" fill="${e}"/><circle cx="${shared ? 40 : 33}" cy="18.800" r="2.700" fill="${e}"/>
  </svg>`;
};

export type Palette = 'red-positive' | 'red-negative';
export const LIGHT = (pos: boolean, strong: boolean, palette: Palette) => {
  const col = pos === (palette === 'red-positive') ? '#ff4b3e' : '#2f7df6';
  const id = `k${pos ? 'p' : 'n'}${strong ? 's' : 'w'}`;
  return `<svg width="46" height="40" viewBox="0 0 46 40" aria-hidden="true">
    <defs><radialGradient id="${id}"><stop offset="0.25" stop-color="${col}" stop-opacity="0.95"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="23" cy="20" r="${strong ? 20 : 15}" fill="url(#${id})" opacity="${strong ? 0.85 : 0.45}"/>
    <circle cx="23" cy="20" r="9" fill="#fdfdfb" stroke="#2b3140" stroke-width="1.500"/>
  </svg>`;
};

// Heat at the moment of a reaction: a ring that spreads (given off) or closes in (taken in).
export const HEAT = (out: boolean) => {
  const c = out ? '#2b3140' : '#2a9fd6';
  const tip = (x: number, d: number) => `<path d="M${x} 20 l${-4 * d} -3.5 v7 z" fill="${c}"/>`;
  return `<svg width="46" height="40" viewBox="0 0 46 40" aria-hidden="true">
    <circle cx="23" cy="20" r="15" fill="none" stroke="${c}" stroke-width="1.6" opacity="0.8"/>
    <circle cx="23" cy="20" r="8" fill="${out ? '#fff' : '#5ecbf5'}" stroke="#2b3140" stroke-width="1.2" stroke-opacity="${out ? 0.25 : 0.6}"/>
    ${out ? tip(45, 1) + tip(1, -1) : tip(33, -1) + tip(13, 1)}
  </svg>`;
};

/** The rows: each a picture and what it means. `heat`: with the two rows of the heat of a reaction. */
export function pairsKeyRows(palette: Palette, heat = true): [string, string][] {
  const neg = palette === 'red-positive' ? '47,125,246' : '255,75,62';
  const rows: [string, string][] = [
    [LIGHT(true, true, palette), '전자가 모자란 곳(+)'],
    [LIGHT(false, true, palette), '전자가 많은 곳(−)'],
    [LIGHT(true, false, palette) + LIGHT(false, false, palette), '조금 +, 조금 −'],
    [POUCH(false, false), '한 원자가 가진 전자쌍'],
    [POUCH(false, true), '두 원자가 함께 가진 전자쌍(결합)'],
    [POUCH(true, false, `rgba(${neg},.34)`), '지금 움직이는 전자쌍'],
  ];
  if (heat) rows.push([HEAT(true), '열이 나올 때: 하얗게 번쩍이고 고리가 퍼져요'], [HEAT(false), '열을 흡수할 때: 파랗게 되고 고리가 줄어들어요']);
  return rows;
}

/** The note under the rows. */
export const PAIRS_LAW = '빛은 전자를 센 결과예요. 전자가 간 곳은 −, 떠난 곳은 +가 돼요. 번쩍임과 고리는 열이 클수록 뚜렷해요.';
