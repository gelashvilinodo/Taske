'use client';

import type { Session } from '@supabase/supabase-js';
import { getBrowserSupabase } from '@/lib/supabase/client';

/**
 * Accounts signed in on this device, for the switcher under the header avatar.
 * Each keeps its own Supabase session (refresh token), so switching needs no new sign-in.
 * Lives only in this browser (localStorage); the active one is also the cookie session.
 * The active account's tokens are re-saved on every refresh (see `rememberSession`),
 * because Supabase rotates refresh tokens and an old one stops working.
 */
export type SavedAccount = {
  id: string;
  email: string;
  name: string;
  photo: string;
  /** How they signed in: google, apple or email */
  provider: string;
  /** Empty once the session stopped working: the account then needs a fresh sign-in. */
  access: string;
  refresh: string;
};

const KEY = 'ps.accounts';

export function savedAccounts(): SavedAccount[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(a => a && typeof a.id === 'string') : [];
  } catch { return []; }
}
function write(list: SavedAccount[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* private mode: no switcher memory */ }
  window.dispatchEvent(new Event(KEY));
}
/** Calls `fn` when the saved list changes (in this tab or another one). */
export function watchAccounts(fn: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) fn(); };
  window.addEventListener(KEY, fn);
  window.addEventListener('storage', onStorage);
  return () => { window.removeEventListener(KEY, fn); window.removeEventListener('storage', onStorage); };
}

export function accountOf(session: Session): SavedAccount {
  const u = session.user;
  const meta = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email ?? '',
    name: meta.full_name || meta.name || '',
    photo: meta.avatar_url || meta.picture || '',
    provider: String(u.app_metadata?.provider || 'email'),
    access: session.access_token,
    refresh: session.refresh_token,
  };
}

/** Adds or updates the signed-in account (with its newest tokens). Order stays: first sign-in first. */
export function rememberSession(session: Session) {
  const next = accountOf(session);
  const list = savedAccounts();
  const i = list.findIndex(a => a.id === next.id);
  if (i >= 0) {
    const old = list[i];
    if (old.access === next.access && old.refresh === next.refresh && old.name === next.name && old.photo === next.photo && old.email === next.email) return;
    list[i] = next;
  } else list.push(next);
  write(list);
}

export function forgetAccount(id: string) {
  write(savedAccounts().filter(a => a.id !== id));
}
function dropTokens(id: string) {
  write(savedAccounts().map(a => (a.id === id ? { ...a, access: '', refresh: '' } : a)));
}

/** Saves the current session so it can be switched back to later. */
async function keepCurrent() {
  const { data } = await getBrowserSupabase().auth.getSession();
  if (data.session) rememberSession(data.session);
}

/**
 * Makes another saved account the active one and reloads the app as that account.
 * Returns false (and leaves the current account signed in) when its session no longer works;
 * the account then shows as needing a fresh sign-in.
 */
export async function switchAccount(id: string): Promise<boolean> {
  const target = savedAccounts().find(a => a.id === id);
  if (!target?.refresh) return false;
  const sb = getBrowserSupabase();
  await keepCurrent();
  const { data: before } = await sb.auth.getSession();
  const { data, error } = await sb.auth.setSession({ access_token: target.access, refresh_token: target.refresh });
  if (error || !data.session) {
    dropTokens(id);
    // A failed switch must not leave us signed out: put the previous session back.
    if (before.session) await sb.auth.setSession({ access_token: before.session.access_token, refresh_token: before.session.refresh_token }).catch(() => undefined);
    return false;
  }
  rememberSession(data.session);
  window.location.assign('/');
  return true;
}

/**
 * Opens the sign-in page for another account. The current account is NOT signed out:
 * any Supabase sign-out (even scope "local") ends that session on the server, and its saved
 * refresh token would stop working. Signing in as someone else simply replaces the session
 * cookie, and the old session stays saved here for switching back.
 */
export async function addAccount() {
  await keepCurrent();
  window.location.assign('/login?add=1');
}

/** Keeps saved tokens fresh on pages outside the workspace (the sign-in page). */
export function watchSessions() {
  const { data } = getBrowserSupabase().auth.onAuthStateChange((_event, session) => { if (session) rememberSession(session); });
  return () => data.subscription.unsubscribe();
}

/**
 * Signs the current account out and forgets it here. When another saved account still works,
 * the app switches to it; otherwise it goes to the sign-in page.
 */
export async function signOutCurrent() {
  const sb = getBrowserSupabase();
  const { data } = await sb.auth.getSession();
  if (data.session) forgetAccount(data.session.user.id);
  await sb.auth.signOut();
  for (const a of savedAccounts()) {
    if (!a.refresh) continue;
    const { data: next, error } = await sb.auth.setSession({ access_token: a.access, refresh_token: a.refresh });
    if (!error && next.session) { rememberSession(next.session); window.location.assign('/'); return; }
    dropTokens(a.id);
  }
  window.location.assign('/login');
}

/** Sign-in page: back into a saved account without signing in again. */
export async function resumeAccount(id: string): Promise<boolean> {
  const target = savedAccounts().find(a => a.id === id);
  if (!target?.refresh) return false;
  const { data, error } = await getBrowserSupabase().auth.setSession({ access_token: target.access, refresh_token: target.refresh });
  if (error || !data.session) { dropTokens(id); return false; }
  rememberSession(data.session);
  window.location.assign('/');
  return true;
}
