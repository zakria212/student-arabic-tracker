import { registerSW } from 'virtual:pwa-register';

/**
 * تسجيل Service Worker مع تحديث تلقائي: يتحقق من وجود نسخة جديدة عند الفتح
 * وعند العودة للتطبيق، ويعيد التحميل تلقائيًا عند تفعيل النسخة الجديدة.
 */
export function setupPwa() {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { reg.update().catch(() => {}); };
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      setInterval(check, 30 * 60 * 1000);
    },
  });
}
