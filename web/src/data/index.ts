import type { Repo } from './repo';
import { createMemoryRepo } from './memory';
import { createSupabaseRepo } from './supabase';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Supabase when configured, otherwise the in-browser demo (same interface, same rules). */
export const repo: Repo = url && key ? createSupabaseRepo(url, key) : createMemoryRepo();
