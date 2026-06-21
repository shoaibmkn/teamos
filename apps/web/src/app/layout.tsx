import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TeamOS',
  description: 'AI-native team operating system: operational visibility, workflow execution, evidence-driven completion.',
  manifest: '/manifest.webmanifest',
  applicationName: 'TeamOS',
  appleWebApp: { capable: true, title: 'TeamOS', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0b0f17',
  width: 'device-width',
  initialScale: 1,
};

// Set the theme class before paint to avoid a flash. Default to light; users
// can switch to dark and the choice persists.
const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('teamos-theme');
    var dark = stored ? stored === 'dark' : false;
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

const swRegister = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <script dangerouslySetInnerHTML={{ __html: swRegister }} />
      </body>
    </html>
  );
}
