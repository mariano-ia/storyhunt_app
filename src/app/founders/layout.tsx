import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'NYC opens 100 doors. Play FREE this week. | StoryHunt',
  description: 'The city is tired of tourists. This week we hand 100 keys to people who notice. Pick a door and play free.',
  openGraph: {
    title: 'NYC opens 100 doors. Play FREE this week.',
    description: 'The city is tired of tourists. This week we hand 100 keys to people who notice.',
    type: 'website',
  },
};

export default function FoundersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;700&family=Fira+Sans:wght@400;600;700&display=swap"
      />
      {children}
    </>
  );
}
