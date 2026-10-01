import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', axes: ['opsz'], weight: ['500', '700', '800'] });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600'] });

export const metadata: Metadata = {
  title: 'Mordiem Stake',
  description: 'Stake MDM, check out MCU and earn daily API credit on Base. Every queue, epoch and cost shown plainly.',
};
export const viewport: Viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

// The surface is applied before paint from localStorage so the page never flashes the wrong theme.
const surfaceScript = `try{var s=localStorage.getItem('surface');if(s==='day'||s==='night')document.documentElement.dataset.surface=s;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-surface="night" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: surfaceScript }} /></head>
      <body className="min-h-dvh bg-paper text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
