import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './privacy.module.css';

export const metadata: Metadata = {
  title: 'Privacy Policy · Taske',
  description: 'How Taske collects, uses and protects your data.',
};

const UPDATED = '11 November 2026';
const CONTACT = 'support@taske.ge';

/** Public page (no sign-in). Google and Apple sign-in require a privacy policy URL. */
export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.doc}>
        <p className={styles.back}><Link href="/login">← Back to Taske</Link></p>
        <h1>Privacy Policy</h1>
        <p className={styles.meta}>Last updated: {UPDATED}</p>

        <p>
          Taske (<a href="https://taske.ge">taske.ge</a>) is a planner for tasks and schedules. This page explains
          what data we collect, why, and the choices you have.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><b>Account details:</b> your email address, and your name and profile picture if you sign in with Google or Apple.</li>
          <li><b>Content you create:</b> tasks, subtasks, descriptions, comments, dates and project labels.</li>
          <li><b>Technical data:</b> sign-in session cookies and basic request logs (time, address, browser) needed to run and secure the service.</li>
        </ul>
        <p>We do not use advertising or tracking cookies, and we do not sell your data.</p>

        <h2>How we use it</h2>
        <ul>
          <li>To sign you in and keep your account secure.</li>
          <li>To store your tasks and show them to you on your devices.</li>
          <li>To send sign-in codes and messages about your account.</li>
        </ul>

        <h2>Sign in with Google or Apple</h2>
        <p>
          When you choose Google or Apple, we receive only your name, email address and profile picture, and use them
          only to create and identify your account. We do not access your contacts, files or other data in those accounts.
          If you choose Apple&apos;s &ldquo;Hide My Email&rdquo;, we only see the relay address Apple gives us.
        </p>

        <h2>Who processes your data</h2>
        <ul>
          <li><b>Supabase</b>: database and sign-in.</li>
          <li><b>Cloudflare</b>: hosting and network security.</li>
          <li><b>Resend</b>: sending sign-in emails.</li>
          <li><b>Google</b> and <b>Apple</b>: only if you sign in with them.</li>
        </ul>
        <p>Each provider handles data under its own privacy policy and only to provide its service to us.</p>

        <h2>Sharing</h2>
        <p>
          Your tasks are private to your account. When sharing is added, the people you invite will see only what you
          choose to share with them.
        </p>

        <h2>Retention and deletion</h2>
        <p>
          We keep your data while your account exists. You can delete tasks at any time. To delete your account and all
          its data, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and we will do so within 30 days.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask to see, correct, export or delete your personal data by writing to{' '}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>

        <h2>Changes</h2>
        <p>If we change this policy, we will update the date above and, for significant changes, tell you in the app.</p>

        <h2>Contact</h2>
        <p><a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
      </article>
    </main>
  );
}
