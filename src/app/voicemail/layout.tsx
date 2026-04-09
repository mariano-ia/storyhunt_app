import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'VOICEMAIL_RECOVERED | StoryHunt',
  description: 'A voicemail was recovered at 04:12 AM from an unknown number. Can you decode the location?',
  openGraph: {
    title: 'VOICEMAIL_RECOVERED | StoryHunt',
    description: 'A voicemail was recovered at 04:12 AM from an unknown number.',
    type: 'website',
  },
};

export default function VoicemailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
