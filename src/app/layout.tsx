import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { I18nProvider } from "@/lib/i18n/client";
import { getLocale } from "@/lib/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EDGELOG", template: "%s · EDGELOG" },
  description: "Trading journal & performance statistics.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-bg text-fg">
        <I18nProvider locale={locale}>{children}</I18nProvider>
        <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: "#1A202B", border: "1px solid #262D38", color: "#F5F5F5" } }} />
      </body>
    </html>
  );
}
