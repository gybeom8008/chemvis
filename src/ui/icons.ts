/** Line icons (24×24, stroke-based). */
const P: Record<string, string> = {
  replay: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4v4.5H8"/>',
  first: '<path d="M6.5 5.5v13"/><path d="m17.5 6-6.5 6 6.5 6"/>',
  prev: '<path d="m14.5 6-6 6 6 6"/>',
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
  doc: '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
};

export function icon(name: keyof typeof P | string): string {
  return `<svg class="ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? ''}</svg>`;
}
