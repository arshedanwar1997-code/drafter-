import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Legal Success India – Trademark Advisory PDF Generator',
  description:
    'Private trademark examination and Section 11 advisory report generator with live A4 preview, fee management, templates, and fillable PDF export.',
  openGraph: {
    title: 'Legal Success India – Trademark Advisory PDF Generator',
    description:
      'Private trademark examination and Section 11 advisory report generator with live A4 preview and PDF export.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Legal Success India – Trademark Advisory PDF Generator',
    description:
      'Private trademark examination and Section 11 advisory report generator.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-slate-50 text-slate-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
