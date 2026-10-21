import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '../db/db';
import { addSection, deleteSection, updateSection, ValidationError } from '../db/repo';
import type { Section } from '../db/types';
import { toDigits } from '../lib/dates';
import { useSections } from '../state/queries';
import { useSettings } from '../state/settings';
import { useToast } from '../state/toast';
import { CATEGORY_COLORS, CategoryIcon } from './CategoryIcon';
import { ConfirmDialog, Sheet } from './Sheet';

const SECTION_ICONS = ['home', 'briefcase', 'car', 'graduation-cap', 'baby', 'store', 'plane', 'heart-pulse', 'piggy-bank', 'wallet'];

export function SectionManager() {
  const sections = useSections() ?? [];
  const usage = useLiveQuery(async () => {
    const keys = (await db.transactions.orderBy('sectionId').keys()) as string[];
    const m = new Map<string, number>();
    for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  }, []) ?? new Map<string, number>();
  const { settings } = useSettings();
  const toast = useToast();
  const [editing, setEditing] = useState<Section | 'new' | null>(null);
  const [toDelete, setToDelete] = useState<Section | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast(ok); return true; }
    catch (e) { toast(e instanceof ValidationError ? e.message : 'تعذر تنفيذ العملية', { kind: 'error' }); return false; }
  };

  return (
    <div>
      <p className="muted mb-3 text-sm leading-6">
        الأقسام تفصل حركاتك حسب الجهة، مثل المنزل أو العمل، فتعرض إجماليات كل قسم وتقاريره وحده. اختيار القسم عند الإضافة اختياري.
      </p>
      <ul className="divide-y rounded-xl border line [&>li]:border-[var(--line)]">
        {sections.map((x) => {
          const used = usage.get(x.id) ?? 0;
          return (
            <li key={x.id} className={`flex items-center gap-3 px-3 py-2.5 ${x.isActive ? '' : 'opacity-60'}`}>
              <CategoryIcon icon={x.icon} color={x.color} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{x.name}</div>
                <div className="muted text-xs">{used ? `${toDigits(used, settings.numerals)} حركة` : 'غير مستخدم'}{!x.isActive && ' · معطّل'}</div>
              </div>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  role="switch"
                  className="h-4 w-4 accent-[#14866D]"
                  checked={x.isActive}
                  onChange={(e) => run(() => updateSection(x.id, { isActive: e.target.checked }), e.target.checked ? 'تم تفعيل القسم' : 'تم تعطيل القسم')}
                  aria-label={`${x.isActive ? 'تعطيل' : 'تفعيل'} ${x.name}`}
                />
                <span className="hidden sm:inline">مفعّل</span>
              </label>
              <button className="btn-ghost !min-h-[2.25rem] !px-2" onClick={() => setEditing(x)} aria-label={`تعديل ${x.name}`}><Pencil className="h-4 w-4" /></button>
              {!used && (
                <button className="btn-ghost !min-h-[2.25rem] !px-2 text-expense" onClick={() => setToDelete(x)} aria-label={`حذف ${x.name}`}><Trash2 className="h-4 w-4" /></button>
              )}
            </li>
          );
        })}
        {sections.length === 0 && <li className="muted px-3 py-4 text-center text-sm">لا توجد أقسام بعد.</li>}
      </ul>
      <button className="btn-outline mt-3 w-full" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> قسم جديد</button>

      {editing && (
        <SectionEditor
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            const ok = editing === 'new'
              ? await run(() => addSection(v), 'تمت إضافة القسم')
              : await run(() => updateSection(editing.id, v), 'تم حفظ القسم');
            if (ok) setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!toDelete}
        title="حذف القسم"
        message={<>هل تريد حذف القسم «{toDelete?.name}»؟</>}
        confirmLabel="حذف"
        danger
        onClose={() => setToDelete(null)}
        onConfirm={async () => { if (toDelete && (await run(() => deleteSection(toDelete.id), 'تم حذف القسم'))) setToDelete(null); }}
      />
    </div>
  );
}

function SectionEditor({ initial, onClose, onSave }: {
  initial: Section | null; onClose: () => void; onSave: (v: { name: string; icon: string; color: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? 'home');
  const [color, setColor] = useState(initial?.color ?? CATEGORY_COLORS[1]);
  return (
    <Sheet
      open
      onClose={onClose}
      title={initial ? 'تعديل القسم' : 'قسم جديد'}
      footer={<><button className="btn-primary flex-1" onClick={() => onSave({ name, icon, color })}>حفظ</button><button className="btn-outline flex-1" onClick={onClose}>إلغاء</button></>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <CategoryIcon icon={icon} color={color} size="lg" />
          <label className="flex-1">
            <span className="label">اسم القسم</span>
            <input id="section-name" className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} placeholder="مثال: السيارة، الدراسة" autoFocus />
          </label>
        </div>
        <fieldset>
          <legend className="label">الأيقونة</legend>
          <div className="flex flex-wrap gap-2">
            {SECTION_ICONS.map((k) => (
              <button key={k} type="button" onClick={() => setIcon(k)} aria-pressed={icon === k} aria-label={k}
                className={`rounded-xl border p-1 ${icon === k ? 'border-ink ring-2 ring-ink/20 dark:border-[#7FC4D6]' : 'line'}`}>
                <CategoryIcon icon={k} color={color} size="sm" />
              </button>
            ))}
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
