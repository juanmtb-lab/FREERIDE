import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import MobileNav from "@/components/layout/MobileNav";
import type { Viewport } from "next";

export const metadata = {
  title: "FREERIDE - Telemetría & Entrenador AI",
  description: "App de telemetría de ciclismo Garmin Edge 130, visualización 3D y entrenador AI",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FREERIDE",
  },
};

export const viewport: Viewport = {
  themeColor: "#FF5722",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FREERIDE" />
      </head>
      <body className="flex h-screen overflow-hidden bg-dark-bg text-dark-text">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
            {children}
          </main>
        </div>
        <MobileNav />
      </body>
    </html>
  );
}
