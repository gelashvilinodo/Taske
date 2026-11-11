import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { supabaseEnabled } from '@/lib/supabase/config';
import { isSignedIn } from '@/lib/supabase/server';
import LoginForm from '@/components/auth/LoginForm';
import styles from './login.module.css';

export const metadata: Metadata = { title: 'Sign in · Personal Schedule' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Local mode has no accounts; signed-in visitors go straight to the board.
  if (!supabaseEnabled || (await isSignedIn())) redirect('/board');
  const { error } = await searchParams;
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="loginTitle">
        <h1 className={styles.title} id="loginTitle">Personal Schedule</h1>
        <p className={styles.sub}>Sign in to keep your tasks saved and in sync on every device.</p>
        <LoginForm initialError={error ? 'Sign-in did not finish: ' + error : ''} />
        <p className={styles.legal}>By continuing you agree to our <Link href="/privacy">Privacy Policy</Link>.</p>
      </section>
    </main>
  );
}
