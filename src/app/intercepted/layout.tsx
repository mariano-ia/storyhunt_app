import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'CONVERSATION_INTERCEPTED | StoryHunt',
  description: 'A conversation was intercepted at 40.7128 N, 74.0060 W. Can you decode it?',
  openGraph: {
    title: 'CONVERSATION_INTERCEPTED | StoryHunt',
    description: 'A conversation was intercepted at 40.7128 N, 74.0060 W. Can you decode it?',
    type: 'website',
  },
};

export default function InterceptedLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
