import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'TRANSMISSION_INTERCEPTED | StoryHunt',
  description: '5 NYC secrets hidden in plain sight. Can you decode the signal?',
  openGraph: {
    title: 'TRANSMISSION_INTERCEPTED | StoryHunt',
    description: '5 NYC secrets hidden in plain sight. Can you decode the signal?',
    type: 'website',
  },
};

export default function SecretsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
