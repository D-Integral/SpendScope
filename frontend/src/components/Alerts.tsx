import { Bell, BellOff, X } from 'lucide-react';
import { formatPercent } from '../lib/format';
import { useAlerts } from '../context/AlertContext';

function tone(threshold: number) {
  if (threshold >= 100) return 'border-red-200 bg-red-50 text-red-800';
  if (threshold >= 80) return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-teal-200 bg-teal-50 text-teal-900';
}

export function AlertBanner() {
  const { alerts, connected, dismiss } = useAlerts();
  const latest = [...alerts].sort((a, b) => b.threshold - a.threshold)[0];
  if (!latest) return null;

  return (
    <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${tone(latest.threshold)}`}>
      <Bell className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{latest.message}</p>
        <p className="text-xs opacity-80">
          {formatPercent(latest.usagePercent)} used · {connected ? 'Live' : 'Reconnecting…'}
        </p>
      </div>
      <button type="button" className="rounded-full p-1 hover:bg-black/5" onClick={() => dismiss(latest)}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AlertToasts() {
  const { toasts, dismissToast, dismiss } = useAlerts();
  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-[min(100%-2rem,22rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={`${toast.month}-${toast.threshold}`}
          className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg ${tone(toast.threshold)}`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold">{toast.message}</p>
            <button
              type="button"
              aria-label="Dismiss alert"
              className="rounded-full p-1 hover:bg-black/5"
              onClick={() => {
                dismissToast(toast.threshold);
                dismiss(toast);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConnectionPill() {
  const { connected } = useAlerts();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        connected ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-ink-muted'
      }`}
    >
      {connected ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
      {connected ? 'Alerts live' : 'Alerts offline'}
    </span>
  );
}
