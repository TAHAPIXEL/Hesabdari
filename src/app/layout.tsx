import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "دفتر · سامانه حسابداری و انبار",
  description:
    "سامانه حسابداری و انبار آنلاین و آفلاین، متصل به فضای ابری با اسکن بارکد و گزارش‌های مالی.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-[#F3EEE4] text-[#0F1D2A] antialiased">{children}</body>
    </html>
  );
}
