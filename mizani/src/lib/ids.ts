export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // بديل للمتصفحات القديمة أو السياقات غير الآمنة
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}

export function nowISO() {
  return new Date().toISOString();
}
