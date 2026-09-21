import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { BudgetAlert } from '../types';
import { useAuth } from './AuthContext';

interface AlertState {
  connected: boolean;
  alerts: BudgetAlert[];
  toasts: BudgetAlert[];
  dismiss: (alert: BudgetAlert) => void;
  dismissToast: (threshold: number) => void;
}

const AlertContext = createContext<AlertState | null>(null);

function alertKey(alert: BudgetAlert) {
  return `${alert.month}:${alert.threshold}`;
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [toasts, setToasts] = useState<BudgetAlert[]>([]);

  const upsertAlert = useCallback((incoming: BudgetAlert) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => alertKey(a) !== alertKey(incoming));
      return [...next, incoming].sort((a, b) => a.threshold - b.threshold);
    });
    setToasts((prev) => {
      if (prev.some((a) => alertKey(a) === alertKey(incoming))) return prev;
      return [...prev, incoming];
    });
  }, []);

  useEffect(() => {
    if (!user) {
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
      setAlerts([]);
      setToasts([]);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Client -> server: subscribe. The server re-evaluates current-month
      // thresholds and pushes any unacknowledged alerts.
      ws.send(JSON.stringify({ type: 'subscribe' }));
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string);
        if (msg.type === 'budget_alert') upsertAlert(msg as BudgetAlert);
      } catch {
        // ignore malformed frames
      }
    };

    return () => {
      ws.close();
    };
  }, [user, upsertAlert]);

  const dismiss = (alert: BudgetAlert) => {
    wsRef.current?.send(
      JSON.stringify({ type: 'ack', month: alert.month, threshold: alert.threshold })
    );
    setAlerts((prev) => prev.filter((a) => alertKey(a) !== alertKey(alert)));
    setToasts((prev) => prev.filter((a) => alertKey(a) !== alertKey(alert)));
  };

  const dismissToast = (threshold: number) => {
    setToasts((prev) => prev.filter((a) => a.threshold !== threshold));
  };

  const value = useMemo(
    () => ({ connected, alerts, toasts, dismiss, dismissToast }),
    [connected, alerts, toasts]
  );

  return createElement(AlertContext.Provider, { value }, children);
}

export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertProvider');
  return ctx;
}
