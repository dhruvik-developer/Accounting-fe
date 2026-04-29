import {
  ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { Alert, AlertColor, Snackbar } from '@mui/material';

type AppNotification = {
  message: string;
  severity?: AlertColor;
  autoHideDuration?: number;
};

export type NotificationRecord = {
  id: string;
  message: string;
  severity: AlertColor;
  at: number;
  read: boolean;
};

const EVENT_NAME = 'app-notification';
const STORAGE_KEY = 'vyaparpro:notifications:v1';
const HISTORY_LIMIT = 50;

export function notify(input: string | AppNotification) {
  if (typeof window === 'undefined') return;
  const detail = typeof input === 'string' ? { message: input } : input;
  window.dispatchEvent(new CustomEvent<AppNotification>(EVENT_NAME, { detail }));
}

type NotificationsContextValue = {
  history: NotificationRecord[];
  unread: number;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    // Sensible fallback for trees that don't have the provider (e.g. auth pages).
    return { history: [], unread: 0, markAllRead: () => {}, remove: () => {}, clear: () => {} };
  }
  return ctx;
}

function loadHistory(): NotificationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function persistHistory(items: NotificationRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
  } catch { /* quota exceeded — ignore */ }
}

export function NotifierProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<NotificationRecord[]>(() => loadHistory());

  const current = queue[0] || null;

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AppNotification>).detail;
      if (!detail?.message) return;
      const enriched: AppNotification = { severity: 'info', autoHideDuration: 3500, ...detail };
      setQueue((items) => [...items, enriched]);
      setHistory((items) => {
        const next: NotificationRecord[] = [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            message: enriched.message,
            severity: enriched.severity || 'info',
            at: Date.now(),
            read: false,
          },
          ...items,
        ].slice(0, HISTORY_LIMIT);
        persistHistory(next);
        return next;
      });
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  useEffect(() => {
    setOpen(!!current);
  }, [current]);

  const close = useCallback(() => setOpen(false), []);
  const next = useCallback(() => {
    setQueue((items) => items.slice(1));
  }, []);

  const markAllRead = useCallback(() => {
    setHistory((items) => {
      const updated = items.map((n) => (n.read ? n : { ...n, read: true }));
      persistHistory(updated);
      return updated;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setHistory((items) => {
      const updated = items.filter((n) => n.id !== id);
      persistHistory(updated);
      return updated;
    });
  }, []);

  const clear = useCallback(() => {
    persistHistory([]);
    setHistory([]);
  }, []);

  const ctxValue = useMemo<NotificationsContextValue>(() => ({
    history,
    unread: history.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
    markAllRead,
    remove,
    clear,
  }), [history, markAllRead, remove, clear]);

  const alert = useMemo(() => {
    if (!current) return null;
    return (
      <Alert
        elevation={6}
        variant="filled"
        severity={current.severity || 'info'}
        onClose={close}
        sx={{ width: '100%' }}
      >
        {current.message}
      </Alert>
    );
  }, [close, current]);

  return (
    <NotificationsContext.Provider value={ctxValue}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={current?.autoHideDuration ?? 3500}
        onClose={close}
        TransitionProps={{ onExited: next }}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {alert || undefined}
      </Snackbar>
    </NotificationsContext.Provider>
  );
}
