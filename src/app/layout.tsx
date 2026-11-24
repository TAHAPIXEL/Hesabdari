import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0C2337",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "نوین آشپزخانه · سامانه حسابداری و انبار",
  description:
    "سامانه جامع حسابداری، فروش، بارکدخوان سریع و انبارداری فروشگاه نوین آشپزخانه — کارکرد کامل آفلاین و همگام‌سازی ابری خودکار.",
  manifest: "/manifest.webmanifest",
  applicationName: "نوین آشپزخانه",
  appleWebApp: {
    capable: true,
    title: "نوین آشپزخانه",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/logo.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-[#F3EEE4] text-[#0F1D2A] antialiased">{children}</body>
    </html>
  );
}
