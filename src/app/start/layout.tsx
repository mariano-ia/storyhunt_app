import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Start Your Hunt | StoryHunt',
  description: 'A chat-based mystery walk through New York City. Your phone sends clues. You decode the city. From $9.99.',
  openGraph: {
    title: 'Start Your Hunt | StoryHunt',
    description: 'A mystery walk through NYC. No guide. No group. Just you and the streets.',
    type: 'website',
  },
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
