import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Start Your Hunt | StoryHunt',
  description: 'A chat-based mystery experience through New York City. Your phone sends clues. You decode the city. From $9.99.',
  openGraph: {
    title: 'Start Your Hunt | StoryHunt',
    description: 'A mystery experience through NYC. No guide. No group. Just you and the streets.',
    type: 'website',
  },
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap"
      />
      {children}
    </>
  );
}
