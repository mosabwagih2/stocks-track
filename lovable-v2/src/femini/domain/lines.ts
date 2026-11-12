import { lineBase } from './constants';

/** The production line of a model, from its code: PAN… بانتي, BR… برا, SH… شورت, anything else موديلات أخرى. */
export const LINES = ['بانتي', 'برا', 'شورت', 'موديلات أخرى'] as const;
export type Line = (typeof LINES)[number];
export const lineOf = (m: string): Line => { const b = lineBase(m); return /^PAN/.test(b) ? 'بانتي' : /^BR/.test(b) ? 'برا' : /^SH/.test(b) ? 'شورت' : 'موديلات أخرى'; };
