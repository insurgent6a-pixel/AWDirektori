import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { BottomBar, Footer, Header } from "./_components/shell";
import { Toaster } from "./_components/ui";
import { AuthProvider } from "./_lib/auth";
import { brand, ui } from "./_lib/font";

export const metadata: Metadata = {
  title: { default: "Direktori Lulusan AsiaWorks", template: "%s · Direktori AsiaWorks" },
  description: "Temukan bisnis, peluang kerja sama, dan acara dari sesama lulusan AsiaWorks.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#8b1a1a", // as asiaworks.id
};

// Self-contained: fonts, auth and chrome for every directory route. Copy the (aw) folder to move the feature.
export default function AwLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${ui.variable} ${brand.variable} aw flex flex-col`}>
      <AuthProvider>
        <Header />
        {/* Pages and the bottom bar read the query string, which needs a Suspense boundary to prerender. */}
        <main className="flex-1">
          {/* The fallback holds a screen of room, so the footer does not sit under the header and then jump away. */}
          <Suspense fallback={<div className="min-h-dvh" />}>{children}</Suspense>
        </main>
        <Footer />
        <Suspense>
          <BottomBar />
        </Suspense>
        <Toaster />
      </AuthProvider>
    </div>
  );
}
