// Maps known server error messages to Arabic; memory-mode errors are already Arabic.
export function friendlyError(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e);
  const map: [RegExp, string][] = [
    [/employee name is required/, 'أدخل اسم الموظف'],
    [/none of the orders is open/, 'لا توجد أوردرات مفتوحة ضمن المحدد (ربما شُحنت مسبقًا)'],
    [/photo of the signed paper is required/, 'يجب إرفاق صورة الورقة الموقّعة'],
    [/photo of the crossed-out waybill is required/, 'يجب إرفاق صورة البوليصة المشطوبة'],
    [/declared total (\d+) does not match lines total (\d+)/, 'الإجمالي المكتوب في الورقة لا يساوي المضاف'],
    [/date must be within the last 3 days/, 'يجب أن يكون التاريخ ضمن آخر 3 أيام'],
    [/not enough in/, 'الكمية غير متاحة في هذه الحالة'],
    [/no order with this code/, 'لا يوجد أوردر بهذا الكود'],
    [/order is already cancelled/, 'الأوردر ملغى مسبقًا'],
    [/cannot issue/, 'لا يمكن صرف كمية أكبر من الرصيد'],
    [/count equals the balance/, 'العدد مطابق للرصيد'],
    [/already reversed/, 'تم عكس العملية مسبقًا'],
    [/cannot remove (\S+): it has stock/, 'لا يمكن الإزالة: عليه رصيد'],
    [/cannot remove (\S+): it has open demand/, 'لا يمكن الإزالة: عليه طلب مفتوح'],
    [/model already exists/, 'كود الموديل موجود بالفعل'],
    [/bad model code/, 'كود الموديل حروف إنجليزية وأرقام، ويبدأ بحرف'],
    [/pickup has shipped orders/, 'لا يمكن حذف بيك أب فيه أوردرات مشحونة'],
  ];
  for (const [re, ar] of map) if (re.test(m)) return ar;
  return m;
}
