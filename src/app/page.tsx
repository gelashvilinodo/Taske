import type { Metadata } from 'next';
import Link from 'next/link';
import { supabaseEnabled } from '@/lib/supabase/config';
import { isSignedIn } from '@/lib/supabase/server';
import styles from './landing.module.css';

export const metadata: Metadata = {
  title: 'Taske · Plan your week',
  description: 'A calm week planner for tasks across projects: board, list, calendar and table, synced on every device.',
};

const FEATURES = [
  { title: 'Week board', text: 'Monday to Friday at a glance. Drag tasks between days.' },
  { title: 'Status list', text: 'See what is to do, in progress and done this week.' },
  { title: 'Calendar', text: 'Month overview now; Google Calendar sync is on the way.' },
  { title: 'Table', text: 'Every task in one sortable list.' },
];

/** Temporary landing page: what Taske is, and one button to get in. */
export default async function LandingPage() {
  // Without Supabase (local mode) there are no accounts, so go straight to the board.
  const signedIn = !supabaseEnabled || (await isSignedIn());
  const cta = signedIn ? { href: '/board', label: 'Open board' } : { href: '/login', label: 'Sign in' };

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.top}>
        <span className={styles.logo}>Taske</span>
        <Link className={styles.topLink} href={cta.href}>{cta.label}</Link>
      </header>

      <main className={styles.hero}>
        <p className={styles.badge}>Early preview</p>
        <h1 className={styles.title}>Plan your week, calmly.</h1>
        <p className={styles.lead}>
          Taske keeps tasks for all your projects in one place: a week board, a status list, a calendar and a table,
          saved and in sync on every device.
        </p>
        <Link className={styles.cta} href={cta.href}>{cta.label}</Link>
        <p className={styles.note}>{signedIn ? 'You are signed in.' : 'Sign in with Google or any email. No password needed.'}</p>
      </main>

      <section className={styles.grid} aria-label="Features">
        {FEATURES.map(f => (
          <article key={f.title} className={styles.card}>
            <h2>{f.title}</h2>
            <p>{f.text}</p>
          </article>
        ))}
      </section>

      <footer className={styles.foot}>
        <span>© 2026 Taske</span>
        <Link href="/privacy">Privacy Policy</Link>
      </footer>
    </div>
  );
}
