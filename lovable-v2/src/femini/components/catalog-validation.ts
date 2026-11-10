/** "pa-3", "pa 3", "Pa_3" and "PA3" are the same model: keep letters and digits only, upper-case. */
export const normalizeModelCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** A code kept exactly as the pickup writes it (FC-PAN6-Bundle): a letter first, then letters, digits, hyphen or underscore. */
export const EXACT_CODE = /^[A-Za-z][A-Za-z0-9_-]{0,23}$/;
/** the code as it will be saved: typed by hand it is normalised, from a pickup it stays exactly as written */
export const modelCodeOf = (raw: string, exact: boolean) => (exact ? raw.trim() : normalizeModelCode(raw));

export function validateNewModel(input: { code: string; name: string; min: string; colors: string[]; sizes: string[] }, exists: boolean, exact = false) {
  const errors: Record<string, string> = {};
  if (exact ? !EXACT_CODE.test(input.code.trim()) : !/^[A-Z][A-Z0-9]{0,9}$/.test(normalizeModelCode(input.code))) errors.code = exact ? 'الكود زي البيك أب: يبدأ بحرف إنجليزي وبعده حروف أو أرقام أو - أو _ ولحد 24 حرف.' : 'أدخل كودًا يبدأ بحرف إنجليزي، حتى 10 حروف وأرقام (مثل PAN6 أو pa-3 أو pa 3).';
  else if (exists) errors.code = 'كود الموديل موجود أو مؤرشف؛ اختر كودًا آخر أو استعد الموديل المؤرشف.';
  if (!input.name.trim()) errors.name = 'أدخل اسم الموديل.';
  if (!input.colors.length) errors.colors = 'اختر لونًا واحدًا على الأقل.';
  if (!input.sizes.length) errors.sizes = 'اختر مقاسًا واحدًا على الأقل.';
  if (input.min.trim() && (!Number.isInteger(Number(input.min)) || Number(input.min) < 0)) errors.min = 'حد التنبيه يجب أن يكون عددًا صحيحًا غير سالب.';
  return errors;
}
