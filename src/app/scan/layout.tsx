import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'NYC is talking to you. | StoryHunt',
  description: 'Not a tour. Not a game. You scanned a sticker on a wall — most people walked right past it. You didn\'t. Pick a door and let the city talk.',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'Not a tour. Not a game. NYC is talking to you.',
    description: 'You scanned a sticker on a wall. Most people walked right past it. You didn\'t.',
    type: 'website',
  },
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;700&family=Fira+Sans:wght@400;600;700&display=swap"
      />
      {children}
    </>
  );
}
