import { readFlags } from '../src/debug/flags';

const q = (o: Record<string, string>) => (k: string) => o[k] ?? null;

describe('readFlags', () => {
  it('uses defaults when nothing is set', () => {
    expect(readFlags(q({}))).toEqual({ look: 'A', cam: 'director', debug: '0', view: 'battle', seed: null });
  });
  it('accepts known values and rejects unknown ones', () => {
    expect(readFlags(q({ look: 'C', cam: 'v6', seed: '42' }))).toMatchObject({ look: 'C', cam: 'v6', seed: 42 });
    expect(readFlags(q({ look: 'Z', seed: 'x' }))).toMatchObject({ look: 'A', seed: null });
  });
});
