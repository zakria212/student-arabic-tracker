import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '../db/db';
import { addCategory, deleteCategory, updateCategory, ValidationError } from '../db/repo';
import type { Category, TransactionType } from '../db/types';
import { toDigits } from '../lib/dates';
import { useCategories } from '../state/queries';
import { useSettings } from '../state/settings';
import { useToast } from '../state/toast';
import { CATEGORY_COLORS, CategoryIcon, ICONS } from './CategoryIcon';
import { ConfirmDialog, Sheet } from './Sheet';

export function CategoryManager() {
  const [type, setType] = useState<TransactionType>('expense');
  const categories = useCategories() ?? [];
  const usage = useLiveQuery(async () => {
    const keys = (await db.transactions.orderBy('categoryId').keys()) as string[];
    const m = new Map<string, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, []) ?? new Map<string, number>();
  const { settings } = useSettings();
  const toast = useToast();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Category | null>(null);

  const list = categories.filter((c) => c.type === type);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok); return true; }
    catch (e) { toast(e instanceof ValidationError ? e.message : 'تعذر تنفيذ العملية', { kind: 'error' }); return false; }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2" role="group" aria-label="نوع التصنيفات">
          <button className="chip" aria-pressed={type === 'expense'} onClick={() => setType('expense')}>المصروفات</button>
          <button className="chip" aria-pressed={type === 'income'} onClick={() => setType('income')}>الدخل</button>
        </div>
        <button className="btn-outline !min-h-[2.25rem] text-sm" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> تصنيف جديد</button>
      </div>
      <ul className="divide-y rounded-xl border line [&>li]:border-[var(--line)]">
        {list.map((c) => {
          const used = usage.get(c.id) ?? 0;
          return (
            <li key={c.id} className={`flex items-center gap-3 px-3 py-2.5 ${c.isActive ? '' : 'opacity-60'}`}>
              <CategoryIcon icon={c.icon} color={c.color} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.name}</div>
                <div className="muted text-xs">{used ? `${toDigits(used, settings.numerals)} حركة` : 'غير مستخدم'}{!c.isActive && ' · معطّل'}</div>
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs" title={c.isActive ? 'تعطيل' : 'تفعيل'}>
                <input
                  type="checkbox"
                  role="switch"
                  className="h-4 w-4 accent-[#14866D]"
                  checked={c.isActive}
                  onChange={(e) => run(() => updateCategory(c.id, { isActive: e.target.checked }), e.target.checked ? 'تم تفعيل التصنيف' : 'تم تعطيل التصنيف')}
                  aria-label={`${c.isActive ? 'تعطيل' : 'تفعيل'} ${c.name}`}
                />
                <span className="hidden sm:inline">مفعّل</span>
              </label>
              <button className="btn-ghost !min-h-[2.25rem] !px-2" onClick={() => setEditing(c)} aria-label={`تعديل ${c.name}`}><Pencil className="h-4 w-4" /></button>
              {!used && (
                <button className="btn-ghost !min-h-[2.25rem] !px-2 text-expense" onClick={() => setToDelete(c)} aria-label={`حذف ${c.name}`}><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="muted mt-2 text-xs leading-5">التصنيفات المستخدمة في حركات سابقة لا تُحذف حفاظًا على السجل، ويمكن تعطيلها لإخفائها من نموذج الإضافة.</p>

      {editing && (
        <CategoryEditor
          initial={editing === 'new' ? null : editing}
          type={type}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            const ok = editing === 'new'
              ? await run(() => addCategory({ ...v, type }), 'تمت إضافة التصنيف')
              : await run(() => updateCategory(editing.id, v), 'تم حفظ التصنيف');
            if (ok) setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="حذف التصنيف"
        message={<>هل تريد حذف التصنيف «{toDelete?.name}»؟</>}
        confirmLabel="حذف"
        danger
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete && (await run(() => deleteCategory(toDelete.id), 'تم حذف التصنيف'))) setToDelete(null); }}
      />
    </div>
  );
}

function CategoryEditor({ initial, type, onClose, onSave }: {
  initial: Category | null; type: TransactionType; onClose: () => void;
  onSave: (v: { name: string; icon: string; color: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? (type === 'expense' ? 'cart' : 'wallet'));
  const [color, setColor] = useState(initial?.color ?? CATEGORY_COLORS[0]);
  return (
    <Sheet
      open
      onClose={onClose}
      title={initial ? 'تعديل التصنيف' : `تصنيف ${type === 'expense' ? 'مصروفات' : 'دخل'} جديد`}
      footer={<><button className="btn-primary flex-1" onClick={() => onSave({ name, icon, color })}>حفظ</button><button className="btn-outline flex-1" onClick={onClose}>إلغاء</button></>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CategoryIcon icon={icon} color={color} size="lg" />
          <label className="flex-1">
            <span className="label">اسم التصنيف</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
          </label>
        </div>
        <fieldset>
          <legend className="label">الأيقونة</legend>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {Object.keys(ICONS).map((k) => {
              const I = ICONS[k];
              return (
                <button key={k} type="button" onClick={() => setIcon(k)} aria-pressed={icon === k} aria-label={k}
                  className={`flex aspect-square items-center justify-center rounded-xl border ${icon === k ? 'border-ink ring-2 ring-ink/20 dark:border-[#7FC4D6]' : 'line'}`}>
                  <I className="h-5 w-5" strokeWidth={1.8} />
                </button>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">اللون</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setColor(c)} aria-pressed={color === c} aria-label={`اللون ${c}`}
                className={`h-9 w-9 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-ink dark:ring-offset-[#13252C]' : ''}`} style={{ background: c }} />
            ))}
          </div>
        </fieldset>
      </div>
    </Sheet>
  );
}
