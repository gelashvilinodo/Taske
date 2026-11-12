/* Taske service worker: receives push notifications.
 * - Taske open and on screen: tell the page, which plays Taske's own sound and shows it in the app.
 * - Otherwise: show a normal system notification (phone / laptop default sound and banner).
 * Safari (iPhone, iPad, Mac) stops delivering pushes to sites that receive one without showing a
 * notification, so there it always shows one, silent while Taske is on screen. */

const TEST_CACHE = 'taske-push';
const TEST_KEY = '/__push-test-received';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

const isSafari = () => {
  const ua = self.navigator.userAgent;
  return /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua);
};

self.addEventListener('push', event => {
  let data;
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { title: 'Taske', body: event.data ? event.data.text() : '' }; }
  const msg = {
    id: String(data.id || Date.now()),
    kind: data.kind || 'overdue',
    title: String(data.title || 'Taske'),
    body: String(data.body || ''),
    url: String(data.url || '/notifications'),
  };

  event.waitUntil((async () => {
    // Remember that a test arrived, for a page that was in the background and missed the message.
    if (msg.kind === 'test') {
      try { await (await caches.open(TEST_CACHE)).put(TEST_KEY, new Response(msg.id)); } catch { /* storage blocked */ }
    }
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const onScreen = windows.some(c => c.visibilityState === 'visible');
    windows.forEach(c => c.postMessage({ type: 'taske-push', notification: msg, onScreen }));
    if (onScreen && !isSafari()) return;
    await self.registration.showNotification(msg.title, {
      body: msg.body,
      tag: msg.id,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: msg.url },
      silent: onScreen,
    });
  })());
});

// Tapping the notification opens Taske (or brings the open window forward) on the right page.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/notifications', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = windows.find(c => new URL(c.url).origin === self.location.origin);
    if (win) {
      await win.focus();
      try { await win.navigate(url); } catch { win.postMessage({ type: 'taske-open', url }); }
      return;
    }
    await self.clients.openWindow(url);
  })());
});

// The browser replaced this device's subscription (keys rotated): save the new one.
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    const old = event.oldSubscription;
    const key = old && old.options && old.options.applicationServerKey;
    if (!key) return;
    const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    await fetch('/api/push/subscribe', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    });
  })());
});
