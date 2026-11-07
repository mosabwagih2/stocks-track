import { setActor, type Repo } from './repo';
import { createMemoryRepo } from './memory';
import { createServerBackend, type Backend } from './cpanel/backend';
import type { Boot } from './cpanel/v3';

/**
 * Which edition runs:
 *  - server edition (cPanel, PHP + MySQL): the page carries window.FEM_BOOT, put there by the server after sign-in
 *  - browser edition: everything in this browser (localStorage + IndexedDB)
 * Both use the same repository and rules; the server edition sends every action to the server.
 */
export const boot: Boot | null = typeof window !== 'undefined' ? ((window as unknown as { FEM_BOOT?: Boot }).FEM_BOOT ?? null) : null;
export const serverEdition = !!boot?.state;
let backend: Backend | undefined;
export const server = (): Backend | undefined => (serverEdition ? (backend ??= createServerBackend(boot!)) : undefined);

let instance: Repo | undefined;
const make = (): Repo => {
  const b = server();
  if (b) setActor(b.user.name);   // the signed-in server user is who does every action
  return createMemoryRepo(b);
};
export const repo = new Proxy({} as Repo, { get(_target, key: keyof Repo) { if (key === 'mode') return serverEdition ? 'server' : 'memory'; instance ??= make(); const value = instance[key]; return typeof value === 'function' ? value.bind(instance) : value; } });
