'use client';

/** Browser side of push notifications: service worker, permission, subscription, test. */

export type PushSupport =
  | 'ok'
  /** iPhone / iPad in Safari: push only works once Taske is added to the Home Screen. */
  | 'needs-install'
  | 'unsupported';

const VERIFIED_KEY = 'ps.push.verified';
const TEST_CACHE = 'taske-push';
const TEST_KEY = '/__push-test-received';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

export function pushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  const has = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (isIOS() && !standalone()) return 'needs-install';
  return has ? 'ok' : 'unsupported';
}

export const permission = (): NotificationPermission | 'unsupported' =>
  typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;

let registration: Promise<ServiceWorkerRegistration | null> | null = null;
/** Registers /sw.js once per page load. */
export function registerWorker() {
  if (!registration) {
    registration = 'serviceWorker' in navigator
      ? navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(() => navigator.serviceWorker.ready).catch(() => null)
      : Promise.resolve(null);
  }
  return registration;
}

export async function currentSubscription() {
  const reg = await registerWorker();
  return reg ? reg.pushManager.getSubscription() : null;
}

const toKey = (b64url: string) => {
  const s = atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4));
  return Uint8Array.from(s, c => c.charCodeAt(0));
};
const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) => {
  if (!a || a.byteLength !== b.length) return false;
  const u = new Uint8Array(a);
  return u.every((x, i) => x === b[i]);
};

export class PushError extends Error {
  constructor(public code: 'denied' | 'dismissed' | 'not_set_up' | 'signed_out' | 'failed', message?: string) { super(message ?? code); }
}

async function save(sub: PushSubscription) {
  const res = await fetch('/api/push/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  });
  if (res.ok) return;
  const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  throw new PushError(j.error === 'not_set_up' ? 'not_set_up' : res.status === 401 ? 'signed_out' : 'failed', j.message);
}

/**
 * Asks for permission (must run from a tap), subscribes this device and saves it on the server.
 * Returns the subscription's endpoint.
 */
export async function enablePush(): Promise<string> {
  // Ask first, straight from the tap: Safari only shows the prompt inside the user's gesture.
  const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (result === 'denied') throw new PushError('denied');
  if (result !== 'granted') throw new PushError('dismissed');

  const keyRes = await fetch('/api/push/key', { cache: 'no-store' }).then(r => r.json() as Promise<{ publicKey: string | null }>).catch(() => ({ publicKey: null }));
  if (!keyRes.publicKey) throw new PushError('not_set_up', 'The server has no VAPID key yet.');
  const key = toKey(keyRes.publicKey);

  const reg = await registerWorker();
  if (!reg) throw new PushError('failed', 'Service worker could not start.');
  let sub = await reg.pushManager.getSubscription();
  // A subscription made with an older server key can't receive our pushes: replace it.
  if (sub && !sameKey(sub.options.applicationServerKey, key)) { await sub.unsubscribe().catch(() => undefined); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await save(sub);
  return sub.endpoint;
}

/** Re-saves an existing subscription (time zone, account switch). Quietly ignores failures. */
export async function refreshSubscription() {
  if (permission() !== 'granted') return;
  const sub = await currentSubscription().catch(() => null);
  if (sub) await save(sub).catch(() => undefined);
}

/** Asks the server to push a test notification to this device. Returns the notification id. */
export async function sendTest(endpoint: string): Promise<string> {
  await clearTestMark();
  const res = await fetch('/api/push/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint }) });
  const j = (await res.json().catch(() => ({}))) as { id?: string; error?: string; message?: string };
  if (!res.ok || !j.id) throw new PushError(j.error === 'not_set_up' ? 'not_set_up' : 'failed', j.message || j.error);
  return j.id;
}

/** Id of the last test the service worker received, if any (covers a page that was in the background). */
export async function testMark(): Promise<string | null> {
  try { return (await (await (await caches.open(TEST_CACHE)).match(TEST_KEY))?.text()) ?? null; } catch { return null; }
}
/** Whether the notification with this id is (still) showing on this device. */
export async function shownNotification(id: string): Promise<boolean> {
  try {
    const reg = await registerWorker();
    return !!reg && (await reg.getNotifications({ tag: id })).length > 0;
  } catch { return false; }
}
async function clearTestMark() {
  try { await (await caches.open(TEST_CACHE)).delete(TEST_KEY); } catch { /* storage blocked */ }
}

/** The endpoint whose test arrived on this device. The prompt stays hidden while it matches. */
export const verifiedEndpoint = () => { try { return localStorage.getItem(VERIFIED_KEY); } catch { return null; } };
export const markVerified = (endpoint: string) => { try { localStorage.setItem(VERIFIED_KEY, endpoint); } catch { /* private mode */ } };
