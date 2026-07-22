import './globals.css';

export const metadata = {
  title: 'Athlete OS',
  description: 'Personal S&C, nutrition, cricket and mindset tracker',
  manifest: '/manifest.json'
};

export const viewport = {
  themeColor: '#121C17',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
