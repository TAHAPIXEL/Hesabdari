import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#070B14",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "حسابداری · فروشگاه نوین آشپزخانه",
  description:
    "نرم‌افزار جامع حسابداری، صدور فاکتور، بارکدخوان سریع و انبارداری (فروشگاه نوین آشپزخانه) — کارکرد کامل آفلاین و همگام‌سازی ابری خودکار.",
  manifest: "/manifest.webmanifest",
  applicationName: "حسابداری",
  appleWebApp: {
    capable: true,
    title: "حسابداری",
    statusBarStyle: "default",
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
