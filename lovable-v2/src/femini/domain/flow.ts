import type { AnyLoc, Loc } from './types';
import type { OpHdr, OpLine, OpType } from './ops';

/**
 * The next steps a piece can take from each stock state, each recorded by its own operation (so the factory and the
 * lost reports see it): ready → needs cleaning / final scrap / lost (state change), needs cleaning → the factory (wash),
 * the factory → ready (washed) or final scrap (rejected), final scrap → handed to the factory (leaves the stock),
 * lost → found or written off. The first step of each state is the usual one.
 */
export interface Step { to: AnyLoc; label: string; op: OpType; hdr: (reason: string) => OpHdr; line: (sku: string, q: number) => OpLine }
const cln = (from: Loc, to: Loc, label: string): Step => ({ to, label, op: 'CLN', hdr: (reason) => ({ from, to, reason }), line: (sku, q) => ({ sku, q }) });

export const NEXT: Record<Loc, Step[]> = {
  READY: [cln('READY', 'DIRTY', 'هالك نظافة'), cln('READY', 'SCRAP', 'هالك نهائي'), cln('READY', 'LOST', 'مفقود')],
  DIRTY: [
    { to: 'FACTORY', label: 'إرسال للمصنع (غسيل)', op: 'FSD', hdr: () => ({ kind: 'wash' }), line: (sku, q) => ({ sku, q }) },
    cln('DIRTY', 'READY', 'جاهز للبيع (اتنضّف هنا)'), cln('DIRTY', 'SCRAP', 'هالك نهائي'),
  ],
  FACTORY: [
    { to: 'READY', label: 'رجع من المصنع سليم (جاهز للبيع)', op: 'FRC', hdr: () => ({}), line: (sku, q) => ({ sku, q, rej: 0 }) },
    { to: 'SCRAP', label: 'رجع من المصنع مرفوض (هالك نهائي)', op: 'FRC', hdr: () => ({}), line: (sku, q) => ({ sku, q: 0, rej: q }) },
  ],
  SCRAP: [
    { to: 'EXT_FACTORY', label: 'اتسلّم للمصنع (يخرج من المخزون)', op: 'FSD', hdr: () => ({ kind: 'scrap' }), line: (sku, q) => ({ sku, q }) },
    cln('SCRAP', 'READY', 'جاهز للبيع (اتصلّح)'),
  ],
  LOST: [
    { to: 'READY', label: 'لقيناه (جاهز للبيع)', op: 'LOS', hdr: () => ({}), line: (sku, q) => ({ sku, q, res: 'FOUND' }) },
    { to: 'EXT_OFF', label: 'شطب نهائي', op: 'LOS', hdr: () => ({}), line: (sku, q) => ({ sku, q, res: 'OFF' }) },
  ],
};
