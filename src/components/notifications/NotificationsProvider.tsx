'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { supabaseEnabled } from '@/lib/supabase/config';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { refreshSubscription, registerWorker } from '@/lib/push/client';
import { playChime, unlockSound } from '@/lib/push/sound';

export interface AppNotification {
  id: string;
  kind: 'overdue' | 'test';
  taskId: string | null;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
}

/** A push the service worker passed to this page. */
export type PushMessage = { id: string; kind: string; title: string; body: string; url: string };

interface Notifications {
  /** False in local mode (no account, so nothing to notify about across devices) */
  available: boolean;
  loaded: boolean;
  /** False when the notifications table does not exist yet (migration not run) */
  ready: boolean;
  /** Loaded only once the list is asked for (`showList`); until then just the unread count is fetched. */
  items: AppNotification[];
  unread: number;
  /** Starts loading the full list (the Notifications page). */
  showList: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  /** Listen for pushes arriving on this device while Taske is open. Returns an unsubscribe. */
  onPush: (fn: (m: PushMessage) => void) => () => void;
}

const Ctx = createContext<Notifications | null>(null);
export function useNotifications() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNotifications must be used inside NotificationsProvider');
  return v;
}

const fromRow = (r: Record<string, unknown>): AppNotification => ({
  id: String(r.id),
  kind: r.kind === 'test' ? 'test' : 'overdue',
  taskId: typeof r.task_id === 'string' ? r.task_id : null,
  title: String(r.title ?? ''),
  body: String(r.body ?? ''),
  createdAt: Date.parse(String(r.created_at)) || 0,
  read: Boolean(r.read_at),
});

/**
 * Notifications for the signed-in user: the list on the Notifications page, the unread count in the
 * navigation, and Taske's own sound + toast when one arrives while the app is open (from a push via
 * the service worker, or from the database's live updates on devices without push).
 */
export default function NotificationsProvider({ children }: { children: ReactNode }) {
  const { account, toast } = useWorkspace();
  const router = useRouter();
  const available = supabaseEnabled;
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(true);
  /** Unread count, used until the full list is loaded */
  const [count, setCount] = useState(0);
  const [listOn, setListOn] = useState(false);
  const listWanted = useRef(false);
  const listeners = useRef(new Set<(m: PushMessage) => void>());
  /** Ids already announced with sound, so a push and the live update for the same row chime once. */
  const announced = useRef(new Set<string>());

  const load = useCallback(async () => {
    if (!available) return;
    const sb = getBrowserSupabase();
    if (!listWanted.current) {
      // Nothing on screen needs the list yet: just count the unread ones (no rows are sent).
      const res = await sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
      if (res.error && (res.error.code === 'PGRST205' || res.error.code === '42P01')) setReady(false);
      else if (!res.error) { setReady(true); setCount(res.count ?? 0); }
      return;
    }
    const res = await sb.from('notifications').select('id, kind, task_id, title, body, created_at, read_at').order('created_at', { ascending: false }).limit(100);
    if (res.error) {
      if (res.error.code === 'PGRST205' || res.error.code === '42P01') setReady(false);
      setLoaded(true);
      return;
    }
    setReady(true);
    const list = (res.data ?? []).map(fromRow);
    // Everything already in the list on first load is old news: no sound for it later.
    list.forEach(n => announced.current.add(n.id));
    setItems(list);
    setLoaded(true);
    setListOn(true);
  }, [available]);

  const showList = useCallback(() => {
    if (listWanted.current) return;
    listWanted.current = true;
    load();
  }, [load]);

  const announce = useCallback((id: string, title: string) => {
    if (announced.current.has(id)) return;
    announced.current.add(id);
    if (document.visibilityState !== 'visible') return;
    playChime();
    toast(title);
  }, [toast]);

  // Service worker, sound, and keeping this device's subscription up to date.
  useEffect(() => {
    if (!available) return;
    unlockSound();
    // Not needed for the first paint: wait until the page has settled.
    const start = () => { registerWorker().then(() => refreshSubscription()); };
    if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 4000 });
    else setTimeout(start, 1500);
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; notification?: PushMessage; url?: string } | null;
      if (d?.type === 'taske-open' && d.url) { router.push(new URL(d.url).pathname + new URL(d.url).search); return; }
      if (d?.type !== 'taske-push' || !d.notification) return;
      const n = d.notification;
      listeners.current.forEach(fn => fn(n));
      announce(n.id, n.title);
      load();
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    // addEventListener alone doesn't open the message queue in every browser (Safari): open it.
    navigator.serviceWorker.startMessages?.();
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [available, announce, load, router]);

  // The list, live.
  useEffect(() => {
    if (!available || !account) return;
    load();
    const sb = getBrowserSupabase();
    const channel = sb.channel('notifications-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        const n = fromRow(payload.new as Record<string, unknown>);
        // A test belongs to the device that asked for it; other devices just list it.
        if (n.kind !== 'test') announce(n.id, n.title);
        else announced.current.add(n.id);
        load();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, () => load())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, () => load())
      .subscribe();
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { sb.removeChannel(channel); document.removeEventListener('visibilitychange', onVisible); };
  }, [available, account, load, announce]);

  const markRead = useCallback((id: string) => {
    setItems(list => list.map(n => (n.id === id ? { ...n, read: true } : n)));
    getBrowserSupabase().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null).then(() => undefined);
  }, []);
  const markAllRead = useCallback(() => {
    setItems(list => list.map(n => ({ ...n, read: true })));
    setCount(0);
    getBrowserSupabase().from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null).then(() => undefined);
  }, []);
  const remove = useCallback((id: string) => {
    setItems(list => list.filter(n => n.id !== id));
    getBrowserSupabase().from('notifications').delete().eq('id', id).then(() => undefined);
  }, []);
  const onPush = useCallback((fn: (m: PushMessage) => void) => {
    listeners.current.add(fn);
    return () => { listeners.current.delete(fn); };
  }, []);

  const listUnread = useMemo(() => items.filter(n => !n.read).length, [items]);
  const unread = listOn ? listUnread : count;
  const value: Notifications = { available, loaded, ready, items, unread, showList, markRead, markAllRead, remove, onPush };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
