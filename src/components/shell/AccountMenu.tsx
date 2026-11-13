'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { addAccount, forgetAccount, savedAccounts, switchAccount, watchAccounts, type SavedAccount } from '@/lib/accounts';
import { IconAssignee, IconClose, IconLogout, IconSave } from './icons';

const initials = (s: string) => s.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';
/** Same as the box's size transition in app.css (.acct-box). */
const CLOSE_MS = 400;
const via = (provider: string) => (provider === 'google' ? 'Google account' : provider === 'apple' ? 'Apple account' : 'Email sign-in');

function Face({ name, email, photo, small }: { name: string; email: string; photo: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  return (
    <span className={'avatar' + (small ? ' is-small' : '')} aria-hidden="true">
      {photo && !failed
        ? <img src={photo} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        : initials(name || email)}
    </span>
  );
}

/**
 * The header avatar as a button. Tapping it grows a box out of the avatar (its size animates
 * from the avatar's to the panel's) with the account's name and email on top, then the
 * accounts signed in on this device: tap one to switch, "Add another account" to sign in
 * with a different email (the current one stays saved), and Sign out.
 */
export default function AccountMenu() {
  const { account, toast, signOut } = useWorkspace();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  /** True from opening until the closing animation has finished: the box keeps its look
   *  (and stays above the page) while it shrinks back into the avatar. */
  const [shown, setShown] = useState(false);
  const [saved, setSaved] = useState<SavedAccount[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [bodyH, setBodyH] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    const load = () => setSaved(savedAccounts());
    load();
    return watchAccounts(load);
  }, []);
  useEffect(() => setOpen(false), [path]);
  useLayoutEffect(() => {
    if (open) { setShown(true); return; }
    const t = setTimeout(() => setShown(false), CLOSE_MS);
    return () => clearTimeout(t);
  }, [open]);

  // The box grows to the panel's real height, so it fits however many accounts there are.
  useLayoutEffect(() => {
    const el = body.current;
    if (!el) return;
    const measure = () => setBodyH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [account]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (!account) return null;

  // The current account always shows, even before its session is saved to the list.
  const list: SavedAccount[] = saved.some(a => a.id === account.id)
    ? saved
    : [{ ...account, provider: 'email', access: '', refresh: '' }, ...saved];

  const pick = async (a: SavedAccount) => {
    if (a.id === account.id || busy) return;
    if (!a.refresh) { setBusy(a.id); await addAccount(); return; }
    setBusy(a.id);
    const ok = await switchAccount(a.id);
    if (!ok) { setBusy(null); toast(`${a.email || a.name} was signed out. Sign in to it again.`); }
  };

  const style = { '--acct-body-h': `${bodyH}px` } as CSSProperties;
  return (
    <div ref={root} className={'acct' + (open ? ' is-open' : '') + (open || shown ? ' is-shown' : '')} style={style}
      onBlur={e => { if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      {/* Only the box grows; the avatar button keeps its size and place on top of it */}
      <div className="acct-box">
        <div className="acct-who" aria-hidden={!open}>
          <strong title={account.name}>{account.name || account.email}</strong>
          {account.email && account.email !== account.name && <span title={account.email}>{account.email}</span>}
        </div>
        <div className="acct-body" id={panelId} ref={body} inert={!open} aria-hidden={!open}>
          <p className="acct-label">Accounts</p>
          <div className="acct-list">
            {list.map(a => {
              const current = a.id === account.id;
              return (
                <div className="acct-row" key={a.id}>
                  <button type="button" className="acct-item" aria-current={current ? 'true' : undefined}
                    disabled={busy !== null} onClick={() => pick(a)}>
                    <Face name={a.name} email={a.email} photo={a.photo} small />
                    <span className="acct-text">
                      <span className="acct-name">{a.name || a.email}</span>
                      <span className="acct-sub">
                        {busy === a.id ? 'Switching…' : !current && !a.refresh ? 'Signed out · tap to sign in' : a.name ? a.email : via(a.provider)}
                      </span>
                    </span>
                    {current && <span className="acct-check" aria-label="Current account"><IconSave size={16} /></span>}
                  </button>
                  {!current && (
                    <button type="button" className="acct-forget" aria-label={`Remove ${a.email || a.name} from this list`} title="Remove from this list"
                      disabled={busy !== null} onClick={() => forgetAccount(a.id)}><IconClose size={14} /></button>
                  )}
                </div>
              );
            })}
          </div>
          <button type="button" className="acct-action" disabled={busy !== null}
            onClick={() => { setBusy('add'); void addAccount(); }}>
            <span className="acct-ico"><IconAssignee size={18} /></span>{busy === 'add' ? 'Opening sign-in…' : 'Add another account'}
          </button>
          <button type="button" className="acct-action" disabled={busy !== null}
            onClick={() => { setBusy('out'); void signOut(); }}>
            <span className="acct-ico"><IconLogout size={18} /></span>{busy === 'out' ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
      <button ref={button} type="button" className="acct-btn" aria-label="Account menu" title={open ? undefined : account.email || account.name}
        aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(o => !o)}>
        <Face name={account.name} email={account.email} photo={account.photo} />
      </button>
    </div>
  );
}
