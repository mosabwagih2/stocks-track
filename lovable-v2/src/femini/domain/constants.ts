import type { Loc } from './types';

export const LOCS: Loc[] = ['READY', 'DIRTY', 'FACTORY', 'SCRAP', 'LOST'];
/** a pickup or a scan sheet can be recorded on a past day up to this many days back (forgotten uploads) */
export const BACKDATE_DAYS = 7;
export const LOC_AR: Record<string, string> = {
  READY: 'جاهز للبيع', DIRTY: 'هالك نظافة', FACTORY: 'عند المصنع', SCRAP: 'هالك نهائي', LOST: 'مفقود',
  EXT_OPEN: 'رصيد افتتاحي', EXT_FACTORY: 'المصنع', EXT_CH: 'القناة / العميل', EXT_SHOP: 'المحل', EXT_ADJ: 'تسوية جرد', EXT_OFF: 'شطب نهائي', EXT_HOLD: 'هولد (برا)',
};
export const LOC_HINT: Record<Loc, string> = {
  READY: 'قابل للبيع', DIRTY: 'يُغسل ثم يعود', FACTORY: 'في الطريق من المصنع', SCRAP: 'لا يمكن إصلاحه', LOST: 'مفقود، بانتظار التسوية',
};
export const LOC_COLOR: Record<Loc, string> = {
  READY: 'bg-ready', DIRTY: 'bg-dirty', FACTORY: 'bg-factory', SCRAP: 'bg-scrap', LOST: 'bg-lost',
};
export const CHANNELS = [
  { id: 'VENDOOR', name: 'Vendoor · فيندور', supported: true },
  { id: 'NOON', name: 'Noon · نون', supported: false },
  { id: 'AMAZON', name: 'Amazon · أمازون', supported: false },
];
export const channelName = (id: string) => CHANNELS.find((c) => c.id === id)?.name ?? id;
export const TYPE_AR: Record<string, string> = {
  OPN: 'رصيد افتتاحي', RCV: 'استلام توريد', SCN: 'شحن أوردرات', MOV: 'تغيير حالة', CXL: 'إلغاء أوردر', RTN: 'مرتجعات العملاء', SRT: 'مرتجع المحل', SHP: 'توريد للمحل', CNT: 'جرد', CLN: 'تصنيف حالة', FSD: 'إرسال للمصنع', FRC: 'استلام من المصنع', LOS: 'معالجة المفقود', SWP: 'تبديل مقاس', HLD: 'هولد',
};
/** The letters that say which production line a model belongs to (PAN, BR, SH): a pickup's own code may start with "FC-". */
export const lineBase = (m: string) => m.toUpperCase().replace(/^FC-/, '');
/** The item-code prefix of a model: its code with anything the server does not allow in an item code (a space, in the old
 * model «PAN6 Bundle») turned into "_": «PAN6 Bundle» sizes are PAN6_Bundle-X1-FREE, PAN6_Bundle-X1-L. */
export const skuPrefix = (model: string) => model.replace(/[^A-Za-z0-9_.-]/g, '_');
