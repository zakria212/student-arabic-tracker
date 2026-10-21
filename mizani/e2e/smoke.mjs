// اختبار متصفح شامل للتدفقات الأساسية. التشغيل: npm run build && npx vite preview --port 4173 ثم node e2e/smoke.mjs
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import JSZip from 'jszip';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const OUT = process.env.SHOTS_DIR ?? 'e2e/screens';
mkdirSync(OUT, { recursive: true });
const errors = [];
const log = (...a) => console.log('✓', ...a);
const assert = (c, m) => { if (!c) throw new Error('FAILED: ' + m); };

// صورة PNG صغيرة صالحة (إيصال تجريبي منفصل عن بيانات المستخدم)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAWklEQVR4nO3OMQ0AIBDAQMC/50cDQ4dLTUDP7AeYdQb/BpJIIokkkkgiiSSSSCKJJJJIIokkkkgiiSSSSCKJJJJIIokkkkgiiSSSSCKJJJJIIokkkkgiiSTa4AE7mQHfFtt8NgAAAABJRU5ErkJggg==', 'base64');

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true, locale: 'ar-SA' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const noHScroll = async (label) => {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert(r.sw <= r.cw + 1, `${label}: تمرير أفقي ${r.sw} > ${r.cw}`);
};
const netText = async () => (await page.locator('text=الصافي').first().locator('xpath=../..').innerText());

await page.goto(BASE);
await page.waitForSelector('text=لا توجد حركات في هذه الفترة');
assert((await page.getAttribute('html', 'dir')) === 'rtl', 'RTL');
await noHScroll('الرئيسية الفارغة');
await page.screenshot({ path: `${OUT}/01-empty-mobile.png` });
log('الرئيسية فارغة، RTL، بلا تمرير أفقي');

// ── إضافة مصروف مع صورة
await page.getByRole('button', { name: 'إضافة حركة' }).first().click();
await page.waitForSelector('#amount');
await page.fill('#amount', '45.50');
await page.fill('#details', 'وجبة غداء');
await page.getByRole('radio', { name: 'طعام' }).click();
await page.setInputFiles('input[type=file][multiple]', { name: 'فاتورة.png', mimeType: 'image/png', buffer: PNG });
await page.waitForSelector('img[alt="فاتورة.png"]');
await noHScroll('نموذج الإضافة');
await page.screenshot({ path: `${OUT}/02-form-mobile.png` });
await page.getByRole('button', { name: 'حفظ الحركة' }).click();
await page.waitForSelector('text=تم تسجيل المصروف');
log('إضافة مصروف 45.50 مع صورة');

// ── التحقق من الرفض: صفر وسالب ونص
await page.getByRole('button', { name: 'إضافة حركة' }).first().click();
for (const bad of ['0', '-5', 'abc']) {
  await page.fill('#amount', bad);
  await page.fill('#details', 'اختبار');
  await page.getByRole('button', { name: 'حفظ الحركة' }).click();
  await page.waitForSelector('#amount-err');
}
log('رفض المبالغ 0 و-5 والنص');

// ── دخل بأرقام عربية
await page.getByRole('radio', { name: 'الدخل +' }).click();
await page.fill('#amount', '١٢٣٤٫٥٠');
await page.fill('#details', 'مكافأة');
await page.getByRole('button', { name: 'حفظ الحركة' }).click();
await page.waitForSelector('text=تم تسجيل الدخل');
await page.waitForSelector('text=1,234.50');
let net = await netText();
assert(net.includes('1,189.00'), 'الصافي 1189.00: ' + net);
await page.waitForTimeout(400);
await noHScroll('الرئيسية بالبيانات');
await page.screenshot({ path: `${OUT}/03-dashboard-mobile.png`, fullPage: true });
log('دخل ١٢٣٤٫٥٠ يُقرأ 1,234.50 والصافي 1,189.00');

// ── إعادة التحميل: البيانات باقية، والصورة تفتح
await page.reload();
await page.waitForSelector('text=وجبة غداء');
await page.getByRole('button', { name: /مصروف: وجبة غداء/ }).click();
await page.waitForSelector('text=تفاصيل الحركة');
await page.getByRole('button', { name: 'فتح المرفق فاتورة.png' }).click();
await page.waitForSelector('dialog[aria-label^="عرض المرفق"] img');
const natural = await page.locator('dialog[aria-label^="عرض المرفق"] img').evaluate((i) => i.naturalWidth);
assert(natural === 48, 'الصورة محملة بعد إعادة التشغيل');
await page.screenshot({ path: `${OUT}/04-viewer.png` });
await page.getByRole('button', { name: 'إغلاق العارض' }).click();
await page.screenshot({ path: `${OUT}/05-details.png` });
log('البيانات والصورة محفوظة بعد إعادة التحميل، والعارض يعود للتفاصيل');

// ── التعديل ينعكس فورًا
await page.getByRole('button', { name: 'تعديل' }).click();
await page.waitForFunction(() => document.querySelector('#amount')?.value === '45.50');
await page.fill('#amount', '250.75');
await page.getByRole('button', { name: 'حفظ الحركة' }).click();
await page.waitForSelector('text=تم حفظ التعديلات');
await page.goto(BASE + '#/');
await page.waitForSelector('text=250.75');
net = await netText();
assert(net.includes('983.75'), 'الصافي بعد التعديل 983.75: ' + net);
log('التعديل إلى 250.75 → الصافي 983.75');

// ── الحذف والتراجع
await page.getByRole('button', { name: /مصروف: وجبة غداء/ }).click();
await page.getByRole('button', { name: 'حذف' }).click();
await page.getByRole('button', { name: 'نعم، احذف' }).click();
await page.waitForSelector('text=تم حذف الحركة');
net = await netText();
assert(net.includes('1,234.50'), 'بعد الحذف الصافي = الدخل: ' + net);
await page.getByRole('button', { name: 'تراجع' }).click();
await page.waitForSelector('text=تمت استعادة الحركة');
await page.waitForSelector('text=250.75');
log('الحذف يزيل الأثر، والتراجع يعيده');

// ── فترة مخصصة لا تشمل الحركات
await page.getByRole('button', { name: 'الحركات' }).first().click().catch(() => page.goto(BASE + '#/transactions'));
await page.goto(BASE + '#/transactions');
await page.locator('button[aria-haspopup=dialog]').click();
await page.fill('input[type=date] >> nth=0', '2026-09-01');
await page.fill('input[type=date] >> nth=1', '2026-09-30');
await page.getByRole('button', { name: 'تطبيق الفترة' }).click();
await page.waitForSelector('text=لا توجد حركات في هذه الفترة');
// نهاية قبل البداية مرفوضة
await page.locator('button[aria-haspopup=dialog]').click();
await page.fill('input[type=date] >> nth=1', '2026-08-01');
await page.fill('input[type=date] >> nth=0', '2026-09-10');
await page.getByRole('button', { name: 'تطبيق الفترة' }).click();
await page.waitForSelector('text=تاريخ النهاية لا يمكن أن يسبق تاريخ البداية');
await page.getByRole('radio').first().isVisible().catch(() => {});
await page.getByRole('button', { name: 'هذا الشهر' }).click();
await page.waitForSelector('text=وجبة غداء');
await page.fill('input[type=search]', 'غدا');
await page.waitForSelector('text=1 حركة');
await page.fill('input[type=search]', '');
await noHScroll('الحركات');
await page.screenshot({ path: `${OUT}/06-transactions-mobile.png`, fullPage: true });
log('الفترة المخصصة والتحقق من التواريخ والبحث');

// ── CSV
const [csvDl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'تصدير الحركات المعروضة CSV' }).click()]);
const csv = readFileSync(await csvDl.path(), 'utf8');
assert(csv.charCodeAt(0) === 0xfeff && csv.includes('250.75') && csv.includes('وجبة غداء'), 'CSV');
log('CSV مع BOM ونص عربي:', csv.split('\r\n')[0].slice(1));

// ── التقارير والطباعة
await page.goto(BASE + '#/reports');
await page.waitForSelector('text=أكثر تصنيفات المصروفات استهلاكًا');
await noHScroll('التقارير');
await page.screenshot({ path: `${OUT}/07-reports-mobile.png`, fullPage: true });
await page.getByRole('button', { name: /طباعة/ }).click();
await page.waitForSelector('text=تقرير ميزاني المالي');
await page.emulateMedia({ media: 'print' });
await page.pdf({ path: `${OUT}/report.pdf`, format: 'A4' }).catch(() => {});
await page.emulateMedia({ media: 'screen' });
log('التقارير وصفحة الطباعة');

// ── الأقسام: مصروف في قسم العمل وتصفية الإجماليات
await page.goto(BASE + '#/transactions/new');
await page.fill('#amount', '120');
await page.fill('#details', 'أدوات مكتبية');
await page.getByRole('radio', { name: 'تسوق' }).click();
await page.getByRole('radio', { name: 'العمل' }).click();
await page.getByRole('button', { name: 'حفظ الحركة' }).click();
await page.waitForSelector('text=تم تسجيل المصروف');
await page.goto(BASE + '#/');
await page.getByRole('button', { name: 'العمل', exact: true }).click();
await page.waitForSelector('text=أدوات مكتبية');
assert(!(await page.locator('text=وجبة غداء').count()), 'تصفية القسم تخفي حركات الأقسام الأخرى');
net = await netText();
assert(net.includes('120.00'), 'صافي قسم العمل −120: ' + net);
await page.screenshot({ path: `${OUT}/12-section-filter.png` });
await page.getByRole('button', { name: 'كل الأقسام' }).click();
log('الأقسام: الإضافة في قسم العمل والتصفية بالقسم');

// ── الديون
await page.goto(BASE + '#/debts');
await page.waitForSelector('text=لا توجد مبالغ أخذتها');
await page.getByRole('tab', { name: /أعطيت/ }).click();
await page.waitForSelector('text=لا توجد مبالغ أعطيتها');
await page.getByRole('button', { name: 'دين جديد' }).first().click();
await page.getByRole('radio', { name: /^أعطيت/ }).isVisible();
await page.fill('#debt-person', 'أحمد');
await page.fill('#debt-amount', '500');
await page.fill('#debt-date', '2026-09-20');
await page.fill('#debt-due', '2026-10-01');
await page.getByRole('button', { name: 'حفظ الدين' }).click();
await page.waitForSelector('text=تم تسجيل الدين');
await page.waitForSelector('text=/متأخر منذ/');
await page.getByRole('button', { name: /أحمد/ }).click();
await page.fill('#pay-amount', '200');
await page.getByRole('button', { name: 'إضافة دفعة' }).click();
await page.waitForSelector('text=تم تسجيل الدفعة');
await page.fill('#pay-amount', '400');
await page.getByRole('button', { name: 'إضافة دفعة' }).click();
await page.waitForSelector('text=مبلغ السداد أكبر من المتبقي');
await page.screenshot({ path: `${OUT}/13-debt-details.png` });
await page.keyboard.press('Escape');
await page.getByRole('tab', { name: /أخذت/ }).click();
await page.getByRole('button', { name: 'دين جديد' }).first().click();
await page.fill('#debt-person', 'خالد');
await page.fill('#debt-amount', '100');
await page.getByRole('button', { name: 'حفظ الدين' }).click();
await page.waitForSelector('text=تم تسجيل الدين');
await page.getByRole('button', { name: /خالد/ }).click();
await page.getByRole('button', { name: 'سداد كامل المتبقي' }).click();
await page.waitForSelector('text=تم تسديد الدين بالكامل');
await page.keyboard.press('Escape');
await page.waitForSelector('text=لا توجد مبالغ أخذتها');
const debtsText = await page.locator('main').innerText();
assert(debtsText.includes('300.00'), 'المتبقي لك 300: ' + debtsText.slice(0, 200));
await noHScroll('الديون');
await page.getByRole('tab', { name: /أعطيت/ }).click();
await page.screenshot({ path: `${OUT}/14-debts-mobile.png`, fullPage: true });
await page.goto(BASE + '#/');
await page.waitForSelector('text=أعطيت (لك)');
log('الديون: لي/عليّ، السداد الجزئي والكامل، التأخر، ومنع السداد الزائد');

// ── نسخة احتياطية ثم مسح ثم استعادة
await page.goto(BASE + '#/settings');
const [bk] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /تنزيل نسخة احتياطية/ }).click()]);
const bkPath = await bk.path();
const zip = await JSZip.loadAsync(readFileSync(bkPath));
assert(zip.file('mizani-backup.json') && Object.keys(zip.files).some((f) => f.startsWith('receipts/')), 'محتوى ZIP');
await page.getByRole('button', { name: 'مسح جميع البيانات…' }).click();
await page.locator('dialog[open] input').fill('احذف');
await page.getByRole('button', { name: 'مسح نهائي' }).click();
await page.waitForSelector('text=تم مسح جميع البيانات');
await page.setInputFiles('input[accept=".zip,application/zip"]', bkPath);
await page.waitForSelector('text=استعادة نسخة احتياطية');
await page.screenshot({ path: `${OUT}/08-import.png` });
await page.getByRole('button', { name: 'دمج البيانات' }).click();
await page.waitForSelector('text=تم الدمج');
// دمج مرة ثانية لا يكرر
await page.setInputFiles('input[accept=".zip,application/zip"]', bkPath);
await page.getByRole('button', { name: 'دمج البيانات' }).click();
await page.waitForSelector('text=أضيفت 0 حركة');
await page.goto(BASE + '#/');
await page.getByRole('button', { name: /مصروف: وجبة غداء/ }).click();
await page.waitForSelector('button[aria-label="فتح المرفق فاتورة.png"]');
await page.keyboard.press('Escape');
await page.goto(BASE + '#/debts?d=lent');
await page.waitForSelector('text=أحمد');
log('النسخ الاحتياطي ← المسح ← الاستعادة (مع الديون والأقسام)، والدمج لا يكرر');

// ── الوضع الداكن ولقطات الحاسوب
await page.setViewportSize({ width: 1280, height: 860 });
await page.goto(BASE + '#/');
await page.waitForSelector('text=آخر الحركات');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/09-dashboard-desktop.png` });
await page.goto(BASE + '#/settings');
await page.getByRole('button', { name: 'داكن' }).click();
await page.goto(BASE + '#/');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/10-dashboard-desktop-dark.png` });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${OUT}/11-dashboard-mobile-dark.png` });
await page.goto(BASE + '#/settings');
await page.getByRole('button', { name: 'فاتح' }).click();
log('لقطات الحاسوب والوضع الداكن');

// ── العمل دون اتصال
await page.goto(BASE + '#/');
await page.evaluate(() => navigator.serviceWorker.ready);
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller);
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('text=آخر الحركات');
await ctx.setOffline(false);
log('تعمل الشاشة الرئيسية دون اتصال بعد التحميل الأول');

await browser.close();
const relevant = errors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
if (relevant.length) { console.error('أخطاء console:', relevant); process.exit(1); }
log('لا أخطاء في console');
