import type { Metadata } from 'next';
import LoginForm from '@/components/auth/LoginForm';
import styles from './login.module.css';

export const metadata: Metadata = { title: 'Sign in · Personal Schedule' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="loginTitle">
        <h1 className={styles.title} id="loginTitle">Personal Schedule</h1>
        <p className={styles.sub}>Sign in to keep your tasks saved and in sync on every device.</p>
        <LoginForm initialError={error ? 'Sign-in did not finish: ' + error : ''} />
      </section>
    </main>
  );
}
