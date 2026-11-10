/** Line icons (24×24, stroke-based). */
const P: Record<string, string> = {
  replay: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v4.5H8"/>',
  first: '<path d="M6.5 5.5v13"/><path d="m17.5 6-6.5 6 6.5 6"/>',
  prev: '<path d="m14.5 6-6 6 6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  next: '<path d="m9.5 6 6 6-6 6"/>',
  nextChapter: '<path d="m5 6 6 6-6 6"/><path d="m12 6 6 6-6 6"/>',
  book: '<path d="M3 4.5h5.5A3.5 3.5 0 0 1 12 8v12a2.5 2.5 0 0 0-2.5-2.5H3z"/><path d="M21 4.5h-5.5A3.5 3.5 0 0 0 12 8v12a2.5 2.5 0 0 1 2.5-2.5H21z"/>',
  code: '<path d="m15.5 17.5 5.5-5.5-5.5-5.5"/><path d="M8.5 6.5 3 12l5.5 5.5"/>',
  layers: '<path d="m12 3 9 4.5-9 4.5-9-4.5z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/>',
  link: '<path d="M10 13.5a4.5 4.5 0 0 0 6.8.5l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.6 1.6"/><path d="M14 10.5a4.5 4.5 0 0 0-6.8-.5l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6"/>',
  close: '<path d="M18 6 6 18M6 6l12 12"/>',
  edit: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
  check: '<path d="M20 6.5 9.5 17 4 11.5"/>',
  openIn: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  legend: '<circle cx="5.5" cy="7" r="2" fill="currentColor" stroke="none"/><path d="M10 7h10"/><path d="M3.5 12h4"/><path d="M10 12h10"/><path d="M3.5 17 5.5 15l2 2"/><path d="M10 17h10"/>',
  examples: '<rect x="8" y="3" width="12" height="15" rx="1.8"/><path d="M5 7v12.2A1.8 1.8 0 0 0 6.8 21H16"/><path d="M11.5 8h5M11.5 11.5h5M11.5 15h3"/>',
  sliders: '<path d="M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20"/><circle cx="15" cy="7" r="2.5"/><circle cx="9" cy="17" r="2.5"/>',
  arrowRight: '<path d="M4.5 12h15"/><path d="m13 5.5 6.5 6.5-6.5 6.5"/>',
  arrowLeft: '<path d="M19.5 12h-15"/><path d="M11 5.5 4.5 12l6.5 6.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  undo: '<path d="M4.5 9H14a5.5 5.5 0 0 1 0 11H9"/><path d="m8.5 5-4 4 4 4"/>',
  trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="m6.5 7 .8 12a1.6 1.6 0 0 0 1.6 1.5h6.2a1.6 1.6 0 0 0 1.6-1.5l.8-12"/>',
  sun: '<circle cx="12" cy="12" r="3.8"/><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-3.5-2.5-5.5-3.5-8.5-.4 2-1.5 3-2.5 3.5C12 7.500 11 5 9 3c.3 3-3 6-3 12a6 6 0 0 0 6 6z"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.500l-15.600 9"/><path d="m9.500 4.500 2.500 2 2.500-2M9.500 19.500l2.500-2 2.500 2"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  flask: '<path d="M9 3h6"/><path d="M10 3v6.3L4.7 18.400A1.700 1.700 0 0 0 6.200 21h11.600a1.700 1.700 0 0 0 1.500-2.600L14 9.300V3"/><path d="M7.600 14.500h8.800"/>',
  hand: '<path d="M8.500 12V5.500a1.500 1.500 0 0 1 3 0V11"/><path d="M11.500 10.500V4.500a1.500 1.500 0 0 1 3 0V11"/><path d="M14.500 10.500V6a1.500 1.500 0 0 1 3 0v8.500a6.500 6.500 0 0 1-6.500 6.500 6 6 0 0 1-5-2.700L3.300 14a1.500 1.500 0 0 1 2.500-1.600l2.700 3.100"/>',
  doc: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
};

export function icon(name: keyof typeof P | string): string {
  return `<svg class="ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ''}</svg>`;
}
