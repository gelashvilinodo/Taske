import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Noto_Sans_Georgian } from 'next/font/google';
import '@/styles/tokens.css';
import '@/styles/app.css';
import { BackdropDrift } from '@/components/shell/BackdropDrift';
import AutoTheme from '@/components/settings/AutoTheme';
import { DAY_START, NIGHT_START } from '@/lib/theme';

const sans = Noto_Sans_Georgian({ subsets: ['latin', 'georgian'], weight: ['400', '500', '600', '700'], variable: '--font-noto-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: 'Personal Schedule',
  applicationName: 'Taske',
  // iPhone "Add to Home Screen": name under the icon, full-screen launch, content under the status bar.
  appleWebApp: { capable: true, title: 'Taske', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  description: 'Week planner for tasks across projects.',
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0e' },
  ],
};

// Applies the saved Day/Night choice before first paint so the page does not flash.
// "auto" picks Day or Night from the clock (see src/lib/theme.ts); AutoTheme keeps it current.
const themeScript = `try{var m=localStorage.getItem('ps.mode');if(m==='auto'){var h=new Date().getHours();m=h>=${DAY_START}&&h<${NIGHT_START}?'day':'night'}if(m==='day'||m==='night')document.documentElement.dataset.mode=m}catch(e){}`;

// iOS 26 home-screen app: with the translucent status bar, 100vh/100dvh come out one status bar
// short, so the page stopped above the screen's bottom edge and left a black band there.
// Measure what's missing and hand it to CSS as --vh-gap (0 everywhere else).
// The gap is the screen height minus what a 100dvh box really gets (checked against innerHeight too).
const vhGapScript = `(function(){var s=navigator.standalone||matchMedia('(display-mode: standalone)').matches;if(!s)return;var d=document.documentElement;function f(){var p=document.createElement('div');p.style.cssText='position:absolute;top:0;left:0;width:1px;height:100dvh;visibility:hidden;pointer-events:none';d.appendChild(p);var v=Math.min(p.getBoundingClientRect().height,innerHeight);p.remove();var land=matchMedia('(orientation: landscape)').matches,h=land?Math.min(screen.width,screen.height):Math.max(screen.width,screen.height),g=Math.max(0,Math.round(h-v));if(g>120)g=0;d.style.setProperty('--vh-gap',g+'px');d.dataset.vhGap=g}f();addEventListener('resize',f);addEventListener('pageshow',f);addEventListener('orientationchange',function(){setTimeout(f,300)})})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: vhGapScript }} />
      </head>
      <body>
        <BackdropDrift />
        <AutoTheme />
        {children}
      </body>
    </html>
  );
}
