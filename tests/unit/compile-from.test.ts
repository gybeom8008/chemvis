import { describe, expect, it } from 'vitest';
import { addSpecies, compile, compileFrom } from '../../src/engine/compile';
import { cloneWorld, component, emptyWorld, formalCharge, getBond, type World } from '../../src/engine/world';
import { getStage } from '../../src/stage/stages';

const legacyScripts = [
  '',
  'stage solution\ncrowd H2O in water 20\nmol a = H3O+ at left\nmol b = OH- at right\nstep "near"\n approach b.O a.H1\nstep "react"\n transfer a.H1 to b.O',
  'stage solution\nmol a = Ag+ at left\nmol b = Cl- at right\nstep "solid"\n precipitate using a b as s',
  'stage solution\ncrystal s = NaCl at bottom 4x3\nstep "dissolve"\n dissolve s1 s2 from s',
  'stage solution\nmetal m = Zn at 420,330 3x2\nmol a = Ag+ at 640,200\nmol b = Ag+ at 700,330\nstep "land"\n land a b on m3\nstep "hop"\n hop m3.Zn -> a.Ag\n hop m3.Zn -> b.Ag\n join a b to m\nstep "leave"\n leave m3 from m',
  'mol a = H2O at center\nstep "bad"\n transfer a.H1 to missing.O',
  'stage solution\nmol a = H2O at left\nstep "add"\n place Na+ at right\nstep "water"\n solvate all',
];

describe('legacy compile output', () => {
  it('keeps the existing complete timelines, geometry, IDs and diagnostics', async () => {
    const hashes = await Promise.all(legacyScripts.map(async (src) => {
      const bytes = new TextEncoder().encode(JSON.stringify(compile(src), (_, v) => v instanceof Map || v instanceof Set ? [...v] : v));
      return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');
    }));
    // Captured from 0dc74b3 before extracting the shared step runner.
    expect(hashes).toEqual([
      '5cadf6a59a87b7b49387b0c0e07fb91a9a2acc48d26c292ef65d37b79b8ea238',
      '514ee7695f7e5ab01909e4362f1077563d992cf11aad24619b9e945edc389625',
      '19114f2d97df1a71927a053077986e74e74d6d282b2f2576d343d5b133432b39',
      '8c986edb854e76151edc610cf1d66174b43e6d436f222bd1708758d8e1611fab',
      '52c6a96847a8cbe7c75453b9aade5cb228b22e9a3082735433b16f67b870468f',
      '0aaa62792ad2f14d2459a1bf3999741ea4815b8d67fa91681ed28fee03e0a9b2',
      '54c05f83ef78b4f5f19709fbcf4a1843e056d53a770dba6932685735e0ba1311',
    ]);
  });
});

const stage = getStage('solution')!;
const fixture = (src: string): World => {
  const r = compile(src);
  expect(r.errors).toEqual([]);
  return cloneWorld(r.timeline!.steps.at(-1)?.after ?? r.timeline!.initial);
};
const run = (base: World, steps: string) => {
  const snapshot = cloneWorld(base);
  const r = compileFrom(base, stage, steps);
  expect(base).toEqual(snapshot);
  expect(r.errors).toEqual([]);
  if (!r.timeline) throw new Error(JSON.stringify(r.errors));
  return r;
};
const fails = (base: World, steps: string) => {
  const snapshot = cloneWorld(base);
  const r = compileFrom(base, stage, steps);
  expect(r.errors.length).toBeGreaterThan(0);
  expect(r.timeline).toBeNull();
  expect(r.end).toBeNull();
  expect(r.effects).toEqual([]);
  expect(base).toEqual(snapshot);
  return r;
};
const electrons = (w: World) => [...w.atoms.values()].filter((a) => !a.crowd).reduce((s, a) => s + 2 * a.lp + a.rad, 0) +
  [...w.bonds.values()].filter((b) => !w.atoms.get(b.a)!.crowd).reduce((s, b) => s + 2 * b.order, 0);
const charge = (w: World) => [...w.atoms.values()].filter((a) => !a.crowd).reduce((s, a) => s + formalCharge(w, a), 0);
const IONS = `stage solution
mol a1 = Ag+ at 250,200
mol a2 = Ag+ at 650,200
mol a3 = Ag+ at 300,420
mol b1 = Cl- at 440,210
mol b2 = Cl- at 620,420
mol b3 = Cl- at 420,430`;

describe('compileFrom state and transactions', () => {
  it('copies the exact initial state, preserves observers and returns an independent end', () => {
    const base = fixture(`stage solution
mol a = H3O+ at 300,300
mol b = OH- at 500,300
mol spectator = Na+ at 850,200
crystal s = NaCl at bottom 2x1
step "hydrate spectator"
  solvate spectator`);
    base.atoms.get('a.O')!.x += 17;
    base.lens.numbers = true;
    base.temp.water = 25;
    base.plate.left = 2;
    base.proteins.push({ name: 'unused', kind: 'channel', x: 900, carries: 'K+' });
    base.sites.push({ id: 'unused', x: 50, y: 50, nx: 1, ny: 0, region: 'water', plate: 0, occupant: null });
    const r = run(base, 'step "react"\n transfer a.H1 to b.O');
    expect(r.timeline.initial).toEqual(base);
    expect(r.timeline.initial).not.toBe(base);
    expect(r.timeline.initial.atoms.get('a.O')).not.toBe(base.atoms.get('a.O'));
    for (const [id, a] of base.atoms) if (!id.startsWith('a.') && !id.startsWith('b.')) {
      expect(r.end.atoms.get(id)).toEqual(a);
      expect(r.timeline.steps[0].tracks.has(id)).toBe(false);
    }
    for (const key of ['names', 'crystals', 'attached', 'lens', 'counter', 'temp', 'sites', 'plate', 'proteins'] as const) {
      expect(r.end[key]).toEqual(base[key]);
    }
    expect(electrons(r.end)).toBe(electrons(base));
    expect(charge(r.end)).toBe(charge(base));
    r.end.atoms.get('a.O')!.x += 100;
    r.timeline.initial.lens.charge = false;
    expect(r.timeline.steps[0].after.atoms.get('a.O')!.x).not.toBe(r.end.atoms.get('a.O')!.x);
    expect(base.lens.charge).toBe(true);
  });

  it('continues three times with the same H crossing H3O+ -> NH3 -> OH-', () => {
    const base = fixture('mol a = H3O+ at 250,260\nmol b = NH3 at 480,270\nmol c = OH- at 700,400');
    const first = run(base, 'step "first"\n transfer a.H1 to b.N');
    expect(component(first.end, 'b.N').sort()).toEqual(['a.H1', 'b.H1', 'b.H2', 'b.H3', 'b.N']);
    const second = run(first.end, 'step "approach current ammonium"\n approach c.O a.H1');
    expect(second.timeline.initial).toEqual(first.end);
    const third = run(second.end, 'step "same H again"\n transfer a.H1 to c.O');
    expect(third.timeline.initial).toEqual(second.end);
    expect(component(third.end, 'c.O').sort()).toEqual(['a.H1', 'c.H', 'c.O']);
    expect(getBond(third.end, 'b.N', 'a.H1')).toBeUndefined();
    expect(third.end.atoms.get('a.H1')!.owner).toBe('a');
    expect(third.end.atoms.has('b.H4')).toBe(false);
    expect([...third.end.atoms.keys()].sort()).toEqual([...base.atoms.keys()].sort());
    expect(electrons(third.end)).toBe(24);
    expect(charge(third.end)).toBe(0);
  });

  it('keeps even out-of-bounds spectators and unrelated overlapping water still', () => {
    const base = fixture('mol a = H3O+ at 280,240\nmol b = OH- at 490,240\nmol spectator = Na+ at 800,300\nmol w1 = H2O at 850,460\nmol w2 = H2O at 850,460');
    base.atoms.get('spectator.Na')!.x = -100;
    for (const id of ['w1', 'w2']) for (const a of component(base, `${id}.O`)) base.atoms.get(a)!.crowd = true;
    const r = run(base, 'step "react"\n transfer a.H1 to b.O');
    for (const [id, a] of base.atoms) if (id.startsWith('w') || id.startsWith('spectator')) expect(r.end.atoms.get(id)).toEqual(a);
  });

  it('moves only the requested component when cleanup must separate overlapping solutes', () => {
    const base = fixture('mol a = Na+ at 250,300\nmol b = Cl- at 700,300');
    const b = { ...base.atoms.get('b.Cl')! };
    const r = run(base, `step "move"\n move a to ${b.x + 1},${b.y}`);
    expect(r.end.atoms.get('b.Cl')).toEqual(b);
    expect(Math.hypot(r.end.atoms.get('a.Na')!.x - b.x, r.end.atoms.get('a.Na')!.y - b.y)).toBeGreaterThan(30);
  });

  it('rolls back all steps and effects after a late command error', () => {
    const r = fails(fixture(IONS), 'step "solid"\n precipitate using a3 b2\nstep "bad"\n move missing to left');
    expect(r.errors[0].line).toBe(4);
  });

  it('rolls back a half bond detected at the end of a step', () => {
    fails(fixture('mol a = H2 at center'), 'step "half"\n hop a.H1~a.H2 -> a.H1');
  });

  it('accepts empty/comment-only input as an unchanged, independently copied world', () => {
    const base = fixture(IONS);
    const r = run(base, '# no steps\n');
    expect(r.end).toEqual(base);
    expect(r.end).not.toBe(base);
    expect(r.timeline.steps).toEqual([]);
    expect(r.effects).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });

  it('is deterministic across repeated calls, titles and Map insertion orders', () => {
    const base = fixture(IONS);
    const src = 'step "hydrate"\n solvate a1\nstep "precipitate"\n precipitate using a1 b1';
    const r = run(base, src);
    expect(run(base, src)).toEqual(r);
    const title = compileFrom(base, stage, src, { title: 'another title' });
    expect(title.timeline!.steps).toEqual(r.timeline.steps);
    expect(title.end).toEqual(r.end);
    const reversed = cloneWorld(base);
    for (const key of ['atoms', 'bonds', 'names', 'attached', 'crystals'] as const) {
      // Each map has a different value type; reverse it in place without widening the World type.
      const entries = [...reversed[key]];
      reversed[key].clear();
      for (const [k, v] of entries.reverse()) (reversed[key] as Map<string, unknown>).set(k, v);
    }
    expect(run(reversed, src)).toEqual(r);
  });

  it('rejects dangling references and duplicate crystal membership before execution', () => {
    const base = fixture(IONS);
    base.names.set('bad', 'absent.Ag');
    fails(base, 'step "wait"\n wait 1');
    base.names.delete('bad');
    base.crystals.set('s1', ['a1.Ag']);
    base.crystals.set('s2', ['a1.Ag']);
    fails(base, 'step "wait"\n wait 1');
  });

  it.each(['mol w = H2O at center', 'place H2O at center', 'load Na+ x2', 'crowd H2O in water 2',
    'crystal s = NaCl at bottom 2x1', 'metal m = Zn at center 3x2', 'electrode m = Zn', 'protein p = channel',
    'stage solution', 'scene "replacement"'])('rejects header/creation commands both before and inside steps: %s', (cmd) => {
    const base = fixture(IONS);
    fails(base, cmd);
    fails(base, `step "not a creation boundary"\n ${cmd}`);
  });

  it('rejects parser errors and commands outside a step without partially executing', () => {
    fails(fixture(IONS), 'move a1 to left\nstep "ok"\n wait 1');
    fails(fixture(IONS), 'step "unterminated\n precipitate using a1 b1');
  });
});

describe('continuation solids and automatic IDs', () => {
  it('selects the named pair then grows the same crystal across three boundaries', () => {
    const base = fixture(IONS);
    const first = run(base, 'step "first"\n precipitate using a3 b2');
    const name = first.effects[0].crystalName;
    expect(first.effects).toEqual([{ kind: 'precipitate', stepIndex: 0, crystalName: name, addedAtomIds: ['a3.Ag', 'b2.Cl'], onto: false }]);
    expect(first.end.crystals.get(name)).toEqual(['a3.Ag', 'b2.Cl']);
    for (const id of ['a1.Ag', 'a2.Ag', 'b1.Cl', 'b3.Cl']) expect(first.end.atoms.get(id)).toEqual(base.atoms.get(id));
    const second = run(first.end, `step "second"\n precipitate using a1 b1 onto ${name}`);
    const third = run(second.end, `step "third"\n precipitate using a2 b3 onto ${name}`);
    expect(second.end.crystals.get(name)).toHaveLength(4);
    expect(third.end.crystals.get(name)).toHaveLength(6);
    expect(third.effects).toEqual([{ kind: 'precipitate', stepIndex: 0, crystalName: name, addedAtomIds: ['a2.Ag', 'b3.Cl'], onto: true }]);
    for (const id of first.end.crystals.get(name)!) expect(third.end.atoms.get(id)).toEqual(first.end.atoms.get(id));
    expect(third.end.bonds.size).toBe(0);
    expect(electrons(third.end)).toBe(24);
    expect(charge(third.end)).toBe(0);
    third.effects[0].addedAtomIds.push('fake');
    expect(third.end.crystals.get(name)).toHaveLength(6);
  });

  it('reports explicit names and all separate precipitation effects in order', () => {
    const r = run(fixture(IONS), 'step "both"\n precipitate using a1 b1 as first\n precipitate using a2 b2 as second');
    expect(r.effects.map((e) => [e.crystalName, e.onto])).toEqual([['first', false], ['second', false]]);
  });

  it('dissolves two selected surface pairs across boundaries while the remaining crystal stays fixed', () => {
    const base = fixture('crystal s = NaCl at bottom 4x3\nmol w = H2O at 200,250');
    const first = run(base, 'step "first pair"\n dissolve s1 s2 from s');
    const second = run(first.end, 'step "second pair"\n dissolve s3 s4 from s');
    expect(first.end.crystals.get('s')).toHaveLength(10);
    expect(second.end.crystals.get('s')).toHaveLength(8);
    for (const id of second.end.crystals.get('s')!) expect(second.end.atoms.get(id)).toEqual(base.atoms.get(id));
    for (const id of ['s1.Na', 's2.Cl', 's3.Na', 's4.Cl']) expect(second.end.attached.get(id)!.length).toBeGreaterThan(0);
    for (const id of ['w.O', 'w.H1', 'w.H2']) expect(second.end.atoms.get(id)).toEqual(base.atoms.get(id));
    expect(electrons(second.end)).toBe(electrons(base));
    expect(charge(second.end)).toBe(charge(base));
    fails(second.end, 'step "already dissolved"\n dissolve s1 s2 from s');
  });

  it('avoids names, crystal names and orphaned atom-ID namespaces', () => {
    const base = fixture(`${IONS}\nmol spare = Na+ at 800,200`);
    base.names.set('ppt#1', 'spare.Na');
    base.crystals.set('ppt#2', []);
    const atom = base.atoms.get('spare.Na')!;
    base.atoms.set('ppt#3.X', { ...atom, id: 'ppt#3.X', owner: 'ppt#3', num: ++base.counter });
    const r = run(base, 'step "new"\n precipitate using a1 b1');
    expect(r.effects[0].crystalName).toBe('ppt#4');
    const next = run(r.end, 'step "new again"\n precipitate using a2 b2');
    expect(next.effects[0].crystalName).toBe('ppt#5');
    fails(base, 'step "explicit collision"\n precipitate using a1 b1 as ppt#3');
  });

  it('never overwrites hydration water IDs when hydration is continued', () => {
    const base = fixture(IONS);
    const first = run(base, 'step "hydrate"\n solvate a1');
    const ids = new Set(first.end.atoms.keys());
    expect(first.end.attached.get('a1.Ag')!.length).toBeGreaterThan(0);
    const second = run(first.end, 'step "hydrate other"\n solvate a2');
    expect(second.end.atoms.size).toBeGreaterThan(first.end.atoms.size);
    for (const id of ids) expect(second.end.atoms.get(id)).toEqual(first.end.atoms.get(id));
    const third = run(second.end, 'step "hydrate third"\n solvate a3');
    expect(third.end.atoms.size).toBeGreaterThan(second.end.atoms.size);
    expect(third.end.counter).toBe(base.counter); // solvent does not take a tracked material number
  });

  it('reserves declared names that would collide with a generated solvent atom ID', () => {
    const base = fixture(IONS);
    base.names.set('~H2O#1.O', 'a3.Ag');
    const r = run(base, 'step "hydrate"\n solvate a1');
    expect(r.end.atoms.has('~H2O#1.O')).toBe(false);
    expect(r.end.atoms.has('~H2O#2.O')).toBe(true);
    expect(r.end.names.get('~H2O#1.O')).toBe('a3.Ag');
  });

  it('rejects reusing a crystallized ion, a wrong salt, and the same ion twice', () => {
    const base = fixture(`${IONS}\ncrystal salt = NaCl at bottom 2x1`);
    fails(base, 'step "same"\n precipitate using a1 a1');
    fails(base, 'step "wrong salt"\n precipitate using a1 b1 onto salt');
    const first = run(base, 'step "first"\n precipitate using a1 b1 as s');
    fails(first.end, 'step "already used"\n precipitate using a1 b2 onto s');
  });

  it('continues a metal piece through land, electron transfer/join, and leave', () => {
    const base = fixture('crowd H2O in water 12\nmetal m = Zn at 420,330 3x2\nmol a = Ag+ at 650,200\nmol b = Ag+ at 700,330');
    const one = run(base, 'step "land"\n land a b on m3');
    const two = run(one.end, 'step "electrons"\n hop m3.Zn -> a.Ag\n hop m3.Zn -> b.Ag\n join a b to m');
    const three = run(two.end, 'step "leave"\n leave m3 from m');
    expect([...three.end.crystals.get('m')!].sort()).toEqual(['a.Ag', 'b.Ag', 'm1.Zn', 'm2.Zn', 'm4.Zn', 'm5.Zn', 'm6.Zn']);
    expect(formalCharge(three.end, three.end.atoms.get('m3.Zn')!)).toBe(2);
    expect(three.end.atoms.get('m3.Zn')!.lattice).toBeFalsy();
    expect(three.end.attached.get('m3.Zn')!.length).toBeGreaterThan(0);
    expect(electrons(three.end)).toBe(12);
    expect(charge(three.end)).toBe(2);
    for (const id of ['m1.Zn', 'm2.Zn', 'm4.Zn', 'm5.Zn', 'm6.Zn']) expect(three.end.atoms.get(id)).toEqual(base.atoms.get(id));
  });
});

describe('addSpecies', () => {
  it('adds formula and SMILES graphs without mutating or rearranging existing material', () => {
    const base = fixture('mol observer = Na+ at 200,200');
    const saved = cloneWorld(base);
    const one = addSpecies(base, 'H2O', 'w', { x: 400, y: 300 });
    expect(one.errors).toEqual([]);
    expect(one.addedAtomIds).toEqual(['w.O', 'w.H1', 'w.H2']);
    expect(base).toEqual(saved);
    expect(one.world!.atoms.get('observer.Na')).toEqual(base.atoms.get('observer.Na'));
    expect(one.world!.counter).toBe(base.counter + 3);
    const two = addSpecies(one.world!, 'smiles:CO', 'alcohol', { x: 600, y: 300 });
    expect(two.errors).toEqual([]);
    expect(two.addedAtomIds.length).toBeGreaterThan(2);
    expect(new Set(two.addedAtomIds).size).toBe(two.addedAtomIds.length);
    expect(two.world!.counter).toBe(one.world!.counter + two.addedAtomIds.length);
    expect(two.world!.crystals).toEqual(base.crystals);
    expect(two.world!.attached).toEqual(base.attached);
  });

  it.each(['unknown-formula', 'smiles:C('])('returns diagnostics and no partial world for %s', (f) => {
    const base = emptyWorld();
    const r = addSpecies(base, f, 'x', { x: 300, y: 300 });
    expect(r.world).toBeNull();
    expect(r.addedAtomIds).toEqual([]);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(base).toEqual(emptyWorld());
  });

  it('rejects all namespace collisions and invalid positions atomically', () => {
    const base = fixture('mol a = H2O at center\ncrystal s = NaCl at bottom 2x1');
    const saved = cloneWorld(base);
    for (const name of ['a', 's', 's1']) {
      const r = addSpecies(base, 'H2O', name, { x: 300, y: 300 });
      expect(r.world).toBeNull();
      expect(r.addedAtomIds).toEqual([]);
    }
    base.names.delete('a'); // orphaned owner/ID is still reserved
    expect(addSpecies(base, 'H2O', 'a', { x: 300, y: 300 }).world).toBeNull();
    expect(addSpecies(base, 'H2O', 'new', { x: NaN, y: 300 }).world).toBeNull();
    expect(base.atoms).toEqual(saved.atoms);
  });
});
