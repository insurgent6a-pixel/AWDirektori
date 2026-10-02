import "./globals.css";

// The host site's root layout. Everything for the directory lives in app/(aw).
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
