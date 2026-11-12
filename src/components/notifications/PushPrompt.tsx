'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNotifications } from './NotificationsProvider';
import { getBrowserSupabase } from '@/lib/supabase/client';
import {
  currentSubscription, enablePush, markVerified, permission, pushSupport, PushError, sendTest, shownNotification, testMark, verifiedEndpoint,
  type PushSupport,
} from '@/lib/push/client';
import { IconAlert, IconBell, IconDone, IconShare } from '@/components/shell/icons';

type Step =
  | 'checking' | 'hidden' | 'offer' | 'working' | 'testing' | 'success'
  | 'failed' | 'denied' | 'not_set_up' | 'needs-install' | 'unsupported';

/** iPhone pushes can take a while to land; a test that arrives after this still flips the card to success. */
const TEST_WAIT_MS = 45000;

/**
 * The "turn on notifications" card at the top of the Notifications page. Per device: it shows until
 * this browser has granted permission, subscribed, and received the test notification. After that it
 * stays hidden on this device, and shows again on any device where notifications aren't on.
 */
export default function PushPrompt() {
  const { available, onPush } = useNotifications();
  const [step, setStep] = useState<Step>('checking');
  const [detail, setDetail] = useState('');
  const [leaving, setLeaving] = useState(false);
  const endpoint = useRef('');
  /** Test ids the service worker reported while we were waiting (the push can beat the server's reply). */
  const arrived = useRef(new Set<string>());
  /** The test we're waiting for (kept after the wait runs out, so a late arrival still counts). */
  const pending = useRef<{ id: string; ep: string } | null>(null);

  const succeed = useCallback((ep: string) => {
    pending.current = null;
    markVerified(ep);
    getBrowserSupabase().from('push_subscriptions').update({ verified_at: new Date().toISOString() }).eq('endpoint', ep).then(() => undefined);
    setStep('success');
    // Let the person see it worked, then fold the card away.
    setTimeout(() => setLeaving(true), 3200);
    setTimeout(() => setStep('hidden'), 3700);
  }, []);

  /** Did the test with this id reach this device? Any one sign is enough. */
  const landed = useCallback(async (id: string) =>
    arrived.current.has(id) || (await testMark()) === id || (await shownNotification(id)), []);

  useEffect(() => onPush(m => {
    if (m.kind !== 'test') return;
    arrived.current.add(m.id);
    const p = pending.current;
    if (p && p.id === m.id) succeed(p.ep);
  }), [onPush, succeed]);

  // Coming back to Taske after looking at the notification: check again.
  useEffect(() => {
    const recheck = async () => {
      const p = pending.current;
      if (document.hidden || !p) return;
      if (await landed(p.id)) succeed(p.ep);
    };
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);
    return () => { document.removeEventListener('visibilitychange', recheck); window.removeEventListener('focus', recheck); };
  }, [landed, succeed]);

  // Decide whether this device still needs the prompt.
  useEffect(() => {
    if (!available) { setStep('hidden'); return; }
    const support: PushSupport = pushSupport();
    if (support !== 'ok') { setStep(support); return; }
    const p = permission();
    if (p === 'denied') { setStep('denied'); return; }
    if (p !== 'granted') { setStep('offer'); return; }
    currentSubscription().then(sub => {
      if (sub && verifiedEndpoint() === sub.endpoint) setStep('hidden');
      else { endpoint.current = sub?.endpoint ?? ''; setStep('offer'); }
    }).catch(() => setStep('offer'));
  }, [available]);

  const test = useCallback(async (ep: string) => {
    setStep('testing');
    arrived.current.clear();
    pending.current = null;
    let id: string;
    try { id = await sendTest(ep); }
    catch (e) {
      const code = e instanceof PushError ? e.code : 'failed';
      setStep(code === 'not_set_up' ? 'not_set_up' : 'failed');
      setDetail(code === 'not_set_up' ? '' : 'The server could not send the test notification.');
      return;
    }
    pending.current = { id, ep };
    const until = Date.now() + TEST_WAIT_MS;
    while (Date.now() < until) {
      if (pending.current?.id !== id) return; // already confirmed (or a newer test started)
      if (await landed(id)) { succeed(ep); return; }
      await new Promise(r => setTimeout(r, 500));
    }
    if (pending.current?.id !== id) return;
    setStep('failed');
    setDetail('The test notification did not arrive on this device.');
  }, [landed, succeed]);

  const turnOn = async () => {
    setStep('working');
    setDetail('');
    try {
      endpoint.current = await enablePush();
    } catch (e) {
      const code = e instanceof PushError ? e.code : 'failed';
      if (code === 'denied') setStep('denied');
      else if (code === 'dismissed') setStep('offer');
      else if (code === 'not_set_up') setStep('not_set_up');
      else { setStep('failed'); setDetail('This device could not be signed up for notifications.'); }
      return;
    }
    await test(endpoint.current);
  };

  if (step === 'checking' || step === 'hidden') return null;

  const card = (tone: string, icon: ReactNode, title: string, text: ReactNode, action?: ReactNode) => (
    <section className={'panel push-card ' + tone + (leaving ? ' is-leaving' : '')} aria-live="polite">
      <span className="push-card-icon" aria-hidden="true">{icon}</span>
      <div className="push-card-text">
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
      {action && <div className="push-card-action">{action}</div>}
    </section>
  );

  switch (step) {
    case 'offer':
    case 'working':
      return card('is-offer', <IconBell size={22} />, 'Turn on notifications on this device',
        'Get a notification on this phone or computer when a task’s deadline passes, even when Taske is closed. With Taske open, you’ll hear its own sound instead.',
        <button type="button" className="primary" onClick={turnOn} disabled={step === 'working'}>
          <IconBell size={18} />{step === 'working' ? 'Turning on…' : 'Turn on notifications'}
        </button>);
    case 'testing':
      return card('is-offer', <span className="push-spinner" />, 'Sending a test notification…',
        'It should arrive in a few seconds. This checks that notifications really reach this device.');
    case 'success':
      return card('is-ok', <IconDone size={22} />, 'Notifications are on',
        'The test arrived. You’ll be notified here when a task is overdue.');
    case 'failed':
      return card('is-bad', <IconAlert size={22} />, 'The test didn’t work',
        <>{detail} Check that notifications for this browser are allowed in your device settings, and that Focus or Do Not Disturb is off, then try again.</>,
        <button type="button" className="primary" onClick={() => (endpoint.current ? test(endpoint.current) : turnOn())}>Try again</button>);
    case 'denied':
      return card('is-bad', <IconAlert size={22} />, 'Notifications are blocked for Taske',
        'Your browser is set to block them. Allow notifications for this site in the browser’s site settings (the icon left of the address bar), or for the Taske app in your phone’s Settings → Notifications, then reload this page.');
    case 'not_set_up':
      return card('is-bad', <IconAlert size={22} />, 'Notifications aren’t set up on the server yet',
        'The server is missing its notification keys or database tables. Once they are added, this button will work.');
    case 'needs-install':
      return card('is-offer', <IconShare size={22} />, 'Add Taske to your Home Screen first',
        <>On iPhone and iPad, notifications only work in the Taske app. In Safari tap <b>Share</b>, then <b>Add to Home Screen</b>, open Taske from there and come back to this page.</>);
    case 'unsupported':
      return card('is-bad', <IconAlert size={22} />, 'This browser can’t receive notifications',
        'Use Chrome, Edge, Firefox or Safari on a laptop, Chrome on Android, or the Taske app added to the Home Screen on iPhone.');
  }
}
