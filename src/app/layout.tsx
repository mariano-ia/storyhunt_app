import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import MetaPixel from '@/components/MetaPixel';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'StoryHunt Platform',
  description: 'Panel de administración de experiencias interactivas por WhatsApp',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <MetaPixel />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
