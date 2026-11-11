import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Noto_Sans_Georgian } from 'next/font/google';
import '@/styles/tokens.css';
import '@/styles/app.css';

const sans = Noto_Sans_Georgian({ subsets: ['latin', 'georgian'], weight: ['400', '500', '600', '700'], variable: '--font-noto-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: 'Personal Schedule',
  description: 'Week planner for tasks across projects.',
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f2ed' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0e' },
  ],
};

// Applies the saved Day/Night choice before first paint so the page does not flash.
const themeScript = `try{var m=localStorage.getItem('ps.mode');if(m==='day'||m==='night')document.documentElement.dataset.mode=m}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
