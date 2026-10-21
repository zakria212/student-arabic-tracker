import { useEffect } from 'react';
import { usePeriod } from '../state/period';
import { useSections } from '../state/queries';

/** شريط اختيار القسم (المنزل، العمل…) المشترك بين الصفحات */
export function SectionChips() {
  const sections = useSections();
  const { section, setSection } = usePeriod();
  const visible = (sections ?? []).filter((s) => s.isActive || s.id === section);

  // إن حُذف القسم المختار نعود إلى «الكل»
  useEffect(() => {
    if (sections && section !== 'all' && section !== 'none' && !sections.some((s) => s.id === section)) setSection('all');
  }, [sections, section, setSection]);

  if (!sections || visible.length === 0) return null;
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0" role="group" aria-label="القسم">
      <div className="flex w-max gap-2">
        <button className="chip" aria-pressed={section === 'all'} onClick={() => setSection('all')}>كل الأقسام</button>
        {visible.map((s) => (
          <button key={s.id} className="chip" aria-pressed={section === s.id} onClick={() => setSection(s.id)}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.name}
          </button>
        ))}
        <button className="chip" aria-pressed={section === 'none'} onClick={() => setSection('none')}>بدون قسم</button>
      </div>
    </div>
  );
}
