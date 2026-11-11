import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Noto_Sans_Georgian, Noto_Serif_Georgian } from 'next/font/google';
import '@/styles/tokens.css';
import '@/styles/app.css';

const sans = Noto_Sans_Georgian({ subsets: ['latin', 'georgian'], weight: ['400', '500', '600', '700'], variable: '--font-noto-sans' });
const serif = Noto_Serif_Georgian({ subsets: ['latin', 'georgian'], weight: ['600', '700'], variable: '--font-noto-serif' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: 'Personal Schedule',
  description: 'Week planner for tasks across projects.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// Applies the saved Day/Night choice before first paint so the page does not flash.
const themeScript = `try{var m=localStorage.getItem('ps.mode');if(m==='day'||m==='night')document.documentElement.dataset.mode=m}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
