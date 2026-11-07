import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EDGELOG", template: "%s · EDGELOG" },
  description: "Professional trading journal & performance analytics.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-bg text-fg">
        {children}
        <Toaster theme="dark" position="bottom-right" toastOptions={{ style: { background: "#1A202B", border: "1px solid #262D38", color: "#F5F5F5" } }} />
      </body>
    </html>
  );
}
