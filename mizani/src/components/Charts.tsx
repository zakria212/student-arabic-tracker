import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import type { Bucket, CategoryShare } from '../domain/reports';
import { formatMinor, formatPercent } from '../lib/money';
import { toDigits } from '../lib/dates';
import { useSettings } from '../state/settings';
import { CategoryIcon } from './CategoryIcon';
import { Money } from './Money';

// زوج الدخل/المصروف: يُميَّز أيضًا بالنقش المائل والوسيلة الإيضاحية والنص، لا باللون وحده
const INCOME = '#14866D';
const EXPENSE = '#C94E55';

/** توزيع المصروفات حسب التصنيف كأشرطة أفقية بأسماء وقيم مباشرة */
export function CategoryBars({ data, limit = 6 }: { data: CategoryShare[]; limit?: number }) {
  const { settings } = useSettings();
  let rows = data;
  if (data.length > limit) {
    const rest = data.slice(limit - 1);
    rows = [
      ...data.slice(0, limit - 1),
      {
        categoryId: '__rest',
        name: `تصنيفات أخرى (${toDigits(rest.length, settings.numerals)})`,
        color: '#8A979C',
        icon: 'circle-ellipsis',
        totalMinor: rest.reduce((s, r) => s + r.totalMinor, 0),
        count: rest.reduce((s, r) => s + r.count, 0),
        share: rest.reduce((s, r) => s + r.share, 0),
      },
    ];
  }
  const max = Math.max(...rows.map((r) => r.share), 0.0001);
  return (
    <ul className="space-y-3.5">
      {rows.map((r) => (
        <li key={r.categoryId} className="flex items-center gap-3">
          <CategoryIcon icon={r.icon} color={r.color} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{r.name}</span>
              <span className="flex shrink-0 items-baseline gap-2">
                <Money minor={r.totalMinor} className="font-semibold" />
                <span className="muted num w-12 text-end text-xs">{formatPercent(r.share, settings.numerals)}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full surface-2" role="presentation">
              <div className="h-full rounded-full" style={{ width: `${(r.share / max) * 100}%`, background: r.color }} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TrendTooltip({ active, payload }: TooltipProps<number, string>) {
  const { settings } = useSettings();
  if (!active || !payload?.length) return null;
  const b = payload[0].payload as Bucket & { incomeMinor: number; expenseMinor: number };
  const range = b.start === b.end ? b.start : `${b.start} → ${b.end}`;
  return (
    <div className="card px-3 py-2 text-xs leading-6" dir="rtl">
      <div className="muted num">{toDigits(range, settings.numerals)}</div>
      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: INCOME }} />الدخل: <Money minor={b.incomeMinor} /></div>
      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: EXPENSE }} />المصروفات: <Money minor={b.expenseMinor} /></div>
    </div>
  );
}

/** الدخل والمصروفات عبر الأيام/الأسابيع/الشهور. المحور معكوس ليتدفق الزمن من اليمين لليسار */
export function TrendChart({ data, height = 220 }: { data: Bucket[]; height?: number }) {
  const { settings } = useSettings();
  const rows = data.map((b) => ({ ...b, income: b.incomeMinor / 100, expense: b.expenseMinor / 100 }));
  const tick = { fill: 'var(--muted)', fontSize: 11 };
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: INCOME }} />الدخل</span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="12" height="12"><rect width="12" height="12" rx="2" fill="url(#hatch-expense)" /></svg>المصروفات
        </span>
      </div>
      <div style={{ height }} dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: 4, bottom: 0 }} barGap={2} barCategoryGap="22%">
            <defs>
              <pattern id="hatch-expense" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
                <rect width="5" height="5" fill={EXPENSE} />
                <line x1="0" y1="0" x2="0" y2="5" stroke="#fff" strokeOpacity=".35" strokeWidth="1.6" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="label" reversed tick={tick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12}
              tickFormatter={(v: string) => toDigits(v, settings.numerals)} />
            <YAxis orientation="right" tick={tick} tickLine={false} axisLine={false} width={46}
              tickFormatter={(v: number) => formatMinor(Math.round(v * 100), settings.numerals, { compact: true })} />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="income" name="الدخل" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="expense" name="المصروفات" fill="url(#hatch-expense)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
