/** "pa-3", "pa 3", "Pa_3" and "PA3" are the same model: keep letters and digits only, upper-case. */
export const normalizeModelCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function validateNewModel(input: { code: string; name: string; min: string; colors: string[]; sizes: string[] }, exists: boolean) {
  const errors: Record<string, string> = {};
  if (!/^[A-Z][A-Z0-9]{0,9}$/.test(normalizeModelCode(input.code))) errors.code = 'أدخل كودًا يبدأ بحرف إنجليزي، حتى 10 حروف وأرقام (مثل PAN6 أو pa-3 أو pa 3).';
  else if (exists) errors.code = 'كود الموديل موجود أو مؤرشف؛ اختر كودًا آخر أو استعد الموديل المؤرشف.';
  if (!input.name.trim()) errors.name = 'أدخل اسم الموديل.';
  if (!input.colors.length) errors.colors = 'اختر لونًا واحدًا على الأقل.';
  if (!input.sizes.length) errors.sizes = 'اختر مقاسًا واحدًا على الأقل.';
  if (input.min.trim() && (!Number.isInteger(Number(input.min)) || Number(input.min) < 0)) errors.min = 'حد التنبيه يجب أن يكون عددًا صحيحًا غير سالب.';
  return errors;
}
