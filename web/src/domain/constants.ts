import type { Loc } from './types';

export const LOCS: Loc[] = ['READY', 'DIRTY', 'FACTORY', 'SCRAP', 'LOST'];
export const LOC_AR: Record<string, string> = {
  READY: 'جاهز للبيع', DIRTY: 'هالك نظافة', FACTORY: 'عند المصنع', SCRAP: 'هالك نهائي', LOST: 'مفقود',
  EXT_OPEN: 'رصيد افتتاحي', EXT_FACTORY: 'المصنع', EXT_CH: 'القناة / العميل', EXT_SHOP: 'المحل', EXT_ADJ: 'تسوية جرد', EXT_OFF: 'شطب نهائي',
};
export const LOC_HINT: Record<Loc, string> = {
  READY: 'تقدر تبيعه', DIRTY: 'بيتغسل ويرجع', FACTORY: 'لسه راجع من المصنع', SCRAP: 'مفيش علاج', LOST: 'ضايع، مستني تسوية',
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
  OPN: 'رصيد افتتاحي', RCV: 'استلام توريد', SCN: 'شحن أوردرات', MOV: 'تغيير حالة', CXL: 'إلغاء أوردر', RTN: 'مرتجع', SHP: 'توريد للمحل', CNT: 'جرد',
};
