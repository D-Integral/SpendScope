import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, monthLabel } from '../lib/format';

export function MonthPicker({
  month,
  onChange,
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        className="btn-ghost h-9 w-9 rounded-xl p-0"
        aria-label="Previous month"
        onClick={() => onChange(addMonths(month, -1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="min-w-[10rem] text-center text-sm font-semibold">{monthLabel(month)}</p>
      <button
        type="button"
        className="btn-ghost h-9 w-9 rounded-xl p-0"
        aria-label="Next month"
        onClick={() => onChange(addMonths(month, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
