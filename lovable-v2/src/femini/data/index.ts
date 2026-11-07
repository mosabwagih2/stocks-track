import type { Repo } from './repo';
import { createMemoryRepo } from './memory';

/** In-browser repo (localStorage + IndexedDB). Same interface and rules as the server version. */
let instance: Repo | undefined;
export const repo = new Proxy({} as Repo, { get(_target, key: keyof Repo) { if (key === 'mode') return 'memory'; instance ??= createMemoryRepo(); const value = instance[key]; return typeof value === 'function' ? value.bind(instance) : value; } });
