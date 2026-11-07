import { expect, it } from 'vitest';
import { validateBackup } from './backup';
const valid = () => ({ app: 'femini-stock-dashboard', version: 1, state: { v: 2, moves: [], orders: [], docs: [], pickups: [], supplies: [], log: [], images: {}, seq: {}, cat: { skus: [], models: [], archived: {}, names: {}, colors: [], sizes: [] } }, media: {} });
it('accepts a complete current backup', () => expect(validateBackup(valid()).version).toBe(1));
it('rejects an unsupported original backup without overwriting', () => expect(() => validateBackup({ app: 'femini-stock', state: { v: 3 } })).toThrow('Brand 2'));
it('rejects missing ledger', () => expect(() => validateBackup({ ...valid(), state: { ...valid().state, moves: null } })).toThrow());
it('rejects malformed media', () => expect(() => validateBackup({ ...valid(), media: { x: 42 } })).toThrow());