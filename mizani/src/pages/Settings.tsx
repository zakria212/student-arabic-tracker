import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, DatabaseBackup, Download, HardDrive, Loader2, Palette, ShieldCheck, Tags, Trash2, Upload, Coins } from 'lucide-react';
import { CategoryManager } from '../components/CategoryManager';
import { ConfirmDialog, Sheet } from '../components/Sheet';
import { updateSettings, wipeAllData } from '../db/repo';
import type { Theme } from '../db/types';
import { applyBackup, BackupError, createBackup, parseBackup, type ImportMode, type ParsedBackup } from '../domain/backup';
import { CURRENCIES, getCurrency } from '../lib/currencies';
import { formatDateAr, toDigits } from '../lib/dates';
import { downloadBlob } from '../lib/download';
import { formatBytes } from '../lib/image';
import { useTransactionCount } from '../state/queries';
import { useSettings } from '../state/settings';
import { useToast } from '../state/toast';

function Section({ icon, title, children, id }: { icon: ReactNode; title: string; children: ReactNode; id?: string }) {
  return (
    <section className="card p-4 sm:p-5" aria-labelledby={id}>
      <h2 id={id} className="mb-4 flex items-center gap-2 text-base font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink/10 text-ink-adaptive dark:bg-white/10">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { settings, currency } = useSettings();
  const toast = useToast();
  const txCount = useTransactionCount() ?? 0;
  const n = (x: number | string) => toDigits(x, settings.numerals);

  // العملة
  const [pendingCurrency, setPendingCurrency] = useState<string | null>(null);
  const onCurrency = (code: string) => {
    if (code === settings.currency) return;
    if (txCount > 0) setPendingCurrency(code);
    else updateSettings({ currency: code }).then(() => toast('تم تغيير العملة'));
  };

  // النسخ الاحتياطي
  const [exporting, setExporting] = useState(false);
  const onExport = async () => {
    setExporting(true);
    try {
      const { bytes, filename, counts } = await createBackup();
      downloadBlob(new Blob([bytes], { type: 'application/zip' }), filename);
      await updateSettings({ lastBackupAt: new Date().toISOString() });
      toast(`تم إنشاء النسخة الاحتياطية (${n(counts.transactions)} حركة، ${n(counts.receipts)} مرفق)`);
    } catch {
      toast('تعذر إنشاء النسخة الاحتياطية', { kind: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const onPickBackup = async (f: File | undefined) => {
    if (!f) return;
    setParsing(true);
    try {
      setParsed(await parseBackup(await f.arrayBuffer()));
    } catch (e) {
      toast(e instanceof BackupError ? e.message : 'تعذرت قراءة الملف', { kind: 'error' });
    } finally {
      setParsing(false);
    }
  };

  // مسح البيانات
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState('');
  const [wiping, setWiping] = useState(false);

  // التخزين
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean }>({});
  const refreshStorage = async () => {
    try {
      const est = await navigator.storage?.estimate?.();
      const persisted = await navigator.storage?.persisted?.();
      setStorage({ usage: est?.usage, quota: est?.quota, persisted });
    } catch { /* غير مدعوم */ }
  };
  useEffect(() => { refreshStorage(); }, []);
  const requestPersist = async () => {
    const ok = await navigator.storage?.persist?.();
    toast(ok ? 'سيحاول المتصفح الاحتفاظ ببياناتك وعدم حذفها تلقائيًا' : 'لم يوافق المتصفح على التخزين الدائم حاليًا', { kind: ok ? 'success' : 'info' });
    refreshStorage();
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">الإعدادات</h1>

      <Section icon={<Palette className="h-4 w-4" />} title="المظهر" id="s-look">
        <div className="space-y-4">
          <div>
            <span className="label">السمة</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="السمة">
              {([['light', 'فاتح'], ['dark', 'داكن'], ['system', 'حسب الجهاز']] as [Theme, string][]).map(([v, l]) => (
                <button key={v} className="chip" aria-pressed={settings.theme === v} onClick={() => updateSettings({ theme: v })}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="label">شكل الأرقام</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="شكل الأرقام">
              <button className="chip" aria-pressed={settings.numerals === 'latn'} onClick={() => updateSettings({ numerals: 'latn' })}>1,234.50</button>
              <button className="chip" aria-pressed={settings.numerals === 'arab'} onClick={() => updateSettings({ numerals: 'arab' })}>١٬٢٣٤٫٥٠</button>
            </div>
          </div>
        </div>
      </Section>

      <Section icon={<Coins className="h-4 w-4" />} title="العملة" id="s-cur">
        <label>
          <span className="label">عملة السجل</span>
          <select className="field" value={settings.currency} onChange={(e) => onCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>)}
          </select>
        </label>
        <p className="muted mt-2 text-xs leading-5">تُستخدم عملة واحدة لكامل السجل. تغيير العملة يغيّر الرمز المعروض فقط ولا يحوّل المبالغ بأسعار الصرف.</p>
      </Section>

      <Section icon={<Tags className="h-4 w-4" />} title="التصنيفات" id="s-cat">
        <CategoryManager />
      </Section>

      <Section icon={<DatabaseBackup className="h-4 w-4" />} title="النسخ الاحتياطي والاستعادة" id="s-backup">
        <div className="mb-4 flex gap-3 rounded-xl bg-gold-soft p-3 text-sm leading-6 text-[#5C4313] dark:bg-[#2a2516] dark:text-[#F3CF8E]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            بياناتك محفوظة في هذا المتصفح على هذا الجهاز فقط، <b>ولا تتزامن مع أجهزة أخرى</b>. حذف بيانات المتصفح أو فقد الجهاز قد يؤدي إلى فقد سجلاتك
            إن لم تحتفظ بنسخة احتياطية.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn-primary" onClick={onExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} تنزيل نسخة احتياطية (ZIP)
          </button>
          <button className="btn-outline" onClick={() => fileRef.current?.click()} disabled={parsing}>
            {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} استعادة من نسخة
          </button>
          <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => { onPickBackup(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        <p className="muted mt-2 text-xs">
          {settings.lastBackupAt ? `آخر نسخة احتياطية: ${formatDateAr(settings.lastBackupAt.slice(0, 10), settings.numerals)}` : 'لم تُنشئ نسخة احتياطية بعد.'}
          {' '}تتضمن النسخة الحركات والتصنيفات والإعدادات وصور الإيصالات.
        </p>
      </Section>

      <Section icon={<HardDrive className="h-4 w-4" />} title="التخزين والخصوصية" id="s-storage">
        <ul className="space-y-2 text-sm leading-6">
          <li className="flex gap-2"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-income" /> لا يرسل التطبيق بياناتك أو صورك إلى أي خادم أو خدمة تحليلات، ولا يتطلب حسابًا.</li>
          <li className="flex gap-2"><ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-income" /> يعمل دون إنترنت بعد أول تحميل.</li>
        </ul>
        <div className="mt-3 rounded-xl p-3 text-sm surface-2">
          <div>عدد الحركات: <b className="num">{n(txCount)}</b></div>
          {storage.usage !== undefined && <div>المساحة المستخدمة تقريبًا: <span className="num">{formatBytes(storage.usage)}</span></div>}
          {storage.persisted !== undefined && (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              التخزين الدائم: {storage.persisted ? <b className="text-income">مفعّل</b> : <span>غير مفعّل</span>}
              {!storage.persisted && <button className="btn-outline !min-h-[2rem] !px-3 text-xs" onClick={requestPersist}>طلب التخزين الدائم</button>}
            </div>
          )}
        </div>
      </Section>

      <section className="card border-expense/40 p-4 sm:p-5">
        <h2 className="mb-2 flex items-center gap-2 text-base font-bold text-expense"><Trash2 className="h-4 w-4" /> مسح جميع البيانات</h2>
        <p className="muted mb-3 text-sm leading-6">يحذف كل الحركات والمرفقات والتصنيفات المخصصة من هذا الجهاز نهائيًا. أنشئ نسخة احتياطية أولًا.</p>
        <button className="btn-outline !text-expense" onClick={() => { setWipeText(''); setWipeOpen(true); }}>مسح جميع البيانات…</button>
      </section>

      <p className="muted pb-4 text-center text-xs">ميزاني · الإصدار 1.0 · العملة الحالية: {currency.name}</p>

      <ConfirmDialog
        open={!!pendingCurrency}
        title="تغيير العملة"
        message={
          <>
            لديك <b>{n(txCount)}</b> حركة محفوظة. تغيير العملة من <b>{currency.name}</b> إلى <b>{pendingCurrency && getCurrency(pendingCurrency).name}</b>
            {' '}<b>لن يحوّل المبالغ بأسعار الصرف</b>؛ ستبقى الأرقام كما هي ويتغير رمز العملة فقط.
          </>
        }
        confirmLabel="تغيير الرمز فقط"
        onClose={() => setPendingCurrency(null)}
        onConfirm={async () => {
          await updateSettings({ currency: pendingCurrency! });
          setPendingCurrency(null);
          toast('تم تغيير العملة');
        }}
      />

      {parsed && <ImportDialog parsed={parsed} onClose={() => setParsed(null)} />}

      <ConfirmDialog
        open={wipeOpen}
        title="تأكيد مسح جميع البيانات"
        danger
        busy={wiping}
        confirmDisabled={wipeText.trim() !== 'احذف'}
        message={<>لا يمكن التراجع عن هذه العملية. سيتم حذف <b>{n(txCount)}</b> حركة وجميع المرفقات.</>}
        confirmLabel="مسح نهائي"
        onClose={() => setWipeOpen(false)}
        onConfirm={async () => {
          setWiping(true);
          try { await wipeAllData(); toast('تم مسح جميع البيانات'); setWipeOpen(false); }
          catch { toast('تعذر مسح البيانات', { kind: 'error' }); }
          finally { setWiping(false); }
        }}
      >
        <label className="mt-4 block">
          <span className="label">اكتب كلمة «احذف» للتأكيد</span>
          <input className="field" value={wipeText} onChange={(e) => setWipeText(e.target.value)} autoComplete="off" />
        </label>
      </ConfirmDialog>
    </div>
  );
}

function ImportDialog({ parsed, onClose }: { parsed: ParsedBackup; onClose: () => void }) {
  const { settings } = useSettings();
  const toast = useToast();
  const [mode, setMode] = useState<ImportMode>('merge');
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const p = parsed.preview;
  const n = (x: number | string) => toDigits(x, settings.numerals);

  const apply = async () => {
    setBusy(true);
    try {
      const r = await applyBackup(parsed, mode);
      toast(
        mode === 'replace'
          ? `تمت الاستعادة: ${n(r.addedTransactions)} حركة و${n(r.addedReceipts)} مرفق`
          : `تم الدمج: أضيفت ${n(r.addedTransactions)} حركة، وتُجوهلت ${n(r.skippedTransactions)} موجودة مسبقًا`,
      );
      onClose();
    } catch (e) {
      toast(e instanceof BackupError ? e.message : 'فشلت الاستعادة ولم تتغير بياناتك', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="استعادة نسخة احتياطية"
      footer={
        <>
          <button className={`${mode === 'replace' ? 'btn-danger' : 'btn-primary'} flex-1`} onClick={apply} disabled={busy || (mode === 'replace' && !confirmReplace)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'replace' ? 'استبدال البيانات' : 'دمج البيانات'}
          </button>
          <button className="btn-outline flex-1" onClick={onClose} disabled={busy}>إلغاء</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['حركة', p.transactions], ['مرفق', p.receipts], ['تصنيف', p.categories]].map(([l, v]) => (
            <div key={l as string} className="rounded-xl p-3 surface-2">
              <div className="num font-display text-xl font-bold">{n(v as number)}</div>
              <div className="muted text-xs">{l}</div>
            </div>
          ))}
        </div>
        <p className="muted text-xs leading-5">
          أُنشئت في {formatDateAr(p.exportedAt.slice(0, 10), settings.numerals)}
          {p.range && <> · الحركات من {formatDateAr(p.range.start, settings.numerals)} إلى {formatDateAr(p.range.end, settings.numerals)}</>}
          {' '}· العملة: {getCurrency(p.currency).name}
        </p>

        <fieldset className="space-y-2">
          <legend className="label">طريقة الاستعادة</legend>
          <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${mode === 'merge' ? 'border-ink dark:border-[#7FC4D6]' : 'line'}`}>
            <input type="radio" name="mode" className="mt-1 accent-[#123B49]" checked={mode === 'merge'} onChange={() => setMode('merge')} />
            <span><b>دمج البيانات</b><span className="muted block text-xs leading-5">يضيف الحركات غير الموجودة فقط دون تكرار المعرّفات، ولا يغيّر سجلاتك الحالية.</span></span>
          </label>
          <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${mode === 'replace' ? 'border-expense' : 'line'}`}>
            <input type="radio" name="mode" className="mt-1 accent-[#C94E55]" checked={mode === 'replace'} onChange={() => setMode('replace')} />
            <span><b>استبدال البيانات</b><span className="muted block text-xs leading-5">يحذف كل بياناتك الحالية ويضع محتوى النسخة مكانها.</span></span>
          </label>
        </fieldset>
        {mode === 'replace' && (
          <label className="flex cursor-pointer items-start gap-2 rounded-xl bg-expense-soft p-3 text-sm text-expense dark:bg-[#3a1d20] dark:text-[#EE8C92]">
            <input type="checkbox" className="mt-1 accent-[#C94E55]" checked={confirmReplace} onChange={(e) => setConfirmReplace(e.target.checked)} />
            أفهم أن بياناتي الحالية ستُحذف ويُستبدل بها محتوى النسخة الاحتياطية.
          </label>
        )}
      </div>
    </Sheet>
  );
}
